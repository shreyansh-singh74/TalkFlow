import asyncio
import json
import logging
import os
import re
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx

from app.core.config import settings
from app.services.l1_profiles import interference_note
from app.services.pronunciation_coach import PRONUNCIATION_COACH_SYSTEM_SUFFIX

# Suppress Google API warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '2'

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = settings.OPENROUTER_API_URL
OPENROUTER_MODEL = settings.OPENROUTER_MODEL


def _openrouter_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.OPENROUTER_SITE_URL,
        "X-Title": settings.OPENROUTER_APP_NAME,
    }


MAX_TOKENS_DEFAULT = 100
MAX_TOKENS_WITH_PRONUNCIATION_COACH = 120
BASE_SYSTEM_PROMPT = (
    "You are TalkFlow, a friendly spoken-English coach who talks like a supportive friend, not a textbook.\n"
    "Reply in at most 2 short sentences, plain speech, no preamble.\n"
    "Vary your opener every single turn — never start two replies in a row the same way, "
    "and never use 'Almost there. Let's try repeating this one' (that line is banned).\n"
    "Good openers (rotate, don't repeat): 'Nice try', 'Good effort', 'Getting closer', "
    "'I hear you', 'One small fix', or just jump straight to the tip.\n"
    "Name the single most important correction and nothing else.\n"
    "If practice is needed, say the target ONCE using exactly: repeat after me: <practice text>\n"
    "Never say the target sentence twice. Never use metaphors about coding, debugging, or compiling — coach speech sounds only.\n"
    "Punctuate for the ear: this reply is read aloud, so use commas for short pauses and periods for full stops. "
    "Never use quotes around a single practice word — say: Repeat after me: pronunciation.\n"
    "If pronunciation is good, celebrate briefly and move to the next item without repeating the old one."
)


async def _call_openrouter(
    prompt: str,
    pronunciation_coach: Optional[Dict[str, Any]] = None,
    coach_name: Optional[str] = None,
    coach_instructions: Optional[str] = None,
    practice_state: Optional[Dict[str, Any]] = None,
    system_override: Optional[str] = None,
    max_tokens_override: Optional[int] = None,
    temperature: float = 0.7,
    l1: Optional[str] = None,
) -> str:
    """Call OpenRouter chat completions and return the full response text.

    ``system_override``/``max_tokens_override`` exist so non-conversational
    callers (script generation) can reuse this client's headers, model choice,
    and 402 -> free-model fallback chain without inheriting the live-coaching
    system prompt, which caps replies at three sentences. ``l1`` only ever
    adds coaching vocabulary; it never changes how a turn is scored.
    """
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    headers = _openrouter_headers()

    system_parts = [system_override or BASE_SYSTEM_PROMPT]
    if not system_override and (coach_name or coach_instructions):
        system_parts.append(
            "Selected coach:\n"
            f"Name: {coach_name or 'TalkFlow Coach'}\n"
            f"Instructions: {coach_instructions or 'General spoken English practice.'}"
        )
    if pronunciation_coach:
        system_parts.append(PRONUNCIATION_COACH_SYSTEM_SUFFIX)
    if l1 and not system_override and settings.L1_AWARE_ENABLED:
        # Telling the coach which sounds this learner's first language typically
        # interferes with turns a generic "name one correction" instruction into
        # a prediction it can confirm or drop on the evidence of the turn.
        note = interference_note(l1)
        if note:
            system_parts.append(note)
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
            + "\nThe next target is: "
            + str(practice_state.get("target_text", ""))
            + "\nOnly say it aloud if the turn needs repeating (weak score). "
              "Say it at most once per reply."
        )

    if pronunciation_coach or practice_state:
        user_content = prompt + "\n\n" + "\n\n".join(extra_blocks)
        max_tokens = MAX_TOKENS_WITH_PRONUNCIATION_COACH
    else:
        user_content = prompt
        max_tokens = MAX_TOKENS_DEFAULT

    if max_tokens_override:
        max_tokens = max_tokens_override

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_content,
            },
            {"role": "user", "content": user_content},
        ],
        "temperature": temperature,
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
            fallback_models = settings.OPENROUTER_FALLBACK_MODELS
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
    coach_name: Optional[str] = None,
    coach_instructions: Optional[str] = None,
    practice_state: Optional[Dict[str, Any]] = None,
    l1: Optional[str] = None,
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
            coach_name=coach_name,
            coach_instructions=coach_instructions,
            practice_state=practice_state,
            l1=l1,
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


def _fmt_metric(label: str, value: Optional[float], suffix: str = "/100") -> str:
    """One metric line, or an explicit 'not measured' -- never a made-up number."""
    if value is None:
        return f"- {label}: not measured this session"
    return f"- {label}: {value:.0f}{suffix}"


#: Situations the engine narrates. Each gets a one-line brief; the model
#: renders it against the turn context, so no two learners hear the same line.
_COACH_LINE_BRIEFS = {
    "pass": "Celebrate passing this step warmly and briefly, like a friend. Name what sounded good.",
    "advance": "Celebrate moving to the next step. Mention what is coming next in one breath.",
    "stuck": "Encourage another try without repeating any fixed phrase. Name the one sound or word to fix.",
    "complete": "Congratulate finishing ALL steps. Keep it warm and short.",
    "gate": "Explain plainly why the step is not passed yet, using the numbers given. Encourage one more try.",
    "rate_limit": "Gently tell them they are rushing turns and to take a breath before trying again.",
    "empty_report": "Explain kindly that nothing was scored yet, so there is no report — they should practise at least one step first.",
    "already_done": "Tell them this session was already summarised.",
}


async def generate_coach_line(
    *,
    situation: str,
    context: str,
    coach_name: Optional[str] = None,
    coach_instructions: Optional[str] = None,
    fallback: str,
    max_tokens: int = 60,
) -> str:
    """One short contextual coach line for an engine event.

    ``situation`` is one of ``_COACH_LINE_BRIEFS``; ``context`` carries the
    live facts (score, sentence just attempted, next step, progress...).
    Returns ``fallback`` when the LLM is unreachable — the fallback is a last
    resort for outages, never the product voice.
    """
    brief = _COACH_LINE_BRIEFS.get(situation, "Say something warm and brief that fits the context.")
    prompt = (
        f"You are {coach_name or 'TalkFlow'}, a friendly spoken-English coach who talks like a supportive friend.\n"
        f"Coach style: {coach_instructions or 'Warm, brief, encouraging.'}\n\n"
        f"Situation: {brief}\n\n"
        f"Live context:\n{context}\n\n"
        "Write exactly ONE short line (1-2 sentences, under 30 words). "
        "Vary your wording — never reuse a fixed catchphrase. "
        "No headings, no quotes around the whole line, no preamble."
    )
    try:
        if not settings.OPENROUTER_API_KEY:
            return fallback
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                OPENROUTER_API_URL,
                headers=_openrouter_headers(),
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": "You are a warm, concise spoken-English coach."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.9,
                    "max_tokens": max_tokens,
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip().strip('"')
    except Exception:
        logger.exception("generate_coach_line failed for situation %s", situation)
        return fallback


async def generate_coach_summary(
    coach_name: str,
    coach_instructions: str,
    overall: Optional[float],
    accuracy: Optional[float],
    fluency: Optional[float],
    wpm: Optional[float],
    mispronounced_words: list,
    difficult_sounds: list,
) -> str:
    """Generate a personalized AI coach feedback paragraph at the end of a session.

    Metrics that were not measured are passed through as ``None`` and described
    as such, so the model cannot narrate a fabricated pause length or fluency
    figure back to the learner.
    """
    prompt = (
        f"The user has completed a spoken English practice session with you ({coach_name}).\n"
        f"Instructions you follow: {coach_instructions}\n\n"
        "Here is what was measured:\n"
        + _fmt_metric("Overall score", overall)
        + "\n"
        + _fmt_metric("Pronunciation accuracy", accuracy)
        + "\n"
        + _fmt_metric("Consistency (fluency)", fluency)
        + "\n"
        + _fmt_metric("Speaking rate", wpm, " words per minute")
        + "\n\n"
        f"Mispronounced words: {', '.join(mispronounced_words) if mispronounced_words else 'None detected'}\n"
        f"Sounds they struggled with: {', '.join(difficult_sounds) if difficult_sounds else 'None stood out'}\n\n"
        "Please write a short, encouraging coaching feedback paragraph (2-3 sentences, under 80 words) summarizing their performance. "
        "Name the single weakest sound or word, one thing done well, and the one thing to drill next. "
        "Only reference metrics listed above; never invent a number, and say nothing about anything marked 'not measured'. "
    )

    fallback = (
        "Nice work getting through this session. "
        + (
            f"You struggled most with {', '.join(difficult_sounds[:2])} — drill those next. "
            if difficult_sounds
            else "Keep practising to build up enough data for sound-level feedback. "
        )
        + "Keep sessions short and regular; consistency matters more than any single score."
    )

    try:
        if not settings.OPENROUTER_API_KEY:
            return fallback

        headers = _openrouter_headers()

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
    except Exception:
        logger.exception("Failed to generate coach summary via OpenRouter")
        return fallback
