# app/api/routes/transcription.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import Optional
from app.services import transcription_service
from app.services.gemini_response import get_gemini_response
from app.services.tts_service import tts_service

router = APIRouter()

# Store conversation history in memory (use Redis for production)
conversation_contexts = {}

@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    turn_number: Optional[int] = Form(0)
):
    """Transcribe audio to text using Whisper, get AI response with context, and convert to speech"""
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
        
        # Retrieve conversation history
        context = []
        if conversation_id:
            context = conversation_contexts.get(conversation_id, [])
            print(f"📚 Retrieved {len(context)} previous turns for conversation {conversation_id}")
        
        # Get Gemini AI response WITH context
        reply = get_gemini_response(
            current_text=transcript,
            conversation_history=context
        )
        
        # Update conversation context
        if conversation_id:
            if conversation_id not in conversation_contexts:
                conversation_contexts[conversation_id] = []
            
            conversation_contexts[conversation_id].append({
                "user": transcript,
                "ai": reply,
                "turn": turn_number
            })
            
            # Keep only last 10 turns to prevent memory bloat
            conversation_contexts[conversation_id] = conversation_contexts[conversation_id][-10:]
            print(f"💾 Updated conversation context (now {len(conversation_contexts[conversation_id])} turns)")
        
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

@router.post("/clear-conversation")
async def clear_conversation(conversation_id: str):
    """Clear conversation history for a specific conversation"""
    if conversation_id in conversation_contexts:
        del conversation_contexts[conversation_id]
        print(f"🧹 Cleared conversation {conversation_id}")
        return {"success": True, "message": "Conversation cleared"}
    return {"success": False, "message": "Conversation not found"}

