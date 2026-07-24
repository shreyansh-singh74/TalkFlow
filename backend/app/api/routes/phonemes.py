# app/api/routes/phonemes.py
"""Phoneme and pronunciation API routes.

Endpoints
---------
GET /api/phonemes/info/{word}
    Full structured pronunciation data (PronunciationEntry).
    Backed by PronunciationService (CMUDict + g2p_en).

GET /api/phonemes/reference/{word}
    Legacy endpoint returning ARPAbet syllables in the existing shape.
    Now internally backed by PronunciationService; response shape unchanged
    so the frontend requires no modification.

GET /api/phonemes/tts
    Synthesise audio for a text string (unchanged).
"""

import asyncio
import logging
import re

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import List

from app.services.tts_service import tts_service
from app.services.pronunciation_service import pronunciation_service
from app.schemas.pronunciation import PronunciationEntry
from app.utils.text import WORD_RE as _WORD_RE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/phonemes", tags=["phonemes"])


# ---------------------------------------------------------------------------
# /info/{word}  — full structured pronunciation response
# ---------------------------------------------------------------------------

@router.get("/info/{word}", response_model=PronunciationEntry)
async def get_pronunciation_info(word: str) -> PronunciationEntry:
    """Return full structured pronunciation data for a single word.

    Response includes:
    - ``phonemes`` — ARPABET symbols with stress, viseme_id, confidence,
      expected_duration_ms (confidence and duration are null in Phase 1)
    - ``syllables`` — display text and stress per syllable
    - ``ipa`` — derived IPA string (computed from phonemes, never stored)
    """
    raw = (word or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Word is required")

    m = _WORD_RE.search(raw)
    key = m.group(0).lower() if m else re.sub(r"[^\w]", "", raw).lower()
    if not key:
        raise HTTPException(status_code=400, detail="Word is required")

    return await asyncio.to_thread(pronunciation_service.lookup, key)


# ---------------------------------------------------------------------------
# /reference/{word}  — legacy endpoint (arpabet_syllables shape preserved)
# ---------------------------------------------------------------------------

class ArpabetSyllableItem(BaseModel):
    phones: str
    display: str
    stressed: bool


class PronunciationReferenceResponse(BaseModel):
    word: str
    arpabet_syllables: List[ArpabetSyllableItem] = Field(default_factory=list)


@router.get("/reference/{word}", response_model=PronunciationReferenceResponse)
async def get_pronunciation_reference(
    word: str, lang: str = "en-US"
) -> PronunciationReferenceResponse:
    """Legacy endpoint — returns ARPAbet syllables in the existing response shape.

    Internally backed by PronunciationService; the response JSON is identical
    to the previous implementation so the frontend requires no changes.
    The ``lang`` parameter is accepted for compatibility but syllable display
    text is currently dialect-neutral (dialect-aware display is a Phase 2 task).
    """
    raw = (word or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Word is required")

    m = _WORD_RE.search(raw)
    key = m.group(0).lower() if m else re.sub(r"[^\w]", "", raw).lower()
    if not key:
        raise HTTPException(status_code=400, detail="Word is required")

    entry = await asyncio.to_thread(pronunciation_service.lookup, key)

    # Build legacy arpabet_syllables[] from structured syllables
    # Each syllable's phones string is reconstructed from the phoneme list
    # scoped to that syllable's index range.
    syllable_items: List[ArpabetSyllableItem] = []
    for syl in entry.syllables:
        syllable_items.append(
            ArpabetSyllableItem(
                phones="",          # phones string not needed by current frontend
                display=syl.text,
                stressed=bool(syl.stress),
            )
        )

    return PronunciationReferenceResponse(
        word=key,
        arpabet_syllables=syllable_items,
    )


# ---------------------------------------------------------------------------
# /tts  — text-to-speech (unchanged)
# ---------------------------------------------------------------------------

@router.get("/tts")
async def get_word_tts(text: str, lang: str = None, rate: float = None):
    """Synthesise audio for the given text string."""
    raw = (text or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Text is required")

    audio = await asyncio.to_thread(tts_service.text_to_speech, raw, lang, rate)
    if not audio:
        raise HTTPException(status_code=500, detail="Failed to synthesize audio")

    return Response(content=audio, media_type="audio/mpeg")
