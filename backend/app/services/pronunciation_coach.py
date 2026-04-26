"""Slim, human-level pronunciation context for the LLM only (no raw phoneme arrays)."""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from typing import Any, Dict, List

_WORD_RE = re.compile(r"[a-z']+")

MAX_FEEDBACK_FOR_LLM = 3
MAX_MISALIGNED_WORDS = 5


def _words(text: str) -> List[str]:
    return _WORD_RE.findall((text or "").lower())


def misaligned_word_pairs(
    target_text: str,
    heard_text: str,
    max_pairs: int = MAX_MISALIGNED_WORDS,
) -> List[Dict[str, str]]:
    a = _words(target_text)
    b = _words(heard_text)
    if not a and not b:
        return []
    sm = SequenceMatcher(None, a, b, autojunk=False)
    out: List[Dict[str, str]] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        if tag == "replace":
            la, lb = i2 - i1, j2 - j1
            n = max(la, lb)
            for k in range(n):
                ew = a[i1 + k] if k < la else ""
                hw = b[j1 + k] if k < lb else ""
                if ew or hw:
                    out.append({"expected": ew, "heard": hw})
        elif tag == "delete":
            for k in range(i1, i2):
                out.append({"expected": a[k], "heard": ""})
        else:
            for k in range(j1, j2):
                out.append({"expected": "", "heard": b[k]})
    return out[:max_pairs]


def build_pronunciation_coach_for_llm(
    target_text: str,
    heard_text: str,
    score: float,
    feedback: List[str],
) -> Dict[str, Any]:
    fb = list(feedback or [])[:MAX_FEEDBACK_FOR_LLM]
    mis = misaligned_word_pairs(target_text, heard_text, MAX_MISALIGNED_WORDS)
    return {
        "target_text": (target_text or "").strip(),
        "heard_text": (heard_text or "").strip(),
        "score": round(float(score), 2),
        "feedback": fb,
        "misaligned_words": mis,
    }


def coach_json_for_prompt(coach: Dict[str, Any]) -> str:
    return json.dumps(coach, ensure_ascii=False)


PRONUNCIATION_COACH_SYSTEM_SUFFIX = (
    "PRONUNCIATION TASK: A JSON block labeled PRONUNCIATION_ASSESSMENT may appear at the end of the user message. "
    "You MUST use that JSON for pronunciation coaching.\n"
    "Rules:\n"
    "- Do NOT invent mistakes, mis-hearings, or scores not present in the JSON.\n"
    "- Do NOT contradict the score or the listed feedback lines.\n"
    "- If misaligned_words or feedback indicates a problem, mention at least one concrete word or issue from the JSON.\n"
    "- Rephrase feedback in natural, encouraging language; do not output raw phoneme symbols or long token lists.\n"
    "- Keep your entire reply to at most 3 sentences.\n"
)
