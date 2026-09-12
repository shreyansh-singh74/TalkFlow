# app/api/routes/practice.py
"""Practice-content generation.

Endpoints
---------
POST /api/practice/script
    Build a practice script from either a coach's topic + difficulty (LLM,
    band-validated) or the user's own pasted text (deterministic segmentation).

GET /api/practice/difficulty
    The difficulty bands, so the web app renders the same numbers the scorer
    enforces instead of hardcoding its own copy of them.

GET /api/practice/accents
    The target-accent profiles scoring and TTS are built from.

GET /api/practice/l1-profiles
    First-language interference profiles, so the onboarding picker and the
    coaching prompt read the same table.

Script generation is called server-side by the Next.js route handler when a
practice session is created; the returned script is persisted into
``practice_sessions.script`` and later replayed to the WebSocket engine. It
always returns 200 -- a degraded fallback script is preferable to a failed
session creation -- but it is *internal*: it spends OpenRouter credit, so it is
behind the shared-secret guard in app/core/internal_auth.py.
"""

import asyncio
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.internal_auth import require_internal_caller
from app.schemas.practice import PracticeScript, ScriptRequest
from app.services.audio_store import delete_session_audio
from app.services.pronunciation.accents import (
    DEFAULT_ACCENT,
    accent_choices,
    resolve_accent_code,
)
from app.services.l1_profiles import l1_choices, merge_focus_sounds, weak_phones_for
from app.services.practice_content import DIFFICULTY_BANDS, get_band
from app.services.script_generator import generate_from_topic
from app.services.text_segmenter import segment

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/practice", tags=["practice"])


@router.get("/difficulty")
async def get_difficulty_bands() -> dict:
    """Expose the difficulty bands as the single source of truth for the UI."""
    return {
        "bands": [
            {
                "name": band.name,
                "label": band.label,
                "min_words": band.min_words,
                "max_words": band.max_words,
                "pass_threshold": band.pass_threshold,
                "description": band.description,
            }
            for band in DIFFICULTY_BANDS.values()
        ]
    }


@router.get("/accents")
async def get_accents() -> dict:
    """The accent picker's options, from the profiles the scorer uses."""
    return {"default": DEFAULT_ACCENT, "accents": accent_choices()}


@router.get("/l1-profiles")
async def get_l1_profiles() -> dict:
    """First-language interference profiles for onboarding and drills."""
    return {"profiles": l1_choices()}


class PurgeAudioRequest(BaseModel):
    session_ids: List[str] = Field(default_factory=list, max_length=500)


@router.post("/audio/purge")
async def purge_audio(
    req: PurgeAudioRequest, _internal: None = Depends(require_internal_caller)
) -> dict:
    """Delete retained turn audio for the given sessions (learner-initiated).

    Internal, like script generation: the web app resolves "which sessions" from
    the authenticated user's rows, so a caller can only ever ask for audio it
    already owns. Deleting a file that is not there is a no-op, not an error, so
    the control is safe to press twice.
    """
    deleted = await asyncio.to_thread(_purge_many, req.session_ids)
    return {"deleted": deleted, "sessions": len(req.session_ids)}


def _purge_many(session_ids: Optional[List[str]]) -> int:
    total = 0
    for session_id in session_ids or []:
        total += delete_session_audio(session_id)
    return total


@router.post("/script", response_model=PracticeScript)
async def create_script(
    req: ScriptRequest, _internal: None = Depends(require_internal_caller)
) -> PracticeScript:
    """Generate a practice script. Never fails -- degrades to a fallback bank."""
    band = get_band(req.difficulty)

    if req.source == "custom":
        # Pure CPU and typically sub-millisecond, but a 20k-character paste is
        # still worth keeping off the event loop.
        script = await asyncio.to_thread(segment, req.source_text or "", band.name)
        if script.steps:
            return script
        logger.info("Custom text produced no steps; falling back to generated content")

    # An explicit coach focus sound outranks an L1 prediction, but when the coach
    # has none the learner's first language supplies the bias -- that is the
    # whole point of storing it. Never overrides, only fills in.
    focus_sounds = req.focus_sounds
    if req.l1 and settings.L1_AWARE_ENABLED and not focus_sounds:
        predicted = weak_phones_for(req.l1)
        if predicted:
            focus_sounds = merge_focus_sounds(focus_sounds, predicted)
            logger.info(
                "L1-aware content bias: %s -> focus %s", req.l1, focus_sounds
            )

    return await generate_from_topic(
        topic=req.topic or "",
        difficulty=band.name,
        step_count=req.step_count,
        accent=resolve_accent_code(req.accent),
        focus_sounds=focus_sounds,
        coach_name=req.coach_name or "",
    )
