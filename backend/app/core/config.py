# app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application settings and configuration"""
    
    # API Configuration
    APP_NAME: str = "TalkFlow Backend"
    APP_VERSION: str = "1.0.0"
    
    # CORS Settings
    ALLOWED_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3002"
    ]
    
    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Whisper Model Configuration
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "tiny")
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    
    # Audio Settings
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHANNELS: int = 1
    
    # Paths
    TEMP_DIR: str = "/tmp"
    
    def validate(self):
        """Validate required settings"""
        if not self.GEMINI_API_KEY:
            print("WARNING: GEMINI_API_KEY not set - AI responses will not work!")

settings = Settings()
settings.validate()

