# app/api/routes/pronunciation.py
"""Pronunciation API routes (Phase 2 Forced Alignment).

Endpoints
---------
POST /api/pronunciation/align
    Align audio against expected text transcript.
    Returns AlignmentResult with word and phoneme timestamps, viseme IDs,
    observed durations, and alignment source markers.
"""

import asyncio
import base64
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.schemas.alignment import AlignmentResult
from app.services.alignment_service import alignment_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation"])


class AlignRequest(BaseModel):
    text: str = Field(..., description="Expected target sentence/transcript text", example="I want to speak naturally")
    audio_b64: str = Field(..., description="Base64-encoded PCM16 mono 16kHz audio data")
    language: str = Field("en", description="Language code for forced alignment")


@router.post("/align", response_model=AlignmentResult)
async def align_pronunciation(req: AlignRequest) -> AlignmentResult:
    """Perform forced alignment on provided audio and expected transcript."""
    if not settings.ENABLE_ALIGNMENT:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Forced alignment feature is currently disabled",
        )

    clean_text = (req.text or "").strip()
    if not clean_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transcript text is required",
        )

    if not req.audio_b64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Base64 audio data is required",
        )

    try:
        audio_pcm = base64.b64decode(req.audio_b64)
    except Exception as e:
        logger.warning("Failed to decode base64 audio payload: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid base64 encoding for audio payload",
        )

    if not audio_pcm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decoded audio data is empty",
        )

    try:
        timeout_sec = settings.ALIGNMENT_TIMEOUT_SECONDS
        result = await asyncio.wait_for(
            alignment_service.align(
                audio_pcm=audio_pcm,
                transcript=clean_text,
                language=req.language,
            ),
            timeout=timeout_sec,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("Alignment request timed out after %.1f seconds", settings.ALIGNMENT_TIMEOUT_SECONDS)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Forced alignment processing timed out",
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        logger.exception("Forced alignment endpoint encountered an error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Alignment processing failed: {exc}",
        )
