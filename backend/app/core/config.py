# app/core/config.py
import os
import json
import base64
import logging
import tempfile
from typing import List
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

class Settings:
    """Application settings and configuration"""
    
    # API Configuration
    APP_NAME: str = "TalkFlow Backend"
    APP_VERSION: str = "1.0.0"
    
    # CORS Settings - Support production origins from environment
    # Use FRONTEND_URL or NEXT_PUBLIC_APP_URL (both should be set to the same value)
    _default_origins = [
        "http://localhost:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
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
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    
    # API URLs & Models
    OPENROUTER_API_URL: str = os.getenv(
        "OPENROUTER_API_URL", "https://openrouter.ai/api/v1/chat/completions"
    )
    OPENROUTER_MODEL: str = os.getenv(
        "OPENROUTER_MODEL", "google/gemini-2.5-flash"
    )
    
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
                logger.info("Google credentials loaded from GOOGLE_CREDENTIALS_JSON")
            except Exception as e:
                logger.warning(
                    "Failed to decode GOOGLE_CREDENTIALS_JSON; make sure it contains base64-encoded JSON: %s",
                    e,
                )
        elif google_creds_path:
            # Check if it's actually a base64 string (starts with 'ewog' or similar, not a path)
            if google_creds_path.startswith('ewog') or (len(google_creds_path) > 500 and '/' not in google_creds_path):
                logger.error(
                    "GOOGLE_APPLICATION_CREDENTIALS looks like base64; use GOOGLE_CREDENTIALS_JSON instead"
                )
                self.GOOGLE_APPLICATION_CREDENTIALS = ""
            elif os.path.exists(google_creds_path):
                self.GOOGLE_APPLICATION_CREDENTIALS = google_creds_path
                logger.info("Google credentials loaded from file: %s", google_creds_path)
            else:
                logger.warning("Google credentials file not found at: %s", google_creds_path)
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
    
    ENABLE_WAV2VEC2: bool = os.getenv("ENABLE_WAV2VEC2", "1").lower() in ("1", "true", "yes")
    WARM_WAV2VEC2_ON_STARTUP: bool = os.getenv(
        "WARM_WAV2VEC2_ON_STARTUP", "1"
    ).lower() in ("1", "true", "yes")
    WAV2VEC2_MODEL_ID: str = os.getenv("WAV2VEC2_MODEL_ID", "facebook/wav2vec2-base-960h")
    TURN_AUDIO_MAX_BYTES: int = int(os.getenv("TURN_AUDIO_MAX_BYTES", str(16_000 * 2 * 5)))

    # Acoustic pronunciation scoring (Phase 1): score the raw audio waveform with
    # a wav2vec2 phoneme recognizer + GOP-style alignment instead of comparing
    # transcript text. When disabled, the legacy text-proxy scorer is used.
    ENABLE_ACOUSTIC_SCORING: bool = os.getenv("ENABLE_ACOUSTIC_SCORING", "0").lower() in (
        "1",
        "true",
        "yes",
    )
    WARM_ACOUSTIC_ON_STARTUP: bool = os.getenv("WARM_ACOUSTIC_ON_STARTUP", "0").lower() in (
        "1",
        "true",
        "yes",
    )
    ACOUSTIC_PHONEME_MODEL_ID: str = os.getenv(
        "ACOUSTIC_PHONEME_MODEL_ID", "facebook/wav2vec2-lv-60-espeak-cv-ft"
    )

    # Scoring thresholds (env-overridable so they can be tuned without redeploy).
    # A phone counts as "correct" when its articulatory distance is at/under this.
    CORRECT_DISTANCE_THRESHOLD: float = float(
        os.getenv("CORRECT_DISTANCE_THRESHOLD", "0.34")
    )
    INSERTION_PENALTY: float = float(os.getenv("INSERTION_PENALTY", "0.5"))
    SOFTEN_ON_UNCERTAINTY: float = float(os.getenv("SOFTEN_ON_UNCERTAINTY", "0.5"))

    # Prosody scoring (Phase 2/3). Each dimension is independently flag-gated so
    # they can be rolled out one at a time. All run CPU-only, load-once.
    ENABLE_PROSODY_SCORING: bool = os.getenv("ENABLE_PROSODY_SCORING", "0").lower() in (
        "1",
        "true",
        "yes",
    )
    ENABLE_INTONATION_SCORING: bool = os.getenv(
        "ENABLE_INTONATION_SCORING", "0"
    ).lower() in ("1", "true", "yes")

    # Voice-activity detection (silero-vad) used by timing + noisy-audio guards.
    ENABLE_VAD: bool = os.getenv("ENABLE_VAD", "1").lower() in ("1", "true", "yes")
    SILERO_VAD_THRESHOLD: float = float(os.getenv("SILERO_VAD_THRESHOLD", "0.5"))
    # Reject a turn as empty/noisy if VAD finds less than this fraction of speech.
    MIN_SPEECH_FRACTION: float = float(os.getenv("MIN_SPEECH_FRACTION", "0.15"))

    # Target accent the scorer evaluates against (US/UK/Indian/AU). Sets the
    # reference contour + TTS voice used for prosody comparisons.
    TARGET_ACCENT: str = os.getenv("TARGET_ACCENT", "en-US")

    # L1-aware coaching (Phase 4). When on, the user's native language steers
    # which sounds the LLM coaches toward.
    L1_AWARE_ENABLED: bool = os.getenv("L1_AWARE_ENABLED", "0").lower() in (
        "1",
        "true",
        "yes",
    )

    # Raw turn audio persistence (Phase 0 + Phase 5 eval datasets). Consent-gated:
    # never writes to disk unless PERSIST_TURN_AUDIO is set. The retention sweep
    # deletes files older than TURN_AUDIO_RETENTION_HOURS.
    PERSIST_TURN_AUDIO: bool = os.getenv("PERSIST_TURN_AUDIO", "0").lower() in (
        "1",
        "true",
        "yes",
    )
    TURN_AUDIO_DIR: str = os.getenv("TURN_AUDIO_DIR", os.path.join(TEMP_DIR, "talkflow_audio"))
    TURN_AUDIO_RETENTION_HOURS: int = int(os.getenv("TURN_AUDIO_RETENTION_HOURS", "24"))
    AUDIO_RETENTION_SWEEP_INTERVAL_SECONDS: int = int(
        os.getenv("AUDIO_RETENTION_SWEEP_INTERVAL_SECONDS", "600")
    )

    # Resilience (Phase 6).
    SCORE_TIMEOUT_SECONDS: float = float(os.getenv("SCORE_TIMEOUT_SECONDS", "8.0"))
    MAX_TURNS_PER_MINUTE: int = int(os.getenv("MAX_TURNS_PER_MINUTE", "20"))

    # Forced Alignment (Phase 2).
    ENABLE_ALIGNMENT: bool = os.getenv("ENABLE_ALIGNMENT", "1").lower() in ("1", "true", "yes")
    ALIGNMENT_PROVIDER: str = os.getenv("ALIGNMENT_PROVIDER", "whisperx")
    ALIGNMENT_TIMEOUT_SECONDS: float = float(os.getenv("ALIGNMENT_TIMEOUT_SECONDS", "15.0"))
    ALIGNMENT_LANGUAGE: str = os.getenv("ALIGNMENT_LANGUAGE", "en")
    WARM_ALIGNMENT_ON_STARTUP: bool = os.getenv("WARM_ALIGNMENT_ON_STARTUP", "0").lower() in ("1", "true", "yes")

    def validate(self):
        """Validate required settings"""
        if not self.OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY is not set - AI responses will not work")
        if not self.GOOGLE_APPLICATION_CREDENTIALS:
            logger.warning("GOOGLE_APPLICATION_CREDENTIALS is not set - TTS will not work")
        elif self.GOOGLE_APPLICATION_CREDENTIALS and not os.path.exists(self.GOOGLE_APPLICATION_CREDENTIALS):
            logger.warning(
                "Google credentials file not found at %s",
                self.GOOGLE_APPLICATION_CREDENTIALS,
            )

settings = Settings()
settings.validate()
