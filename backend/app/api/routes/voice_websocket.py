# app/api/routes/voice_websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.deepgram_service import DeepgramLiveService
from app.services.llm_response import stream_llm_response
from app.services.pronunciation import get_scorer
from app.services.pronunciation_coach import build_pronunciation_coach_for_llm
from app.services.tts_service import tts_service
from app.services.wav2vec2_asr import pcm16le_to_text
from app.schemas.websocket_messages import (
    AIResponseMessage,
    ControlMessage,
    ErrorMessage,
    FinalTranscriptMessage,
    LLMTextChunkMessage,
    PartialTranscriptMessage,
    PronunciationResultMessage,
    TTSChunkMessage,
)
from app.core.config import settings
import json
import uuid
import asyncio
import base64
import logging
import time
from datetime import datetime
from typing import Dict, Optional, List

router = APIRouter()
logger = logging.getLogger(__name__)

# Session storage: session_id -> session_data
sessions: Dict[str, dict] = {}

# Session timeout from config
SESSION_TIMEOUT_SECONDS = settings.SESSION_TIMEOUT_MINUTES * 60
DEFAULT_TARGET_TEXT = "circumstances of the accident"


def extract_practice_target(ai_text: str) -> Optional[str]:
    marker = "repeat after me:"
    lower = (ai_text or "").lower()
    if marker in lower:
        t = ai_text[lower.rfind(marker) + len(marker) :].strip()
        if t:
            return t
    if "repeat" in lower and ":" in ai_text:
        t2 = ai_text.rsplit(":", 1)[-1].strip()
        return t2 or None
    return None


async def cleanup_stale_sessions():
    """Background task to clean up inactive sessions"""
    while True:
        try:
            await asyncio.sleep(60)  # Check every minute
            
            current_time = time.time()
            stale_session_ids = []
            
            for session_id, session in sessions.items():
                if isinstance(session, VoiceSession):
                    time_since_activity = current_time - session.last_activity
                    
                    if time_since_activity > SESSION_TIMEOUT_SECONDS:
                        logger.info(
                            "Session %s inactive for %.1f minutes, cleaning up",
                            session_id,
                            time_since_activity / 60,
                        )
                        stale_session_ids.append(session_id)
            
            # Clean up stale sessions
            for session_id in stale_session_ids:
                session = sessions.get(session_id)
                if session and isinstance(session, VoiceSession):
                    # Close WebSocket if still open
                    try:
                        await session.websocket.close()
                    except Exception:
                        pass
                    
                    # Cleanup Deepgram if active
                    if session.deepgram_service:
                        await session.deepgram_service.finish()
                    
                    del sessions[session_id]
                    logger.info("Cleaned up stale session %s", session_id)
                    
        except Exception:
            logger.exception("Session cleanup task failed")

"""
voice_websocket.py handles the WebSocket interface for real-time voice conversations in the application.

Core concepts on this page:
- Defines FastAPI routes for managing voice chat sessions via WebSocket.
- Maintains in-memory session storage (`sessions`) mapping session IDs to session data (each typically an instance of `VoiceSession`).
- Runs a background task (`cleanup_stale_sessions`) that regularly checks for and removes stale (inactive) sessions, closing their WebSockets and cleaning up resources when a timeout is exceeded.
- The `VoiceSession` class tracks all session-specific context and resources, including:
    - Connection/websocket info.
    - Conversation history and metadata.
    - Integration with Deepgram for live audio transcription.
    - Manages start/end of transcription turns, partial/final transcript handling, audio streaming, and TTS (text-to-speech) generation flow.
- The routes defined here enable interactive, bi-directional audio and text communication between client and server for the voice chat feature.

Essentially, this module brings together session lifecycle management, speech-to-text (Deepgram), text-to-speech (Google TTS), and conversational AI into a single, persistent WebSocket workflow for each connected user.
"""

class VoiceSession:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.session_id = str(uuid.uuid4())
        self.conversation_history = []
        self.deepgram_service: Optional[DeepgramLiveService] = None
        self.current_turn_id: Optional[str] = None
        self.partial_transcript = ""
        self.final_transcript = ""
        self.target_text = DEFAULT_TARGET_TEXT
        self.active_expected_target: Optional[str] = None
        self.turn_audio = bytearray()
        self.is_generating_tts = False
        self.should_stop_tts = False
        
        # Session metadata
        self.last_activity = time.time()  # Unix timestamp for easy comparison
        self.total_turns = 0
        
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()
    
    async def _emit_pronunciation_result(
        self,
        full_pcm: bytes,
        expected_for_turn: str,
        deepgram_text: str,
    ) -> Optional[Dict]:
        cap = settings.TURN_AUDIO_MAX_BYTES
        pcm = full_pcm[:cap] if cap > 0 else full_pcm

        # The transcript still drives word-level coaching and the text-proxy
        # fallback. Optional local ASR can override the displayed "heard" text.
        heard_text = ""
        if settings.ENABLE_WAV2VEC2 and pcm:
            try:
                heard_text = await asyncio.to_thread(pcm16le_to_text, pcm)
            except Exception:
                logger.exception("Wav2Vec2 ASR failed; using Deepgram transcript")
        if not (heard_text or "").strip():
            heard_text = deepgram_text or ""

        # The scorer is chosen by config: acoustic (scores `pcm` directly) or
        # the legacy text proxy. Both return the same result shape.
        scorer = get_scorer()
        result = await asyncio.to_thread(
            scorer.score, expected_for_turn, heard_text, pcm
        )

        coach = build_pronunciation_coach_for_llm(
            expected_for_turn,
            heard_text,
            result.score,
            result.feedback or [],
        )
        await self.send_json(
            PronunciationResultMessage(
                type="PRONUNCIATION_RESULT",
                turn_id=self.current_turn_id or "",
                target_text=expected_for_turn,
                deepgram_text=deepgram_text,
                heard_text=heard_text,
                score=result.score,
                expected_phonemes=result.expected_phonemes,
                actual_phonemes=result.actual_phonemes,
                errors=result.errors,
                feedback=result.feedback,
                misaligned_words=coach.get("misaligned_words") or [],
                method=result.method,
                per_phoneme=result.per_phoneme,
            ).model_dump()
        )
        return coach

    async def handle_start_turn(self, msg: ControlMessage):
        """Handle START_TURN: Initialize Deepgram streaming"""
        self.update_activity()
        logger.debug("START_TURN %s", msg.turn_id)
        self.current_turn_id = msg.turn_id
        self.partial_transcript = ""
        self.final_transcript = ""
        self.turn_audio.clear()
        self.active_expected_target = self.target_text
        self.should_stop_tts = False
        
        # Stop any ongoing TTS playback
        if self.is_generating_tts:
            self.should_stop_tts = True
            self.is_generating_tts = False
        
        # Initialize Deepgram connection
        self.deepgram_service = DeepgramLiveService(
            on_partial=self.on_partial_transcript,
            on_final=self.on_final_transcript
        )
        await self.deepgram_service.start()
        
    async def handle_audio_chunk(self, audio_data: bytes):
        """Handle incoming audio chunk"""
        cap = settings.TURN_AUDIO_MAX_BYTES
        if cap > 0:
            room = cap - len(self.turn_audio)
            if room > 0:
                self.turn_audio.extend(audio_data[:room])
        if self.deepgram_service:
            await self.deepgram_service.send_audio(audio_data)
            
    async def handle_end_turn(self, msg: ControlMessage):
        """Handle END_TURN: Finalize transcript and generate streaming response"""
        self.update_activity()
        logger.debug("END_TURN %s", msg.turn_id)
        
        # Finalize Deepgram
        if self.deepgram_service:
            await self.deepgram_service.finish()
            self.deepgram_service = None

        full_pcm = bytes(self.turn_audio)
        self.turn_audio.clear()

        await asyncio.sleep(0.2)

        if not self.final_transcript:
            logger.info("No transcript received for turn %s", msg.turn_id)
            return

        expected_for_turn = (self.active_expected_target or self.target_text or DEFAULT_TARGET_TEXT).strip()
        self.active_expected_target = None

        await self.send_json(
            FinalTranscriptMessage(
                type="FINAL_TRANSCRIPT",
                text=self.final_transcript,
                confidence=1.0,
            ).model_dump()
        )

        pronunciation_coach: Optional[Dict] = None
        try:
            pronunciation_coach = await self._emit_pronunciation_result(
                full_pcm=full_pcm,
                expected_for_turn=expected_for_turn,
                deepgram_text=self.final_transcript,
            )
        except Exception:
            logger.exception("Pronunciation pipeline failed")

        # Check if first turn in session
        is_first_turn = len(self.conversation_history) == 0
        
        # Stream AI response with text batching
        full_response_text = ""
        text_batches_for_tts = []
        
        async for text_chunk in stream_llm_response(
            self.final_transcript,
            self.conversation_history,
            is_first_turn=is_first_turn,
            pronunciation_coach=pronunciation_coach,
        ):
            if self.should_stop_tts:
                logger.info("LLM streaming interrupted")
                break
            
            full_response_text += text_chunk
            text_batches_for_tts.append(text_chunk)
            
            # Send LLM token chunk to frontend for real-time display
            await self.send_json(
                LLMTextChunkMessage(
                    type="LLM_TEXT_CHUNK",
                    text=text_chunk,
                    is_final=False,
                ).model_dump()
            )
        
        # Send final AI response
        await self.send_json(
            AIResponseMessage(
                type="AI_RESPONSE",
                text=full_response_text,
                has_audio=True,
            ).model_dump()
        )

        practice_target = extract_practice_target(full_response_text)
        if practice_target:
            self.target_text = practice_target
        
        # Update conversation history with metadata
        self.conversation_history.append({
            "user": self.final_transcript,
            "ai": full_response_text,
            "turn": self.total_turns + 1,
            "turn_id": self.current_turn_id,
            "timestamp": datetime.now().isoformat()
        })
        
        # Increment turn count
        self.total_turns += 1
        
        # Keep last 10 turns
        self.conversation_history = self.conversation_history[-10:]
        
        # Generate and stream TTS with small batches
        if not self.should_stop_tts:
            await self.stream_tts_batched(text_batches_for_tts)
    
    async def stream_tts_batched(self, text_batches: List[str]):
        """Generate TTS for small text batches and stream audio chunks"""
        self.is_generating_tts = True
        seq = 0
        
        for batch_idx, text_batch in enumerate(text_batches):
            if self.should_stop_tts:
                logger.info("TTS interrupted")
                break
            
            # Skip empty batches
            if not text_batch.strip():
                continue
            
            logger.debug(
                "Synthesizing TTS batch %s/%s",
                batch_idx + 1,
                len(text_batches),
            )
            
            # Generate TTS for this batch (should be 500-800ms of audio)
            audio_bytes = await asyncio.to_thread(tts_service.text_to_speech, text_batch)
            
            if not audio_bytes:
                continue
            
            # Send as single chunk (already small ~500-800ms)
            is_final = (batch_idx == len(text_batches) - 1)
            
            await self.send_json(
                TTSChunkMessage(type="TTS_CHUNK", seq=seq, is_final=is_final).model_dump()
            )
            await self.websocket.send_bytes(audio_bytes)
            
            seq += 1
            logger.debug("Sent TTS chunk %s (%s bytes)", seq, len(audio_bytes))
        
        self.is_generating_tts = False
        

    async def send_json(self, data: dict):
        """Send JSON message"""
        await self.websocket.send_text(json.dumps(data))
        
    def on_partial_transcript(self, text: str, confidence: float):
        """Callback for partial transcript"""
        self.partial_transcript = text
        asyncio.create_task(
            self.send_json(
                PartialTranscriptMessage(
                    type="PARTIAL_TRANSCRIPT",
                    text=text,
                    is_final=False,
                    confidence=confidence,
                ).model_dump()
            )
        )
        
    def on_final_transcript(self, text: str, confidence: float):
        """Callback for final transcript"""
        self.final_transcript = text


@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """Main WebSocket endpoint for voice conversation"""
    await websocket.accept()
    
    session = VoiceSession(websocket)
    sessions[session.session_id] = session
    
    logger.info("WebSocket connected: %s", session.session_id)
    logger.info("Active sessions: %s", len(sessions))
    
    # Send keep-alive pings every 20s
    async def keep_alive():
        while True:
            try:
                await asyncio.sleep(20)
                await websocket.send_text(json.dumps({"type": "PING"}))
            except Exception:
                break
    
    ping_task = asyncio.create_task(keep_alive())
    
    try:
        while True:
            # Receive message (can be text or bytes)
            message = await websocket.receive()
            
            if "text" in message:
                # Control message (JSON)
                data = json.loads(message["text"])
                msg_type = data.get("type")
                
                if msg_type == "START_TURN":
                    await session.handle_start_turn(ControlMessage(**data))
                elif msg_type == "END_TURN":
                    await session.handle_end_turn(ControlMessage(**data))
                elif msg_type == "INTERRUPT":
                    session.should_stop_tts = True
                elif msg_type == "PONG":
                    pass  # Keep-alive response
                    
            elif "bytes" in message:
                # Audio chunk (binary PCM16)
                await session.handle_audio_chunk(message["bytes"])
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", session.session_id)
    except Exception as e:
        logger.exception("WebSocket error")
        try:
            await websocket.send_text(
                ErrorMessage(type="ERROR", message=str(e), recoverable=False).model_dump_json()
            )
        except Exception as send_err:
            logger.warning("Failed to send error message to client: %s", send_err)
    finally:
        # Cleanup
        ping_task.cancel()
        if session.deepgram_service:
            await session.deepgram_service.finish()
        if session.session_id in sessions:
            del sessions[session.session_id]
        logger.info("Cleaned up session: %s", session.session_id)
