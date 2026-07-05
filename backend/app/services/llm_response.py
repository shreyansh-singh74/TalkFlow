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
    "You are an English-speaking coach helping users improve conversational English.\n"
    "Be concise and encouraging. Keep responses to 2-3 sentences.\n"
    "If you notice grammar errors, gently correct them and ask the user to repeat.\n"
    "Ask follow-up questions to keep the conversation going.\n"
    "Remember the context of previous messages in the conversation."
)


async def _call_openrouter(
    prompt: str, pronunciation_coach: Optional[Dict[str, Any]] = None
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

    if pronunciation_coach:
        system_content = BASE_SYSTEM_PROMPT + "\n\n" + PRONUNCIATION_COACH_SYSTEM_SUFFIX
        user_content = (
            prompt
            + "\n\nPRONUNCIATION_ASSESSMENT:\n"
            + json.dumps(pronunciation_coach, ensure_ascii=False)
        )
        max_tokens = MAX_TOKENS_WITH_PRONUNCIATION_COACH
    else:
        system_content = BASE_SYSTEM_PROMPT
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
) -> AsyncGenerator[str, None]:
    """Stream an LLM response as batched text chunks."""
    try:
        full_prompt = _build_prompt(current_text, conversation_history)
        logger.debug("Streaming OpenRouter response with prompt length %s", len(full_prompt))

        token_buffer = ""
        token_count = 0
        last_flush_time = time.time() * 1000

        reply_text = await _call_openrouter(full_prompt, pronunciation_coach)

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

