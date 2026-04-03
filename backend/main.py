# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import health, transcription, voice_websocket, phoneme_routes

# Initialize FastAPI app
app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

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
