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
    GOOGLE_APPLICATION_CREDENTIALS: str = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    
    # Whisper Model Configuration
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "tiny")
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"
    
    # Audio Settings
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHANNELS: int = 1
    
    # TTS Settings
    TTS_LANGUAGE_CODE: str = "en-US"
    TTS_VOICE_NAME: str = "en-US-Neural2-C"  # Female voice, use "en-US-Neural2-D" for male
    TTS_AUDIO_ENCODING: str = "MP3"
    TTS_SPEAKING_RATE: float = 1.0
    TTS_PITCH: float = 0.0
    
    # Paths
    TEMP_DIR: str = "/tmp"
    
    def validate(self):
        """Validate required settings"""
        if not self.GEMINI_API_KEY:
            print("WARNING: GEMINI_API_KEY not set - AI responses will not work!")
        if not self.GOOGLE_APPLICATION_CREDENTIALS:
            print("WARNING: GOOGLE_APPLICATION_CREDENTIALS not set - TTS will not work!")
        elif not os.path.exists(self.GOOGLE_APPLICATION_CREDENTIALS):
            print(f"WARNING: Google credentials file not found at {self.GOOGLE_APPLICATION_CREDENTIALS}")

settings = Settings()
settings.validate()

