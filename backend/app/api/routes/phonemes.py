# app/api/routes/phonemes.py
import logging
import re
import asyncio
from typing import List

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from app.services.tts_service import tts_service
from app.services.phoneme_analysis_service import phoneme_analyzer
from app.services.phoneme_respelling_service import phoneme_respelling_service
from app.utils.text import WORD_RE as _WORD_RE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/phonemes", tags=["phonemes"])


class ArpabetSyllableItem(BaseModel):
    phones: str
    display: str
    stressed: bool


class PronunciationReferenceResponse(BaseModel):
    word: str
    arpabet_syllables: List[ArpabetSyllableItem] = Field(default_factory=list)


@router.get("/reference/{word}", response_model=PronunciationReferenceResponse)
async def get_pronunciation_reference(word: str, lang: str = "en-US") -> PronunciationReferenceResponse:
    raw = (word or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Word is required")
    m = _WORD_RE.search(raw)
    key = m.group(0).lower() if m else re.sub(r"[^\w]", "", raw).lower()
    if not key:
        raise HTTPException(status_code=400, detail="Word is required")
    
    rows = await phoneme_respelling_service.get_dialect_respelling(key, lang)
    return PronunciationReferenceResponse(
        word=key,
        arpabet_syllables=[ArpabetSyllableItem(**r) for r in rows],
    )


@router.get("/tts")
async def get_word_tts(text: str, lang: str = None, rate: float = None):
    raw = (text or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Text is required")

    audio = await asyncio.to_thread(tts_service.text_to_speech, raw, lang, rate)
    if not audio:
        raise HTTPException(status_code=500, detail="Failed to synthesize audio")

    return Response(content=audio, media_type="audio/mpeg")
