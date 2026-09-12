# main.py
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, voice_websocket, phonemes, practice

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if settings.ENABLE_ASR and settings.WARM_ASR_ON_STARTUP:
        try:
            from app.services.asr import warm_asr

            await asyncio.to_thread(warm_asr)
        except Exception:
            logger.exception("ASR warm failed")

    if settings.ENABLE_ACOUSTIC_SCORING and settings.WARM_ACOUSTIC_ON_STARTUP:
        try:
            from app.services.pronunciation.phoneme_recognizer import warm_phoneme_model

            await asyncio.to_thread(warm_phoneme_model)
        except Exception:
            logger.exception("Acoustic phoneme model warm failed; using text proxy")

    # Start session cleanup task
    from app.api.routes.voice_websocket import cleanup_stale_sessions

    cleanup_task = asyncio.create_task(cleanup_stale_sessions())
    logger.info("Started session cleanup background task in lifespan")

    # Prune persisted turn audio. This coroutine existed but was never started,
    # so `TURN_AUDIO_RETENTION_HOURS` was a promise in a docstring rather than a
    # policy -- files accumulated forever whenever PERSIST_TURN_AUDIO was on.
    from app.services.audio_store import sweep_old_audio_loop

    audio_sweep_task = asyncio.create_task(sweep_old_audio_loop())
    logger.info("Started turn-audio retention sweep in lifespan")

    yield

    # Shutdown
    for task, name in (
        (cleanup_task, "session cleanup"),
        (audio_sweep_task, "audio retention sweep"),
    ):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    logger.info("Stopped background tasks")


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Configure CORS.
# The localhost-on-any-port regex is a development convenience (the dev server
# moves between 3000/3001/3002). With allow_credentials=True it is exactly the
# kind of pattern that quietly lets an unexpected origin make credential-bearing
# requests in production, so it is gated on the environment and the wildcard
# method list is narrowed to what this API actually serves.
_cors_kwargs = {
    "allow_origins": settings.ALLOWED_ORIGINS,
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
}
if not settings.IS_PRODUCTION:
    _cors_kwargs["allow_origin_regex"] = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(CORSMiddleware, **_cors_kwargs)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(voice_websocket.router, tags=["Voice WebSocket"])
app.include_router(phonemes.router, tags=["Phonemes"])
app.include_router(practice.router, tags=["Practice"])

# There is one pronunciation scorer, not three. `/api/pronunciation/*` and
# `/api/pronunciation-analysis/*` used to expose a second, parallel scoring
# stack (penalty_engine + word/syllable/sentence_scoring + a WhisperX alignment
# provider) that the web app never called and that could not even start --
# WhisperX was the default `ALIGNMENT_PROVIDER` and was not in
# requirements.txt. Scoring now lives only in app/services/pronunciation/, and
# the HTTP surface the UI actually uses (phonemes/reference, phonemes/tts,
# practice/script) is all that remains.

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
