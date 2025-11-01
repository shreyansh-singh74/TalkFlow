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
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    
    # Audio Settings
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHANNELS: int = 1
    AUDIO_CHUNK_SIZE: int = 4096  # samples
    TTS_CHUNK_SIZE: int = 100_000  # 100KB
    
    # WebSocket Settings
    WEBSOCKET_PING_INTERVAL: int = 20  # seconds
    WEBSOCKET_PING_TIMEOUT: int = 60
    WEBSOCKET_MAX_SIZE: int = 16_777_216  # 16MB
    
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
        if not self.DEEPGRAM_API_KEY:
            print("WARNING: DEEPGRAM_API_KEY not set - Transcription will not work!")

settings = Settings()
settings.validate()

