# app/utils/audio_utils.py
import subprocess
from fastapi import HTTPException
from app.core.config import settings

def ffmpeg_to_wav(in_path: str, out_path: str):
    """Convert audio file to 16k mono WAV using ffmpeg"""
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", in_path, 
            "-ar", str(settings.AUDIO_SAMPLE_RATE), 
            "-ac", str(settings.AUDIO_CHANNELS), 
            out_path
        ], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Audio conversion failed: {e.stderr.decode()}"
        )

