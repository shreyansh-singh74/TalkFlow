# app/api/routes/health.py
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/")
async def root():
    return {
        "message": f"{settings.APP_NAME} is running!", 
        "status": "healthy"
    }

@router.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "whisper_model": settings.WHISPER_MODEL
    }

