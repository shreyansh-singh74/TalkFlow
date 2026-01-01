# app/core/config.py
import os
import json
import base64
import tempfile
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application settings and configuration"""
    
    # API Configuration
    APP_NAME: str = "TalkFlow Backend"
    APP_VERSION: str = "1.0.0"
    
    # CORS Settings - Support production origins from environment
    # Use FRONTEND_URL or NEXT_PUBLIC_APP_URL (both should be set to the same value)
    _default_origins = [
        "http://localhost:3000",
        "http://localhost:3002"
    ]
    _production_origins = [
        os.getenv("FRONTEND_URL", ""),
        os.getenv("NEXT_PUBLIC_APP_URL", ""),
    ]
    # Filter out empty strings and normalize URLs (remove trailing slashes)
    ALLOWED_ORIGINS: List[str] = _default_origins + [
        origin.rstrip('/') for origin in _production_origins if origin and origin.strip()
    ]
    
    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    
    # Google Cloud Credentials - Support both file path and base64 encoded JSON
    GOOGLE_APPLICATION_CREDENTIALS: str = ""
    
    def _setup_google_credentials(self):
        """Setup Google Cloud credentials from env var (file path or base64 JSON)"""
        # Check for base64 encoded credentials (for platforms like Railway)
        google_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
        google_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
        
        if google_creds_json:
            try:
                # Decode from base64
                credentials_dict = json.loads(base64.b64decode(google_creds_json))
                # Write to temp file
                temp_file = tempfile.NamedTemporaryFile(
                    mode='w', delete=False, suffix='.json'
                )
                json.dump(credentials_dict, temp_file)
                temp_file.close()
                self.GOOGLE_APPLICATION_CREDENTIALS = temp_file.name
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = temp_file.name
                print("✓ Google credentials loaded from GOOGLE_CREDENTIALS_JSON (base64)")
            except Exception as e:
                print(f"✗ WARNING: Failed to decode GOOGLE_CREDENTIALS_JSON: {e}")
                print("  Make sure GOOGLE_CREDENTIALS_JSON contains a valid base64-encoded JSON string")
        elif google_creds_path:
            # Check if it's actually a base64 string (starts with 'ewog' or similar, not a path)
            if google_creds_path.startswith('ewog') or (len(google_creds_path) > 500 and '/' not in google_creds_path):
                print("✗ ERROR: GOOGLE_APPLICATION_CREDENTIALS contains a base64 string!")
                print("  This should be set as GOOGLE_CREDENTIALS_JSON instead.")
                print("  Please set GOOGLE_CREDENTIALS_JSON=<your-base64-string> in Railway")
                self.GOOGLE_APPLICATION_CREDENTIALS = ""
            elif os.path.exists(google_creds_path):
                self.GOOGLE_APPLICATION_CREDENTIALS = google_creds_path
                print(f"✓ Google credentials loaded from file: {google_creds_path}")
            else:
                print(f"✗ WARNING: Google credentials file not found at: {google_creds_path}")
                self.GOOGLE_APPLICATION_CREDENTIALS = ""
        else:
            self.GOOGLE_APPLICATION_CREDENTIALS = ""
    
    def __init__(self):
        self._setup_google_credentials()
    
    # Audio Settings
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHANNELS: int = 1
    AUDIO_CHUNK_SIZE: int = 4096  # samples
    TTS_CHUNK_SIZE: int = 100_000  # 100KB
    
    # WebSocket Settings
    WEBSOCKET_PING_INTERVAL: int = 20  # seconds
    WEBSOCKET_PING_TIMEOUT: int = 60
    WEBSOCKET_MAX_SIZE: int = 16_777_216  # 16MB
    
    # Session Management
    SESSION_TIMEOUT_MINUTES: int = 30
    SESSION_CLEANUP_INTERVAL_SECONDS: int = 60
    MAX_CONVERSATION_HISTORY_TURNS: int = 10
    
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
        if not self.OPENROUTER_API_KEY and not self.GEMINI_API_KEY:
            print("WARNING: Neither OPENROUTER_API_KEY nor GEMINI_API_KEY are set - AI responses will not work!")
        if not self.GOOGLE_APPLICATION_CREDENTIALS:
            print("WARNING: GOOGLE_APPLICATION_CREDENTIALS not set - TTS will not work!")
        elif self.GOOGLE_APPLICATION_CREDENTIALS and not os.path.exists(self.GOOGLE_APPLICATION_CREDENTIALS):
            print(f"WARNING: Google credentials file not found at {self.GOOGLE_APPLICATION_CREDENTIALS}")
        if not self.DEEPGRAM_API_KEY:
            print("WARNING: DEEPGRAM_API_KEY not set - Transcription will not work!")

settings = Settings()
settings.validate()

