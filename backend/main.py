# main.py
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, voice_websocket, phonemes, pronunciation, pronunciation_analysis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if settings.ENABLE_WAV2VEC2 and settings.WARM_WAV2VEC2_ON_STARTUP:
        try:
            from app.services.wav2vec2_asr import warm_wav2vec2

            await asyncio.to_thread(warm_wav2vec2)
        except Exception:
            logger.exception("Wav2Vec2 warm failed")

    if settings.ENABLE_ACOUSTIC_SCORING and settings.WARM_ACOUSTIC_ON_STARTUP:
        try:
            from app.services.pronunciation.wav2vec2_phonemes import warm_phoneme_model

            await asyncio.to_thread(warm_phoneme_model)
        except Exception:
            logger.exception("Acoustic phoneme model warm failed; using text proxy")

    # Start session cleanup task
    from app.api.routes.voice_websocket import cleanup_stale_sessions
    cleanup_task = asyncio.create_task(cleanup_stale_sessions())
    logger.info("Started session cleanup background task in lifespan")
    
    yield
    
    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("Stopped session cleanup background task")


# Initialize FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(voice_websocket.router, tags=["Voice WebSocket"])
app.include_router(phonemes.router, tags=["Phonemes"])
app.include_router(pronunciation.router, tags=["Pronunciation"])
app.include_router(pronunciation_analysis.router, tags=["Pronunciation Analysis"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
