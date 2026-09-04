# app/api/routes/phonemes.py
"""Phoneme and pronunciation API routes.

Endpoints
---------
GET /api/phonemes/info/{word}
    Full structured pronunciation data (PronunciationEntry).
    Backed by PronunciationService (CMUDict + g2p_en).

GET /api/phonemes/reference/{word}
    ARPAbet syllables for the pronunciation card, plus the per-phone list
    (``viseme_id``, ``syllable_index``) that drives the mouth-shape animation.
    Backed by PronunciationService.

GET /api/phonemes/tts
    Synthesise audio for a text string.
"""

import asyncio
import logging
import re

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import List

from app.services.tts_service import tts_service
from app.services.pronunciation_service import pronunciation_service
from app.schemas.pronunciation import PhonemeEntry, PronunciationEntry
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
    #: Primary stress only, so exactly one syllable is highlighted even when the
    #: word also carries secondary stress.
    stressed: bool
    #: Real ARPABET level: 1 primary, 2 secondary, 0 unstressed.
    stress_level: int = 0


class PronunciationReferenceResponse(BaseModel):
    word: str
    arpabet_syllables: List[ArpabetSyllableItem] = Field(default_factory=list)
    #: Derived IPA for the whole word.
    ipa: str = ""
    #: Per-phone data, in articulation order. Carries ``viseme_id`` and
    #: ``syllable_index``, which is what drives the mouth-shape animation.
    phonemes: List[PhonemeEntry] = Field(default_factory=list)


@router.get("/reference/{word}", response_model=PronunciationReferenceResponse)
async def get_pronunciation_reference(
    word: str, lang: str = "en-US"
) -> PronunciationReferenceResponse:
    """Return ARPAbet syllables plus per-phone data for a single word.

    The ``arpabet_syllables`` shape is preserved for existing consumers;
    ``ipa`` and ``phonemes`` are additive.  The ``lang`` parameter is accepted
    for compatibility but syllable display text is currently dialect-neutral
    (dialect-aware display is a Phase 2 task) — note that ``/tts`` *does*
    honour it, so a non-US dialect plays a voice whose phone sequence may
    differ slightly from the General-American one described here.
    """
    raw = (word or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Word is required")

    m = _WORD_RE.search(raw)
    key = m.group(0).lower() if m else re.sub(r"[^\w]", "", raw).lower()
    if not key:
        raise HTTPException(status_code=400, detail="Word is required")

    entry = await asyncio.to_thread(pronunciation_service.lookup, key)

    # Group phones by the syllable index each one already carries, so the
    # per-syllable `phones` string and the flat `phonemes` list cannot disagree.
    phones_by_syllable: List[List[str]] = [[] for _ in entry.syllables]
    for phoneme in entry.phonemes:
        if 0 <= phoneme.syllable_index < len(phones_by_syllable):
            phones_by_syllable[phoneme.syllable_index].append(phoneme.symbol)

    syllable_items = [
        ArpabetSyllableItem(
            phones=" ".join(phones_by_syllable[i]),
            display=syl.text,
            stressed=syl.stress == 1,
            stress_level=syl.stress,
        )
        for i, syl in enumerate(entry.syllables)
    ]

    return PronunciationReferenceResponse(
        word=key,
        arpabet_syllables=syllable_items,
        ipa=entry.ipa,
        phonemes=entry.phonemes,
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

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            # Synthesis for a given (text, lang, rate) is deterministic, and a
            # learner replays the same word repeatedly. Caching removes the
            # synthesis round trip from every replay — which also removes the
            # gap between pressing play and the mouth starting to move.
            "Cache-Control": "public, max-age=86400, immutable",
        },
    )
