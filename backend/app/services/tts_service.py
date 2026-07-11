# app/services/tts_service.py
import logging
from google.cloud import texttospeech
from app.core.config import settings

logger = logging.getLogger(__name__)

class TTSService:
    """Text-to-Speech service using Google Cloud TTS"""
    
    def __init__(self):
        """Initialize the Google Cloud TTS client"""
        try:
            self.client = texttospeech.TextToSpeechClient()
            logger.info("Google Cloud TTS client initialized")
        except Exception:
            logger.exception("Failed to initialize TTS client")
            self.client = None
    
    def text_to_speech(self, text: str, lang: str = None, rate: float = None) -> bytes | None:
        """
        Convert text to speech and return raw audio bytes
        
        Args:
            text: The text to convert to speech
            lang: Optional BCP-47 locale code (e.g. en-US, en-IN, en-GB)
            rate: Optional speed factor (e.g. 1.0 or 0.65)
            
        Returns:
            Raw audio bytes or None if conversion fails
        """
        if not self.client:
            logger.warning("TTS client not initialized")
            return None
            
        if not text or text.strip() == "":
            logger.debug("Empty text provided for TTS")
            return None
        
        # Select voice based on dialect
        voice_lang = lang or settings.TTS_LANGUAGE_CODE
        voice_name = settings.TTS_VOICE_NAME
        
        if lang:
            if lang == "en-IN":
                voice_name = "en-IN-Neural2-A"
            elif lang == "en-GB":
                voice_name = "en-GB-Neural2-A"
            elif lang == "en-US":
                voice_name = "en-US-Neural2-F"
        
        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            voice = texttospeech.VoiceSelectionParams(
                language_code=voice_lang,
                name=voice_name
            )
            
            speaking_rate = rate if rate is not None else settings.TTS_SPEAKING_RATE
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=speaking_rate,
                pitch=settings.TTS_PITCH
            )
            
            response = self.client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            logger.debug("Generated TTS audio (%s bytes)", len(response.audio_content))
            return response.audio_content
            
        except Exception:
            logger.exception("TTS conversion failed")
            return None

# Create a singleton instance
tts_service = TTSService()
