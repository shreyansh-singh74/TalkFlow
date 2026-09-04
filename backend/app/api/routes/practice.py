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

This endpoint is called server-side by the Next.js route handler when a
practice session is created; the returned script is persisted into
``practice_sessions.script`` and later replayed to the WebSocket engine. It
always returns 200 -- a degraded fallback script is preferable to a failed
session creation.
"""

import asyncio
import logging

from fastapi import APIRouter

from app.schemas.practice import PracticeScript, ScriptRequest
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


@router.post("/script", response_model=PracticeScript)
async def create_script(req: ScriptRequest) -> PracticeScript:
    """Generate a practice script. Never fails -- degrades to a fallback bank."""
    band = get_band(req.difficulty)

    if req.source == "custom":
        # Pure CPU and typically sub-millisecond, but a 20k-character paste is
        # still worth keeping off the event loop.
        script = await asyncio.to_thread(segment, req.source_text or "", band.name)
        if script.steps:
            return script
        logger.info("Custom text produced no steps; falling back to generated content")

    return await generate_from_topic(
        topic=req.topic or "",
        difficulty=band.name,
        step_count=req.step_count,
        accent=req.accent,
        focus_sounds=req.focus_sounds,
        coach_name=req.coach_name or "",
    )
