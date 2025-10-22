# app/api/routes/transcription.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import transcription_service
from app.services.gemini_response import get_gemini_response
from app.services.tts_service import tts_service

router = APIRouter()

@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe audio to text using Whisper, get AI response, and convert to speech"""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    
    try:
        # Transcribe audio
        transcript = await transcription_service.transcribe_audio(audio)
        
        if not transcript:
            return {
                "transcript": "",
                "reply": "",
                "audio": None,
                "success": False,
                "error": "No speech detected"
            }
        
        # Get Gemini AI response
        reply = get_gemini_response(transcript)
        
        # Convert AI reply to speech
        audio_base64 = None
        if reply:
            audio_base64 = tts_service.text_to_speech(reply)
            if audio_base64:
                print(f"✓ TTS audio generated successfully")
            else:
                print(f"✗ TTS generation failed, returning text only")
        
        result = {
            "transcript": transcript,
            "reply": reply,
            "audio": audio_base64,  # Base64 encoded MP3 audio
            "success": True
        }
        
        print(f"✓ Returning response with reply: {len(reply)} chars, audio: {bool(audio_base64)}")
        return result
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return {
            "transcript": "",
            "reply": "",
            "audio": None,
            "error": str(e),
            "success": False
        }

