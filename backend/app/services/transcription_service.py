# app/services/transcription_service.py
from fastapi import UploadFile
from deepgram import DeepgramClient
from app.core.config import settings

async def transcribe_audio(audio: UploadFile) -> str:
    """Transcribe audio file using Deepgram"""
    
    try:
        # Read the uploaded file content
        content = await audio.read()
        
        # Initialize Deepgram client
        deepgram = DeepgramClient(api_key=settings.DEEPGRAM_API_KEY)
        
        # Transcribe with Deepgram
        response = deepgram.listen.v1.media.transcribe_file(
            request=content,
            model="nova-3",
            language="en-US",
            smart_format=True,
            punctuate=True,
        )
        
        # Extract transcript
        transcript = response.results.channels[0].alternatives[0].transcript.strip()
        print(f"Transcribed: '{transcript}'")
        
        return transcript
        
    except Exception as e:
        print(f"Deepgram transcription error: {str(e)}")
        raise Exception(f"Transcription failed: {str(e)}")

