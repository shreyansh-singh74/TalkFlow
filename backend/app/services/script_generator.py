"""Generate a topic-driven practice script with the LLM, band-validated.

The contract this module owns: ``generate_from_topic`` **never raises and never
returns a short script**. Session creation is a form submit -- a flaky
OpenRouter call must not be able to block it. The degradation ladder is:

    LLM output -> validated against the difficulty band
      -> one bounded retry for whatever was rejected
        -> top up from FALLBACK_BANK (script tagged ``generated_by="fallback"``)

Validation is what makes difficulty real. Without it, "hard" is a word in a
prompt that the model is free to ignore; with it, an out-of-band sentence is
discarded regardless of what the model thought it was producing.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional, Tuple

from app.schemas.practice import PracticeScript, PracticeStep
from app.services.llm_response import _call_openrouter
from app.services.practice_content import (
    DifficultyBand,
    fallback_steps,
    get_band,
    validate_step,
)
from app.utils.text import tokenize_words

logger = logging.getLogger(__name__)

#: Ask for extra sentences so band rejections don't immediately cost a retry.
_OVERSHOOT = 4
_MAX_TOPIC_CHARS = 200

_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)

#: The live-coaching system prompt caps replies at three sentences, which would
#: silently truncate every script. Content generation gets its own.
_SYSTEM_PROMPT = (
    "You are a curriculum writer for a spoken-English pronunciation app.\n"
    "You produce practice sentences that meet exact structural constraints.\n"
    "You always respond with a bare JSON array of strings and nothing else."
)


def _build_prompt(
    topic: str,
    band: DifficultyBand,
    count: int,
    accent: str,
    focus_sounds: List[str],
    avoid: Optional[List[str]] = None,
) -> str:
    parts = [
        f"Write {count} English sentences for a spoken-pronunciation practice session.",
        f"Topic: {topic}",
        "",
        "Hard requirements for EVERY sentence:",
        f"- Between {band.min_words} and {band.max_words} words.",
        f"- No word longer than {band.max_syllables_per_word} syllables.",
    ]
    if band.min_multisyllabic > 0:
        parts.append(
            f"- At least {band.min_multisyllabic} word(s) of three or more syllables."
        )
    parts += [
        "- Natural, speakable English that a person would actually say out loud.",
        "- No numbers, no abbreviations, no bullet characters, no quotation marks.",
        "- Each sentence must be self-contained and make sense on its own.",
    ]
    if accent and accent != "en-US":
        parts.append(f"- Use vocabulary and spelling natural to {accent}.")
    if focus_sounds:
        parts.append(
            "- Where it sounds natural, include words featuring these sounds: "
            + ", ".join(focus_sounds[:6])
        )
    if avoid:
        parts += ["", "Do NOT repeat any of these sentences:"]
        parts += [f"- {s}" for s in avoid[:20]]
    parts += [
        "",
        'Respond with ONLY a JSON array of strings, e.g. ["First sentence.", "Second sentence."]',
        "No markdown fences, no commentary, no object wrapper.",
    ]
    return "\n".join(parts)


def _parse_sentences(raw: str) -> List[str]:
    """Pull a list of sentences out of whatever the model returned."""
    text = (raw or "").strip()
    if not text:
        return []

    # Strip markdown fences the model was told not to emit but often does.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()

    candidates: List[str] = []
    match = _JSON_ARRAY_RE.search(text)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list):
                candidates = [str(item) for item in parsed if isinstance(item, (str, int, float))]
        except json.JSONDecodeError:
            logger.debug("Model returned a non-JSON array-ish blob; falling back to line parsing")

    if not candidates:
        # Line-based rescue: numbered lists, bullets, or bare lines.
        for line in text.splitlines():
            cleaned = re.sub(r'^\s*(?:[-*•]|\d+[.)])\s*', "", line).strip()
            cleaned = cleaned.strip('"\'').strip()
            if cleaned and len(tokenize_words(cleaned)) >= 3:
                candidates.append(cleaned)

    out: List[str] = []
    for item in candidates:
        cleaned = " ".join(item.split()).strip().strip('"').strip()
        if cleaned:
            out.append(cleaned)
    return out


def _keep_valid(
    sentences: List[str], difficulty: str, seen: set
) -> Tuple[List[str], List[str]]:
    """Partition sentences into (accepted, rejected-with-reason-logged)."""
    accepted: List[str] = []
    rejected: List[str] = []
    for sentence in sentences:
        key = sentence.strip().lower()
        if key in seen:
            continue
        ok, reason = validate_step(sentence, difficulty)
        if ok:
            seen.add(key)
            accepted.append(sentence)
        else:
            rejected.append(sentence)
            logger.debug("Rejected generated step (%s): %s", reason, sentence)
    return accepted, rejected


async def _request(
    topic: str,
    band: DifficultyBand,
    count: int,
    accent: str,
    focus_sounds: List[str],
    avoid: Optional[List[str]] = None,
) -> List[str]:
    prompt = _build_prompt(topic, band, count, accent, focus_sounds, avoid)
    # Budget roughly two tokens per word plus JSON punctuation, so a long
    # `hard` script is never cut off mid-array.
    max_tokens = 120 + count * band.max_words * 2
    raw = await _call_openrouter(
        prompt,
        system_override=_SYSTEM_PROMPT,
        max_tokens_override=max_tokens,
        temperature=0.9,
    )
    return _parse_sentences(raw)


async def generate_from_topic(
    topic: str,
    difficulty: str = "medium",
    step_count: int = 10,
    accent: str = "en-US",
    focus_sounds: Optional[List[str]] = None,
    coach_name: str = "",
) -> PracticeScript:
    """Build a validated practice script for *topic*. Never raises."""
    band = get_band(difficulty)
    step_count = max(1, min(step_count, 40))
    clean_topic = " ".join((topic or "").split())[:_MAX_TOPIC_CHARS]
    focus = list(focus_sounds or [])

    accepted: List[str] = []
    seen: set = set()
    used_llm = False

    if clean_topic:
        for attempt in range(2):
            shortfall = step_count - len(accepted)
            if shortfall <= 0:
                break
            try:
                sentences = await _request(
                    clean_topic,
                    band,
                    shortfall + _OVERSHOOT,
                    accent,
                    focus,
                    avoid=accepted if attempt else None,
                )
            except Exception as exc:
                logger.warning("Script generation attempt %d failed: %s", attempt + 1, exc)
                break
            used_llm = True
            valid, _ = _keep_valid(sentences, band.name, seen)
            accepted.extend(valid)
    else:
        logger.info("No topic supplied; using the %s fallback bank", band.name)

    generated_by = "llm" if (used_llm and len(accepted) >= step_count) else "fallback"
    if len(accepted) < step_count:
        logger.info(
            "Topping up %s script from fallback bank (%d/%d valid from LLM)",
            band.name,
            len(accepted),
            step_count,
        )
        accepted.extend(fallback_steps(band.name, step_count - len(accepted), exclude=accepted))

    accepted = accepted[:step_count]

    label_topic = clean_topic or (coach_name.strip() if coach_name else "General practice")
    steps = [
        PracticeStep(index=i, text=text, word_count=len(tokenize_words(text)))
        for i, text in enumerate(accepted)
    ]

    return PracticeScript(
        steps=steps,
        difficulty=band.name,
        pass_threshold=band.pass_threshold,
        generated_by=generated_by,
        source_label=f"{label_topic} · {band.label}",
    )
