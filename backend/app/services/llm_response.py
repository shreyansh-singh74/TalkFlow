import asyncio
import json
import logging
import os
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from app.core.config import settings
from app.services.pronunciation_coach import PRONUNCIATION_COACH_SYSTEM_SUFFIX

# Suppress Google API warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '2'

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = settings.OPENROUTER_API_URL
OPENROUTER_MODEL = settings.OPENROUTER_MODEL

MAX_TOKENS_DEFAULT = 150
MAX_TOKENS_WITH_PRONUNCIATION_COACH = 256
BASE_SYSTEM_PROMPT = (
    "You are TalkFlow, an AI spoken-English coach.\n"
    "Help the user improve pronunciation, vocabulary, and spoken confidence through short interactive practice.\n"
    "Keep responses short, spoken-friendly, and under 3 sentences.\n"
    "Give only one practice item at a time.\n"
    "When giving practice, use this exact format: repeat after me: <practice text>\n"
    "If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one clear correction.\n"
    "Do not give long explanations."
)


async def _call_openrouter(
    prompt: str,
    pronunciation_coach: Optional[Dict[str, Any]] = None,
    agent_name: Optional[str] = None,
    agent_instructions: Optional[str] = None,
    practice_state: Optional[Dict[str, Any]] = None,
) -> str:
    """Call OpenRouter chat completions and return the full response text."""
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
        "X-Title": os.getenv("OPENROUTER_APP_NAME", "TalkFlow"),
    }

    system_parts = [BASE_SYSTEM_PROMPT]
    if agent_name or agent_instructions:
        system_parts.append(
            "Selected agent:\n"
            f"Name: {agent_name or 'TalkFlow Coach'}\n"
            f"Instructions: {agent_instructions or 'General spoken English practice.'}"
        )
    if pronunciation_coach:
        system_parts.append(PRONUNCIATION_COACH_SYSTEM_SUFFIX)
    system_content = "\n\n".join(system_parts)

    extra_blocks = []
    if pronunciation_coach:
        extra_blocks.append(
            "PRONUNCIATION_ASSESSMENT:\n"
            + json.dumps(pronunciation_coach, ensure_ascii=False)
        )
    if practice_state:
        extra_blocks.append(
            "PRACTICE_STATE:\n"
            + json.dumps(practice_state, ensure_ascii=False)
            + "\nYou must coach this exact next target. Say it first using: repeat after me: "
            + str(practice_state.get("target_text", ""))
        )

    if pronunciation_coach or practice_state:
        user_content = prompt + "\n\n" + "\n\n".join(extra_blocks)
        max_tokens = MAX_TOKENS_WITH_PRONUNCIATION_COACH
    else:
        user_content = prompt
        max_tokens = MAX_TOKENS_DEFAULT

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_content,
            },
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
                timeout=20.0,
            )
    except Exception as e:  # Network error, timeout, etc.
        raise RuntimeError(f"Failed to call OpenRouter: {e}") from e

    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as http_err:
        if resp.status_code == 402:
            logger.warning("OpenRouter returned 402 Payment Required for model %s. Attempting fallback to free model.", OPENROUTER_MODEL)
            fallback_models = [
                "google/gemini-2.0-flash-lite-preview-02-05:free",
                "meta-llama/llama-3.2-1b-instruct:free",
                "qwen/qwen-2.5-7b-instruct:free",
            ]
            for fb_model in fallback_models:
                try:
                    fallback_payload = {**payload, "model": fb_model}
                    async with httpx.AsyncClient() as client:
                        fb_resp = await client.post(
                            OPENROUTER_API_URL,
                            headers=headers,
                            json=fallback_payload,
                            timeout=20.0,
                        )
                        fb_resp.raise_for_status()
                        fb_data = fb_resp.json()
                        return fb_data["choices"][0]["message"]["content"]
                except Exception as fb_err:
                    logger.warning("Fallback to free model %s failed: %s", fb_model, fb_err)

        try:
            err_json = resp.json()
            err_message = err_json.get("error", {}).get("message") or str(err_json)
        except Exception:
            err_message = resp.text
        raise RuntimeError(f"OpenRouter HTTP error {resp.status_code}: {err_message}") from http_err

    data = resp.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected OpenRouter response format: {data}") from e


def _build_prompt(current_text: str, conversation_history: Optional[List[Dict]]) -> str:
    context_messages = []

    if conversation_history:
        logger.debug("Building LLM context with %s previous turns", len(conversation_history))
        for turn in conversation_history[-10:]:
            context_messages.append(f"User: {turn['user']}")
            context_messages.append(f"Assistant: {turn['ai']}")

    context_messages.append(f"User: {current_text}")
    return "\n".join(context_messages)


async def stream_llm_response(
    current_text: str,
    conversation_history: Optional[List[Dict]] = None,
    is_first_turn: bool = False,
    pronunciation_coach: Optional[Dict[str, Any]] = None,
    agent_name: Optional[str] = None,
    agent_instructions: Optional[str] = None,
    practice_state: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """Stream an LLM response as batched text chunks."""
    try:
        full_prompt = _build_prompt(current_text, conversation_history)
        logger.debug("Streaming OpenRouter response with prompt length %s", len(full_prompt))

        token_buffer = ""
        token_count = 0
        last_flush_time = time.time() * 1000

        reply_text = await _call_openrouter(
            full_prompt,
            pronunciation_coach,
            agent_name=agent_name,
            agent_instructions=agent_instructions,
            practice_state=practice_state,
        )

        words = reply_text.split()

        if is_first_turn:
            min_tokens = 10
            max_tokens = 30
            flush_interval_ms = 150
        else:
            min_tokens = 15
            max_tokens = 50
            flush_interval_ms = 300

        for word in words:
            token_buffer += (word + " ")
            token_count += 1
            current_time = time.time() * 1000
            should_flush = False

            if is_first_turn:
                if token_count >= min_tokens or (current_time - last_flush_time) >= flush_interval_ms:
                    should_flush = True
            else:
                if re.search(r'[.!?]\s*$', token_buffer):
                    should_flush = True
                elif token_count >= max_tokens:
                    should_flush = True
                elif token_count >= min_tokens and (current_time - last_flush_time) >= flush_interval_ms:
                    should_flush = True

            if should_flush and token_buffer.strip():
                yield token_buffer
                token_buffer = ""
                token_count = 0
                last_flush_time = current_time

            await asyncio.sleep(flush_interval_ms / 1000.0 / 10.0)

        if token_buffer.strip():
            yield token_buffer

    except Exception as e:
        logger.exception("OpenRouter streaming failed")

        error_str = str(e).lower()
        error_type = type(e).__name__

        if "quota" in error_str or "429" in error_str or "ResourceExhausted" in error_type:
            yield "API quota exceeded. Please check your OpenRouter account limits."
        elif "401" in error_str or "403" in error_str or "invalid" in error_str:
            yield "Invalid API key. Please check your OpenRouter configuration."
        elif isinstance(e, ValueError) and "Content blocked" in str(e):
            yield "I was blocked from answering that. Could you rephrase your message?"
        else:
            yield "Sorry, I couldn't generate a response. Please try again."


async def generate_coach_summary(
    agent_name: str,
    agent_instructions: str,
    accuracy: float,
    fluency: float,
    clarity: float,
    confidence: float,
    mispronounced_words: list,
    difficult_sounds: list,
) -> str:
    """Generate a personalized AI coach feedback paragraph at the end of a session."""
    prompt = (
        f"The user has completed a spoken English practice session with you ({agent_name}).\n"
        f"Instructions you follow: {agent_instructions}\n\n"
        "Here are their final scores:\n"
        f"- Pronunciation Accuracy: {accuracy:.0f}/100\n"
        f"- Fluency: {fluency:.0f}/100\n"
        f"- Clarity: {clarity:.0f}/100\n"
        f"- Confidence: {confidence:.0f}/100\n\n"
        f"Mispronounced words: {', '.join(mispronounced_words) if mispronounced_words else 'None'}\n"
        f"Difficult sounds identified: {', '.join(difficult_sounds) if difficult_sounds else 'None'}\n\n"
        "Please write a personalized, encouraging, and constructive coaching feedback paragraph (4-5 sentences) summarizing their performance. "
        "Address them as a supportive spoken English coach. Highlight what they did well, where they should focus next, and how they can improve. "
        "Keep it under 150 words. Do not output headings, bullet points, or generic introductions. Write it as a single cohesive paragraph."
    )

    try:
        if not settings.OPENROUTER_API_KEY:
            return "Excellent work today! You showed solid pronunciation accuracy and spoke clearly. For the next session, focus on your word pacing and practice vowel sounds."

        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
            "X-Title": os.getenv("OPENROUTER_APP_NAME", "TalkFlow"),
        }

        payload = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {
                    "role": "system",
                    "content": "You are TalkFlow, a highly experienced and supportive spoken English coach.",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.7,
            "max_tokens": 200,
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
                timeout=15.0,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.exception("Failed to generate coach summary via OpenRouter")
        return f"Fantastic job completing your practice session! Your accuracy reached {accuracy:.0f}%. Focus on practicing the tricky sounds like {', '.join(difficult_sounds) if difficult_sounds else 'TH and R'} in your next session, and keep speaking with confidence!"
