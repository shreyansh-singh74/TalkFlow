# app/core/models.py
import google.generativeai as genai
from faster_whisper import WhisperModel
from app.core.config import settings

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)
print("Gemini API configured")

# Load Whisper model at startup
print(f"Loading faster-whisper model: {settings.WHISPER_MODEL}")
whisper_model = WhisperModel(
    settings.WHISPER_MODEL, 
    device=settings.WHISPER_DEVICE, 
    compute_type=settings.WHISPER_COMPUTE_TYPE
)
print("faster-whisper model loaded successfully!")

