import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import transcription_service
from app.services.gemini_response import get_gemini_response
from app.services.phoneme_analysis_service import phoneme_analyzer
from app.services.tts_service import tts_service
from app.utils.phoneme_mappers import sentence_to_response

logger = logging.getLogger(__name__)
router = APIRouter()

conversation_contexts: Dict[str, list] = {}
MAX_HISTORY_TURNS = 10


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    turn_number: Optional[int] = Form(0),
    target_sentence: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """Transcribe audio, generate an AI reply, synthesize speech, and optionally
    analyze pronunciation against a target sentence."""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    try:
        transcript = await transcription_service.transcribe_audio(audio)
    except Exception as exc:
        logger.exception("Transcription failed")
        return {
            "transcript": "",
            "reply": "",
            "audio": None,
            "phoneme_analysis": None,
            "success": False,
            "error": str(exc),
        }

    if not transcript:
        return {
            "transcript": "",
            "reply": "",
            "audio": None,
            "phoneme_analysis": None,
            "success": False,
            "error": "No speech detected",
        }

    context = []
    if conversation_id:
        context = conversation_contexts.get(conversation_id, [])

    try:
        reply = get_gemini_response(current_text=transcript, conversation_history=context)
    except Exception:
        logger.exception("Gemini response failed")
        reply = ""

    if conversation_id:
        history = conversation_contexts.setdefault(conversation_id, [])
        history.append({"user": transcript, "ai": reply, "turn": turn_number})
        conversation_contexts[conversation_id] = history[-MAX_HISTORY_TURNS:]

    audio_base64: Optional[str] = None
    if reply:
        try:
            audio_base64 = tts_service.text_to_speech(reply)
        except Exception:
            logger.exception("TTS synthesis failed")

    phoneme_payload: Optional[dict] = None
    sentence_for_analysis = (target_sentence or "").strip() or transcript
    try:
        analysis = await phoneme_analyzer.analyze_sentence(sentence_for_analysis, transcript)
        if analysis is not None:
            phoneme_payload = sentence_to_response(analysis).model_dump()
    except Exception:
        logger.exception("Phoneme analysis failed during transcription")

    return {
        "transcript": transcript,
        "reply": reply,
        "audio": audio_base64,
        "phoneme_analysis": phoneme_payload,
        "success": True,
    }


@router.post("/clear-conversation")
async def clear_conversation(conversation_id: str) -> Dict[str, Any]:
    if conversation_id in conversation_contexts:
        del conversation_contexts[conversation_id]
        return {"success": True, "message": "Conversation cleared"}
    return {"success": False, "message": "Conversation not found"}
