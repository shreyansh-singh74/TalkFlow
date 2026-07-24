# app/api/routes/pronunciation_analysis.py
"""Pronunciation Analysis API routes (Phase 3B Scoring & Analysis Engine).

Endpoints
---------
POST /api/pronunciation/analyze
    Runs full end-to-end pipeline:
      Audio + Transcript -> Forced Alignment -> Comparison -> Scoring -> Analysis
    Returns structured PronunciationAnalysis with explainable penalty breakdowns.
"""

import asyncio
import base64
import logging
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.schemas.pronunciation_analysis import PronunciationAnalysis
from app.services.pronunciation_analysis_service import pronunciation_analysis_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pronunciation", tags=["pronunciation-analysis"])


class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="Expected target sentence/transcript text", example="I want to speak naturally")
    audio_b64: str = Field(..., description="Base64-encoded PCM16 mono 16kHz audio data")
    language: str = Field("en", description="Language code for alignment & analysis")


@router.post("/analyze", response_model=PronunciationAnalysis)
async def analyze_pronunciation(req: AnalyzeRequest) -> PronunciationAnalysis:
    """Perform full deterministic pronunciation analysis on provided audio and target transcript.

    Response includes:
    - ``overall_score``, ``pronunciation_score``, ``completeness_score`` [0.0 - 100.0]
    - ``fluency_score`` (null in Phase 3B)
    - Per-word and per-syllable breakdowns
    - Per-phoneme itemized ``penalty_breakdown`` explaining all deductions
    """
    if not settings.ENABLE_ALIGNMENT:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pronunciation analysis pipeline is currently disabled",
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
        analysis = await asyncio.wait_for(
            pronunciation_analysis_service.analyze_audio(
                audio_pcm=audio_pcm,
                transcript=clean_text,
                language=req.language,
            ),
            timeout=timeout_sec,
        )
        return analysis
    except asyncio.TimeoutError:
        logger.warning("Pronunciation analysis timed out after %.1f seconds", settings.ALIGNMENT_TIMEOUT_SECONDS)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Pronunciation analysis processing timed out",
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )
    except Exception as exc:
        logger.exception("Pronunciation analysis endpoint encountered an error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pronunciation analysis failed: {exc}",
        )
