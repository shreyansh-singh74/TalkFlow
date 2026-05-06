# main.py
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, voice_websocket, phoneme_routes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENABLE_WAV2VEC2 and settings.WARM_WAV2VEC2_ON_STARTUP:
        try:
            from app.services.wav2vec2_asr import warm_wav2vec2

            await asyncio.to_thread(warm_wav2vec2)
        except Exception:
            logger.exception("Wav2Vec2 warm failed; falling back to Deepgram transcripts")
    yield


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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(voice_websocket.router, tags=["Voice WebSocket"])
app.include_router(phoneme_routes.router, tags=["Phoneme Analysis"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
