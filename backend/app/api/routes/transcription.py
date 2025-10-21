# app/api/routes/transcription.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import transcription_service
from app.services.gemini_response import get_gemini_response

router = APIRouter()

@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe audio to text using Whisper and get AI response"""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    
    try:
        # Transcribe audio
        transcript = await transcription_service.transcribe_audio(audio)
        
        if not transcript:
            return {
                "transcript": "",
                "reply": "",
                "success": False,
                "error": "No speech detected"
            }
        
        # Get Gemini AI response
        reply = get_gemini_response(transcript)
        
        result = {
            "transcript": transcript,
            "reply": reply,
            "success": True
        }
        
        print(f"✓ Returning response with reply: {len(reply)} chars")
        return result
        
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return {
            "transcript": "",
            "reply": "",
            "error": str(e),
            "success": False
        }

