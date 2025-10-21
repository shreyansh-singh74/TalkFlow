# app/services/transcription_service.py
import os
import uuid
from fastapi import UploadFile
from app.core.models import whisper_model
from app.utils.audio_utils import ffmpeg_to_wav
from app.core.config import settings

async def transcribe_audio(audio: UploadFile) -> str:
    """Transcribe audio file using Whisper"""
    # Generate unique file names
    uid = str(uuid.uuid4())
    in_path = f"{settings.TEMP_DIR}/{uid}_in_{audio.filename}"
    wav_path = f"{settings.TEMP_DIR}/{uid}.wav"
    
    try:
        # Read the uploaded file content
        content = await audio.read()
        
        # Save to temp file
        with open(in_path, "wb") as f:
            f.write(content)
        
        # Convert to WAV
        ffmpeg_to_wav(in_path, wav_path)
        
        # Transcribe with faster-whisper
        segments, info = whisper_model.transcribe(
            wav_path,
            beam_size=1,
            vad_filter=True,
        )
        transcript = "".join(seg.text for seg in segments).strip()
        print(f"✓ Transcribed: '{transcript}'")
        
        return transcript
        
    finally:
        # Cleanup temp files
        try:
            if os.path.exists(in_path):
                os.remove(in_path)
            if os.path.exists(wav_path):
                os.remove(wav_path)
        except Exception as e:
            print(f"Warning: Could not clean up temp files: {e}")

