# app/api/routes/voice_websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.deepgram_live_service import DeepgramLiveService
from app.services.gemini_response import get_gemini_response
from app.services.tts_service import tts_service
from app.schemas.websocket_messages import ControlMessage
import json
import uuid
import asyncio
import base64
from typing import Dict, Optional

router = APIRouter()

# Session storage: session_id -> session_data
sessions: Dict[str, dict] = {}


class VoiceSession:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.session_id = str(uuid.uuid4())
        self.conversation_history = []
        self.deepgram_service: Optional[DeepgramLiveService] = None
        self.current_turn_id: Optional[str] = None
        self.partial_transcript = ""
        self.final_transcript = ""
        self.is_generating_tts = False
        self.should_stop_tts = False
        
    async def handle_start_turn(self, msg: ControlMessage):
        """Handle START_TURN: Initialize Deepgram streaming"""
        print(f"📞 START_TURN: {msg.turn_id}")
        self.current_turn_id = msg.turn_id
        self.partial_transcript = ""
        self.final_transcript = ""
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
        if self.deepgram_service:
            await self.deepgram_service.send_audio(audio_data)
            
    async def handle_end_turn(self, msg: ControlMessage):
        """Handle END_TURN: Finalize transcript and generate response"""
        print(f"📞 END_TURN: {msg.turn_id}")
        
        # Finalize Deepgram
        if self.deepgram_service:
            await self.deepgram_service.finish()
            self.deepgram_service = None
            
        # Wait a bit for final transcript
        await asyncio.sleep(0.2)
        
        if not self.final_transcript:
            print("⚠️ No transcript received")
            return
            
        # Send final transcript
        await self.send_json({
            "type": "FINAL_TRANSCRIPT",
            "text": self.final_transcript,
            "confidence": 1.0
        })
        
        # Generate AI response
        ai_response = get_gemini_response(
            self.final_transcript,
            self.conversation_history
        )
        
        # Update conversation history
        self.conversation_history.append({
            "user": self.final_transcript,
            "ai": ai_response,
            "turn": len(self.conversation_history) + 1
        })
        
        # Keep last 10 turns
        self.conversation_history = self.conversation_history[-10:]
        
        # Send AI response text
        await self.send_json({
            "type": "AI_RESPONSE",
            "text": ai_response,
            "has_audio": True
        })
        
        # Generate and stream TTS
        await self.stream_tts(ai_response)
        
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
                print("⏹️ TTS interrupted")
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


@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """Main WebSocket endpoint for voice conversation"""
    await websocket.accept()
    
    session = VoiceSession(websocket)
    sessions[session.session_id] = session
    
    print(f"✅ WebSocket connected: {session.session_id}")
    
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
        print(f"❌ WebSocket disconnected: {session.session_id}")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
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
        print(f"🧹 Cleaned up session: {session.session_id}")

