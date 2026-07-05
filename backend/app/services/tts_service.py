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
    
    def text_to_speech(self, text: str) -> bytes | None:
        """
        Convert text to speech and return raw audio bytes
        
        Args:
            text: The text to convert to speech
            
        Returns:
            Raw audio bytes or None if conversion fails
        """
        if not self.client:
            logger.warning("TTS client not initialized")
            return None
            
        if not text or text.strip() == "":
            logger.debug("Empty text provided for TTS")
            return None
        
        try:
            # Set the text input to be synthesized
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # Build the voice request
            voice = texttospeech.VoiceSelectionParams(
                language_code=settings.TTS_LANGUAGE_CODE,
                name=settings.TTS_VOICE_NAME
            )
            
            # Select the type of audio file
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
                speaking_rate=settings.TTS_SPEAKING_RATE,
                pitch=settings.TTS_PITCH
            )
            
            # Perform the text-to-speech request
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
