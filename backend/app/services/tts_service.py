# app/services/tts_service.py
import base64
from google.cloud import texttospeech
from app.core.config import settings

class TTSService:
    """Text-to-Speech service using Google Cloud TTS"""
    
    def __init__(self):
        """Initialize the Google Cloud TTS client"""
        try:
            self.client = texttospeech.TextToSpeechClient()
            print("✓ Google Cloud TTS client initialized successfully")
        except Exception as e:
            print(f"✗ Failed to initialize TTS client: {str(e)}")
            self.client = None
    
    def text_to_speech(self, text: str) -> str | None:
        """
        Convert text to speech and return base64 encoded audio
        
        Args:
            text: The text to convert to speech
            
        Returns:
            Base64 encoded audio string or None if conversion fails
        """
        if not self.client:
            print("✗ TTS client not initialized")
            return None
            
        if not text or text.strip() == "":
            print("✗ Empty text provided for TTS")
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
            
            # Encode audio content to base64
            audio_base64 = base64.b64encode(response.audio_content).decode('utf-8')
            
            print(f"✓ Successfully generated TTS audio ({len(response.audio_content)} bytes)")
            return audio_base64
            
        except Exception as e:
            print(f"✗ TTS conversion error: {str(e)}")
            return None

# Create a singleton instance
tts_service = TTSService()

