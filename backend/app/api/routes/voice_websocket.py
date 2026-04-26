# app/api/routes/voice_websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.deepgram_live_service import DeepgramLiveService
from app.services.gemini_response import get_gemini_response, stream_gemini_response
from app.services.phoneme_analysis_service import (
    build_pronunciation_result_dict,
    phoneme_analyzer,
)
from app.services.pronunciation_coach import build_pronunciation_coach_for_llm
from app.services.tts_service import tts_service
from app.services.wav2vec2_asr import pcm16le_to_text
from app.schemas.websocket_messages import ControlMessage
from app.core.config import settings
import json
import uuid
import asyncio
import base64
import time
from datetime import datetime
from typing import Dict, Optional, List

router = APIRouter()

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
                        print(f"Session {session_id} inactive for {time_since_activity/60:.1f} minutes, cleaning up")
                        stale_session_ids.append(session_id)
            
            # Clean up stale sessions
            for session_id in stale_session_ids:
                session = sessions.get(session_id)
                if session and isinstance(session, VoiceSession):
                    # Close WebSocket if still open
                    try:
                        await session.websocket.close()
                    except:
                        pass
                    
                    # Cleanup Deepgram if active
                    if session.deepgram_service:
                        await session.deepgram_service.finish()
                    
                    del sessions[session_id]
                    print(f"Cleaned up session {session_id}")
                    
        except Exception as e:
            print(f"Error in cleanup task: {e}")

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
        self.created_at = datetime.now()
        self.last_activity = time.time()  # Unix timestamp for easy comparison
        self.total_turns = 0
        
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()
    
    def get_conversation_metadata(self) -> dict:
        """Get session metadata"""
        return {
            "session_id": self.session_id,
            "created_at": self.created_at.isoformat(),
            "total_turns": self.total_turns,
            "history_length": len(self.conversation_history),
            "last_activity": datetime.fromtimestamp(self.last_activity).isoformat()
        }

    async def _emit_pronunciation_result(
        self,
        full_pcm: bytes,
        expected_for_turn: str,
        deepgram_text: str,
    ) -> Optional[Dict]:
        cap = settings.TURN_AUDIO_MAX_BYTES
        pcm = full_pcm[:cap] if cap > 0 else full_pcm
        heard_text = ""
        if settings.ENABLE_WAV2VEC2 and pcm:
            heard_text = await asyncio.to_thread(pcm16le_to_text, pcm)
        if not (heard_text or "").strip():
            heard_text = deepgram_text or ""
        body = await asyncio.to_thread(
            build_pronunciation_result_dict,
            phoneme_analyzer,
            expected_for_turn,
            heard_text,
        )
        coach = build_pronunciation_coach_for_llm(
            expected_for_turn,
            heard_text,
            body["score"],
            body.get("feedback") or [],
        )
        await self.send_json({
            "type": "PRONUNCIATION_RESULT",
            "turn_id": self.current_turn_id or "",
            "target_text": expected_for_turn,
            "deepgram_text": deepgram_text,
            "heard_text": heard_text,
            "score": body["score"],
            "expected_phonemes": body["expected_phonemes"],
            "actual_phonemes": body["actual_phonemes"],
            "errors": body["errors"],
            "feedback": body["feedback"],
            "misaligned_words": coach.get("misaligned_words") or [],
        })
        return coach

    async def handle_start_turn(self, msg: ControlMessage):
        """Handle START_TURN: Initialize Deepgram streaming"""
        self.update_activity()
        print(f"START_TURN: {msg.turn_id}")
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
        print(f"END_TURN: {msg.turn_id}")
        
        # Finalize Deepgram
        if self.deepgram_service:
            await self.deepgram_service.finish()
            self.deepgram_service = None

        full_pcm = bytes(self.turn_audio)
        self.turn_audio.clear()

        await asyncio.sleep(0.2)

        if not self.final_transcript:
            print("No transcript received")
            return

        expected_for_turn = (self.active_expected_target or self.target_text or DEFAULT_TARGET_TEXT).strip()
        self.active_expected_target = None

        await self.send_json({
            "type": "FINAL_TRANSCRIPT",
            "text": self.final_transcript,
            "confidence": 1.0,
        })

        pronunciation_coach: Optional[Dict] = None
        try:
            pronunciation_coach = await self._emit_pronunciation_result(
                full_pcm=full_pcm,
                expected_for_turn=expected_for_turn,
                deepgram_text=self.final_transcript,
            )
        except Exception as exc:
            print(f"Pronunciation pipeline failed: {exc}")

        # Check if first turn in session
        is_first_turn = len(self.conversation_history) == 0
        
        # Stream AI response with text batching
        full_response_text = ""
        text_batches_for_tts = []
        
        async for text_chunk in stream_gemini_response(
            self.final_transcript,
            self.conversation_history,
            is_first_turn=is_first_turn,
            pronunciation_coach=pronunciation_coach,
        ):
            if self.should_stop_tts:
                print("LLM streaming interrupted")
                break
            
            full_response_text += text_chunk
            text_batches_for_tts.append(text_chunk)
            
            # Send LLM token chunk to frontend for real-time display
            await self.send_json({
                "type": "LLM_TEXT_CHUNK",
                "text": text_chunk,
                "is_final": False
            })
        
        # Send final AI response
        await self.send_json({
            "type": "AI_RESPONSE",
            "text": full_response_text,
            "has_audio": True
        })

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
                print("TTS interrupted")
                break
            
            # Skip empty batches
            if not text_batch.strip():
                continue
            
            print(f"Synthesizing batch {batch_idx + 1}/{len(text_batches)}: '{text_batch[:50]}...'")
            
            # Generate TTS for this batch (should be 500-800ms of audio)
            audio_base64 = tts_service.text_to_speech(text_batch)
            
            if not audio_base64:
                continue
            
            # Decode from base64
            audio_bytes = base64.b64decode(audio_base64)
            
            # Send as single chunk (already small ~500-800ms)
            is_final = (batch_idx == len(text_batches) - 1)
            
            await self.send_json({
                "type": "TTS_CHUNK",
                "seq": seq,
                "is_final": is_final
            })
            await self.websocket.send_bytes(audio_bytes)
            
            seq += 1
            print(f"Sent TTS chunk {seq} ({len(audio_bytes)} bytes)")
        
        self.is_generating_tts = False
        
    async def stream_tts(self, text: str):
        """Generate TTS and stream in chunks"""
        self.is_generating_tts = True
        
        # Generate full audio
        audio_base64 = tts_service.text_to_speech(text)
        
        if not audio_base64:
            self.is_generating_tts = False
            return
            
        # Decode from base64
        audio_bytes = base64.b64decode(audio_base64)
        
        # Stream in 100KB chunks
        chunk_size = 100_000
        seq = 0
        
        for i in range(0, len(audio_bytes), chunk_size):
            # Check if interrupted
            if self.should_stop_tts:
                print("TTS interrupted")
                break
                
            chunk = audio_bytes[i:i + chunk_size]
            is_final = (i + chunk_size) >= len(audio_bytes)
            
            # Send as binary with JSON header
            await self.send_json({
                "type": "TTS_CHUNK",
                "seq": seq,
                "is_final": is_final
            })
            await self.websocket.send_bytes(chunk)
            
            seq += 1
            
        self.is_generating_tts = False
        
    async def send_json(self, data: dict):
        """Send JSON message"""
        await self.websocket.send_text(json.dumps(data))
        
    def on_partial_transcript(self, text: str, confidence: float):
        """Callback for partial transcript"""
        self.partial_transcript = text
        asyncio.create_task(self.send_json({
            "type": "PARTIAL_TRANSCRIPT",
            "text": text,
            "is_final": False,
            "confidence": confidence
        }))
        
    def on_final_transcript(self, text: str, confidence: float):
        """Callback for final transcript"""
        self.final_transcript = text


# Module-level variables for cleanup task
cleanup_task_started = False
cleanup_task = None

@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """Main WebSocket endpoint for voice conversation"""
    global cleanup_task_started, cleanup_task
    
    await websocket.accept()
    
    session = VoiceSession(websocket)
    sessions[session.session_id] = session
    
    print(f"WebSocket connected: {session.session_id}")
    print(f"Active sessions: {len(sessions)}")
    
    # Start cleanup task (only once)
    if not cleanup_task_started:
        cleanup_task_started = True
        cleanup_task = asyncio.create_task(cleanup_stale_sessions())
        print("Started session cleanup background task")
    
    # Send keep-alive pings every 20s
    async def keep_alive():
        while True:
            try:
                await asyncio.sleep(20)
                await websocket.send_text(json.dumps({"type": "PING"}))
            except:
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
        print(f"WebSocket disconnected: {session.session_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.send_text(json.dumps({
            "type": "ERROR",
            "message": str(e),
            "recoverable": False
        }))
    finally:
        # Cleanup
        ping_task.cancel()
        if session.deepgram_service:
            await session.deepgram_service.finish()
        if session.session_id in sessions:
            del sessions[session.session_id]
        print(f"Cleaned up session: {session.session_id}")


@router.get("/sessions/stats")
async def get_session_stats():
    """Get active session statistics"""
    active_count = len(sessions)
    session_list = []
    
    for session_id, session in sessions.items():
        if isinstance(session, VoiceSession):
            session_list.append(session.get_conversation_metadata())
    
    return {
        "active_sessions": active_count,
        "sessions": session_list
    }

