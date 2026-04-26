import os
import asyncio
import json
import time
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from functools import partial
from typing import List, Dict, Optional, AsyncGenerator, Any

import requests

from app.core.config import settings
from app.services.pronunciation_coach import PRONUNCIATION_COACH_SYSTEM_SUFFIX

# Suppress Google API warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '2'

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.0-flash-001")

MAX_TOKENS_DEFAULT = 150
MAX_TOKENS_WITH_PRONUNCIATION_COACH = 256
BASE_SYSTEM_PROMPT = (
    "You are an English-speaking coach helping users improve conversational English.\n"
    "Be concise and encouraging. Keep responses to 2-3 sentences.\n"
    "If you notice grammar errors, gently correct them and ask the user to repeat.\n"
    "Ask follow-up questions to keep the conversation going.\n"
    "Remember the context of previous messages in the conversation."
)


def _call_openrouter(
    prompt: str, pronunciation_coach: Optional[Dict[str, Any]] = None
) -> str:
    """
    Call OpenRouter chat completions API and return the full response text.
    This replaces the direct Gemini SDK call, but keeps the same prompt shape.
    When pronunciation_coach is set, appends human-level JSON only (no phoneme arrays).
    """
    if not settings.OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        # Optional but recommended by OpenRouter for rate‑limiting/attribution
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
        resp = requests.post(
            OPENROUTER_API_URL,
            headers=headers,
            json=payload,
            timeout=20,
        )
    except Exception as e:  # Network error, timeout, etc.
        raise RuntimeError(f"Failed to call OpenRouter: {e}") from e

    # Raise for HTTP errors so we can handle them consistently below
    try:
        resp.raise_for_status()
    except requests.HTTPError as http_err:
        # Try to include any error payload from OpenRouter
        try:
            err_json = resp.json()
            err_message = err_json.get("error", {}).get("message") or str(err_json)
        except Exception:
            err_message = resp.text
        raise RuntimeError(f"OpenRouter HTTP error {resp.status_code}: {err_message}") from http_err

    data = resp.json()
    # Expected shape: {"choices": [{"message": {"content": "..."}, ...}], ...}
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Unexpected OpenRouter response format: {data}") from e

async def stream_gemini_response(
    current_text: str,
    conversation_history: Optional[List[Dict]] = None,
    is_first_turn: bool = False,
    pronunciation_coach: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """
    Stream AI response tokens from Gemini with conversation context

    Args:
        current_text: The current user's message
        conversation_history: List of previous turns
        is_first_turn: If True, uses Policy A (fast), else Policy B (punctuation-aware)
        pronunciation_coach: Optional slim dict (target, heard, score, top feedback,
            misaligned_words) for OpenRouter; no phoneme arrays.
    Yields:
        Text chunks (tokens batched by policy)
    """
    try:
        # Build conversation context
        context_messages = []
        
        if conversation_history:
            print(f"Building context with {len(conversation_history)} previous turns")
            for turn in conversation_history[-10:]:  # Keep last 10 turns
                context_messages.append(f"User: {turn['user']}")
                context_messages.append(f"Assistant: {turn['ai']}")
        
        context_messages.append(f"User: {current_text}")
        full_prompt = "\n".join(context_messages)
        
        print(f"Streaming OpenRouter (Gemini via OpenRouter) with context (length: {len(full_prompt)} chars)")
        
        # Token batching buffer
        token_buffer = ""
        token_count = 0
        last_flush_time = time.time() * 1000  # ms
        
        # Policy parameters
        # We call OpenRouter once to get the full reply, then
        # apply the same batching policies as before on the text.
        loop = asyncio.get_event_loop()
        reply_text = await loop.run_in_executor(
            None, partial(_call_openrouter, full_prompt, pronunciation_coach)
        )

        # Split reply text into "tokens" (space‑separated words) and stream
        words = reply_text.split()

        if is_first_turn:
            # Policy A: Low latency (10-30 tokens or 100-200ms)
            min_tokens = 10
            max_tokens = 30
            flush_interval_ms = 150  # 150ms
            print("Using Policy A (low latency)")
        else:
            # Policy B: Punctuation-aware (flush on sentence end or N tokens)
            min_tokens = 15
            max_tokens = 50
            flush_interval_ms = 300  # 300ms
            print("Using Policy B (punctuation-aware)")

        for word in words:
            token_buffer += (word + " ")
            token_count += 1
            current_time = time.time() * 1000  # ms

            # Flush conditions
            should_flush = False

            if is_first_turn:
                # Policy A: Time-based or token count
                if token_count >= min_tokens or (current_time - last_flush_time) >= flush_interval_ms:
                    should_flush = True
            else:
                # Policy B: Punctuation-aware
                if re.search(r'[.!?]\s*$', token_buffer):  # Sentence end
                    should_flush = True
                elif token_count >= max_tokens:
                    should_flush = True
                elif token_count >= min_tokens and (current_time - last_flush_time) >= flush_interval_ms:
                    should_flush = True

            if should_flush and token_buffer.strip():
                print(f"💬 Flushing: {len(token_buffer)} chars, {token_count} tokens")
                yield token_buffer
                token_buffer = ""
                token_count = 0
                last_flush_time = current_time

            # Small sleep to avoid hammering the event loop
            await asyncio.sleep(flush_interval_ms / 1000.0 / 10.0)
        
        # Flush remaining
        if token_buffer.strip():
            print(f"💬 Final flush: {len(token_buffer)} chars")
            yield token_buffer
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Gemini Streaming Error: {type(e).__name__}: {e}")
        print(f"Full traceback:\n{error_details}")
        
        # Handle specific error types
        error_str = str(e).lower()
        error_type = type(e).__name__
        
        if "quota" in error_str or "429" in error_str or "ResourceExhausted" in error_type:
            yield "API quota exceeded. Please get a new Gemini API key from https://aistudio.google.com/app/apikey"
        elif "401" in error_str or "403" in error_str or "invalid" in error_str:
            yield "Invalid API key. Please check your Gemini API configuration."
        elif isinstance(e, ValueError) and "Content blocked" in str(e):
            yield "I was blocked from answering that. Could you rephrase your message?"
        else:
            yield "Sorry, I couldn't generate a response. Please try again."


def _call_gemini(prompt: str) -> str:
    """
    Backwards-compatible wrapper that now calls OpenRouter instead of the
    deprecated direct Gemini SDK. Kept for existing callers.
    """
    return _call_openrouter(prompt)

def get_gemini_response(
    current_text: str,
    conversation_history: Optional[List[Dict]] = None
) -> str:
    """
    Generate AI response using Gemini with conversation context
    
    Args:
        current_text: The current user's message
        conversation_history: List of previous turns [{"user": str, "ai": str, "turn": int}]
    
    Returns:
        AI response text
    """
    try:
        # Build conversation context
        context_messages = []
        
        if conversation_history:
            print(f"Building context with {len(conversation_history)} previous turns")
            for turn in conversation_history:
                context_messages.append(f"User: {turn['user']}")
                context_messages.append(f"Assistant: {turn['ai']}")
        
        # Add current message
        context_messages.append(f"User: {current_text}")
        
        # Create full prompt with context
        full_prompt = "\n".join(context_messages)
        
        print(f"Calling Gemini with context (total length: {len(full_prompt)} chars)")
        if conversation_history:
            print(f"Current: '{current_text}'")
        else:
            print(f"Calling Gemini for: '{current_text}'")
        
        # Use ThreadPoolExecutor with timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_gemini, full_prompt)
            try:
                reply_text = future.result(timeout=10)  # 10 second timeout
                print(f"AI Response: {reply_text[:100]}...")
                return reply_text
            except TimeoutError:
                print("Gemini timeout after 10 seconds")
                return "I'm thinking too long. Can you try again?"
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Gemini Error: {type(e).__name__}: {e}")
        print(f"Full traceback:\n{error_details}")
        
        # Handle specific error types
        error_str = str(e).lower()
        error_type = type(e).__name__
        
        if "quota" in error_str or "429" in error_str or "ResourceExhausted" in error_type:
            return "API quota exceeded. Please get a new Gemini API key from https://aistudio.google.com/app/apikey"
        elif "401" in error_str or "403" in error_str or "invalid" in error_str:
            return "Invalid API key. Please check your Gemini API configuration."
        elif isinstance(e, ValueError) and "Content blocked" in str(e):
            return "I was blocked from answering that. Could you rephrase your question?"
        
        return "Sorry, I couldn't generate a response. Please try again."
