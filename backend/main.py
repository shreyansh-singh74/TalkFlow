# main.py
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, transcription, voice_websocket, phoneme_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENABLE_WAV2VEC2:
        try:
            from app.services.wav2vec2_asr import warm_wav2vec2

            await asyncio.to_thread(warm_wav2vec2)
        except Exception as exc:
            print(f"Wav2Vec2 warm failed (set ENABLE_WAV2VEC2=0 to skip): {exc}")
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
app.include_router(transcription.router, tags=["Transcription"])
app.include_router(voice_websocket.router, tags=["Voice WebSocket"])
app.include_router(phoneme_routes.router, tags=["Phoneme Analysis"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
