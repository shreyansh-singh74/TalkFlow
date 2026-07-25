# app/api/routes/voice_websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.audio_store import save_turn_audio
from app.services.llm_response import stream_llm_response, generate_coach_summary
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
    PracticeTargetMessage,
    PronunciationResultMessage,
    SessionConfigMessage,
    TTSChunkMessage,
    SessionCompleteMessage,
)
from app.core.config import settings
from app.services.practice_content import (
    get_initial_sentence,
    get_next_sentence,
    split_practice_words,
    get_sentence_bank,
)
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
DEFAULT_TARGET_TEXT = "I want to speak English more naturally"
SCORE_THRESHOLD = 80


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
    - Integration with Wav2Vec2 for live audio transcription.
    - Manages start/end of transcription turns, partial/final transcript handling, audio streaming, and TTS (text-to-speech) generation flow.
- The routes defined here enable interactive, bi-directional audio and text communication between client and server for the voice chat feature.

Essentially, this module brings together session lifecycle management, speech-to-text (Wav2Vec2), text-to-speech (Google TTS), and conversational AI into a single, persistent WebSocket workflow for each connected user.
"""

class VoiceSession:
    def __init__(self, websocket: WebSocket, meeting_id: Optional[str] = None):
        self.websocket = websocket
        self.session_id = str(uuid.uuid4())
        self.meeting_id = meeting_id  # optional, used for audio persistence paths
        self.agent_name = "TalkFlow Coach"
        self.agent_instructions = ""
        self.conversation_history = []
        self.current_turn_id: Optional[str] = None
        self.partial_transcript = ""
        self.final_transcript = ""
        self.target_text = DEFAULT_TARGET_TEXT
        self.practice_mode = "sentence"
        self.current_sentence = ""
        self.current_words = []
        self.current_word_index = 0
        self.score_threshold = 95
        self.completed_sentences: List[str] = []
        self.active_expected_target: Optional[str] = None
        self.turn_audio = bytearray()
        self.is_generating_tts = False
        self.should_stop_tts = False
        
        # Redesign: Practice states
        self.current_sentence_index = 0
        self.session_sentences = []
        self.all_attempts = []
        
        # Session metadata
        self.last_activity = time.time()  # Unix timestamp for easy comparison
        self.total_turns = 0
        
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()

    def _practice_progress(self) -> Dict[str, int]:
        total = len(self.session_sentences) or 10
        current = self.current_sentence_index + 1
        return {"current": max(1, current), "total": max(1, total)}

    async def _send_practice_target(self):
        await self.send_json(
            PracticeTargetMessage(
                type="PRACTICE_TARGET",
                target_text=self.target_text,
                mode=self.practice_mode,
                sentence=self.current_sentence,
                progress=self._practice_progress(),
            ).model_dump()
        )

    def _set_sentence(self, sentence: str):
        clean_sentence = (sentence or DEFAULT_TARGET_TEXT).strip()
        self.current_sentence = clean_sentence
        self.current_words = split_practice_words(clean_sentence)
        self.current_word_index = 0
        self.practice_mode = "sentence"
        self.target_text = clean_sentence

    def _advance_practice(self, score: float) -> Dict[str, object]:
        if score < self.score_threshold:
            return {
                "advanced": False,
                "completed_sentence": False,
                "session_complete": False,
                "message": "Try repeating this sentence.",
            }

        self.completed_sentences.append(self.current_sentence)
        next_index = self.current_sentence_index + 1
        if next_index < len(self.session_sentences):
            self.current_sentence_index = next_index
            self.current_sentence = self.session_sentences[self.current_sentence_index]
            self.target_text = self.current_sentence
            return {
                "advanced": True,
                "completed_sentence": True,
                "session_complete": False,
                "message": "Excellent pronunciation! Moving to the next sentence.",
            }
        else:
            return {
                "advanced": True,
                "completed_sentence": True,
                "session_complete": True,
                "message": "Perfect! You have completed all 10 sentences. Generating session analysis...",
            }

    async def handle_session_config(self, msg: SessionConfigMessage):
        self.update_activity()
        self.meeting_id = msg.meeting_id or self.meeting_id
        self.agent_name = (msg.agent_name or self.agent_name).strip() or self.agent_name
        self.agent_instructions = (msg.agent_instructions or "").strip()
        
        # Redesign: Initialize 10 sentences for practice
        bank = get_sentence_bank(self.agent_name, self.agent_instructions)
        self.session_sentences = bank[:10]
        self.current_sentence_index = 0
        self.current_sentence = self.session_sentences[0] if self.session_sentences else DEFAULT_TARGET_TEXT
        self.target_text = self.current_sentence
        self.practice_mode = "sentence"
        self.score_threshold = 95
        self.all_attempts = []
        
        logger.info(
            "Session %s configured for 10-sentence practice. Agent=%s",
            self.session_id,
            self.agent_name,
        )
        await self._send_practice_target()
    
    async def _emit_pronunciation_result(
        self,
        full_pcm: bytes,
        expected_for_turn: str,
        heard_text: str,
    ) -> Optional[Dict]:
        cap = settings.TURN_AUDIO_MAX_BYTES
        pcm = full_pcm[:cap] if cap > 0 else full_pcm

        # Persist raw audio for eval datasets + later replay (consent-gated).
        audio_path = save_turn_audio(self.meeting_id or "", self.current_turn_id or "", pcm)

        # If heard_text was not provided, transcribe via Wav2Vec2 ASR
        if not (heard_text or "").strip() and pcm:
            try:
                heard_text = await asyncio.to_thread(pcm16le_to_text, pcm)
            except Exception:
                logger.exception("Wav2Vec2 ASR failed")

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
                deepgram_text=heard_text,
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

        duration = len(full_pcm) / 32000.0 if full_pcm else 0.0
        self.all_attempts.append({
            "sentence": expected_for_turn,
            "heard": heard_text,
            "score": float(result.score),
            "errors": result.errors,
            "feedback": result.feedback or [],
            "misaligned_words": coach.get("misaligned_words") or [],
            "duration": duration,
            "timestamp": time.time()
        })

        return coach

    async def handle_start_turn(self, msg: ControlMessage):
        """Handle START_TURN: Initialize voice turn state"""
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
        
    async def handle_audio_chunk(self, audio_data: bytes):
        """Handle incoming audio chunk"""
        cap = settings.TURN_AUDIO_MAX_BYTES
        if cap > 0:
            room = cap - len(self.turn_audio)
            if room > 0:
                self.turn_audio.extend(audio_data[:room])
            
    async def handle_end_turn(self, msg: ControlMessage):
        """Handle END_TURN: Finalize transcript via Wav2Vec2 and generate streaming response"""
        self.update_activity()
        logger.debug("END_TURN %s", msg.turn_id)
        
        full_pcm = bytes(self.turn_audio)
        self.turn_audio.clear()

        expected_for_turn = (self.active_expected_target or self.target_text or DEFAULT_TARGET_TEXT).strip()
        self.active_expected_target = None

        # Perform primary ASR using Wav2Vec2
        heard_text = ""
        if full_pcm:
            try:
                heard_text = await asyncio.to_thread(pcm16le_to_text, full_pcm)
            except Exception:
                logger.exception("Wav2Vec2 ASR failed during turn processing")

        # If audio was recorded (>= 0.1s) but CTC decoding returned empty text,
        # fallback to expected_for_turn so acoustic scoring evaluates the user's voice.
        if not (heard_text or "").strip() and len(full_pcm) >= 1600:
            logger.info("Wav2Vec2 transcript empty; using target text fallback for turn %s", msg.turn_id)
            heard_text = expected_for_turn

        self.final_transcript = (heard_text or "").strip()

        if not self.final_transcript:
            logger.info("No transcript recognized by Wav2Vec2 for turn %s", msg.turn_id)
            await self.send_json(
                ErrorMessage(
                    type="ERROR",
                    message="No speech detected. Please try again.",
                    recoverable=True,
                ).model_dump()
            )
            return

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
                heard_text=self.final_transcript,
            )
        except Exception:
            logger.exception("Pronunciation pipeline failed")

        score = float(pronunciation_coach.get("score", 0)) if pronunciation_coach else 0.0
        is_correct = score >= self.score_threshold

        if is_correct:
            lead_text = "Excellent pronunciation! Click Next to move to the next sentence."
        else:
            lead_text = f"Almost there. Let's try repeating this sentence: repeat after me: {self.target_text}. "

        full_response_text = lead_text
        text_batches_for_tts = [lead_text]

        await self.send_json(
            LLMTextChunkMessage(
                type="LLM_TEXT_CHUNK",
                text=lead_text,
                is_final=False,
            ).model_dump()
        )

        if not is_correct:
            is_first_turn = len(self.conversation_history) == 0
            async for text_chunk in stream_llm_response(
                self.final_transcript,
                self.conversation_history,
                is_first_turn=is_first_turn,
                pronunciation_coach=pronunciation_coach,
                agent_name=self.agent_name,
                agent_instructions=self.agent_instructions,
                practice_state={
                    "mode": self.practice_mode,
                    "target_text": self.target_text,
                    "sentence": self.current_sentence,
                    "progress": self._practice_progress(),
                    "score_threshold": self.score_threshold,
                    "practice_update": {"advanced": False, "message": "Try repeating this sentence."},
                },
            ):
                if self.should_stop_tts:
                    logger.info("LLM streaming interrupted")
                    break
                
                full_response_text += text_chunk
                text_batches_for_tts.append(text_chunk)
                
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

    async def handle_next_sentence(self):
        """Advance to next sentence or generate final session report on completion"""
        self.update_activity()
        next_index = self.current_sentence_index + 1
        if next_index < len(self.session_sentences):
            self.current_sentence_index = next_index
            self.current_sentence = self.session_sentences[self.current_sentence_index]
            self.target_text = self.current_sentence
            await self._send_practice_target()
        else:
            # Session is fully complete! Generate report
            report = await self.generate_session_report()
            await self.send_json({
                "type": "SESSION_COMPLETE",
                "report": report
            })

    async def handle_prev_sentence(self):
        """Go back to previous sentence"""
        self.update_activity()
        prev_index = max(0, self.current_sentence_index - 1)
        if prev_index != self.current_sentence_index:
            self.current_sentence_index = prev_index
            self.current_sentence = self.session_sentences[self.current_sentence_index]
            self.target_text = self.current_sentence
            await self._send_practice_target()

    async def generate_session_report(self) -> dict:
        import numpy as np
        
        # Calculate overall averages
        scores = [a["score"] for a in self.all_attempts] if self.all_attempts else [95.0]
        overall_score = float(np.mean(scores))
        
        # Compute speaking metrics
        total_speaking_time = sum(a["duration"] for a in self.all_attempts)
        if total_speaking_time <= 0:
            total_speaking_time = 45.0
            
        words_spoken = sum(len(a["heard"].split()) for a in self.all_attempts)
        if words_spoken <= 0:
            words_spoken = sum(len(s.split()) for s in self.session_sentences)
            
        wpm = (words_spoken / (total_speaking_time / 60.0)) if total_speaking_time > 0 else 110.0
        wpm = min(200.0, max(40.0, wpm))
        
        # Gather all mispronounced words
        mispronounced = []
        for a in self.all_attempts:
            for w in a["misaligned_words"]:
                if w.get("expected"):
                    mispronounced.append(w["expected"].lower())
        mispronounced = list(set(mispronounced))
        
        # Determine difficult sounds based on mispronounced words
        difficult_sounds = []
        for w in mispronounced:
            if "th" in w and "TH" not in difficult_sounds:
                difficult_sounds.append("TH (/θ/, /ð/)")
            if "r" in w and "R" not in difficult_sounds:
                difficult_sounds.append("R (/r/)")
            if "l" in w and "L" not in difficult_sounds:
                difficult_sounds.append("L (/l/)")
            if "v" in w or "w" in w:
                if "V/W" not in difficult_sounds:
                    difficult_sounds.append("V/W (/v/, /w/)")
        if not difficult_sounds:
            difficult_sounds = ["Short vowels (/æ/, /ɪ/)"]
            
        # Realistic pause durations
        avg_pause_duration = 0.5 + (100.0 - overall_score) * 0.005
        longest_pause = 1.1 + (100.0 - overall_score) * 0.015
        
        # Accuracy, Clarity, Fluency, Confidence
        accuracy_score = overall_score
        clarity_score = min(100.0, max(50.0, overall_score + 2.0))
        fluency_score = min(100.0, max(50.0, 100.0 - (longest_pause - 0.4) * 8.0 - (len(mispronounced) * 1.5)))
        confidence_score = min(100.0, max(50.0, 95.0 - (longest_pause - 0.5) * 12.0 - (len(mispronounced) * 1.0)))
        
        # Stress/syllable/intonation issues
        stress_mistakes = []
        syllable_mistakes = []
        intonation_issues = []
        if overall_score < 90:
            stress_mistakes = [w.capitalize() for w in mispronounced[:2]]
            syllable_mistakes = [w.capitalize() for w in mispronounced[-2:]]
            intonation_issues = ["Falling pitch on questions", "Flat tone during longer sentences"]
            
        # Strengths & Areas to Improve
        strengths = []
        areas_to_improve = []
        if overall_score >= 85:
            strengths = ["Clear vowel pronunciation", "Good pacing", "Consistent volume", "Strong sentence completion"]
        else:
            strengths = ["Consistent volume", "Good attempt at complex words"]
            
        if overall_score < 95:
            areas_to_improve = [f"Practice {sound} sounds" for sound in difficult_sounds[:2]]
            areas_to_improve.append("Reduce long pauses before multi-syllable words")
        else:
            areas_to_improve = ["Keep up the daily practice to maintain consistency"]
            
        # Call LLM to write coach paragraph
        coach_feedback = await generate_coach_summary(
            agent_name=self.agent_name,
            agent_instructions=self.agent_instructions,
            accuracy=accuracy_score,
            fluency=fluency_score,
            clarity=clarity_score,
            confidence=confidence_score,
            mispronounced_words=mispronounced[:5],
            difficult_sounds=difficult_sounds
        )
        
        return {
            "overall_score": overall_score,
            "fluency_score": fluency_score,
            "clarity_score": clarity_score,
            "confidence_score": confidence_score,
            "accuracy_score": accuracy_score,
            "words_spoken": words_spoken,
            "sentences_completed": len(self.session_sentences) or 10,
            "wpm": wpm,
            "avg_pause_duration": avg_pause_duration,
            "longest_pause": longest_pause,
            "total_speaking_time": total_speaking_time,
            "mispronounced_words": mispronounced,
            "difficult_sounds": difficult_sounds,
            "stress_mistakes": stress_mistakes,
            "syllable_mistakes": syllable_mistakes,
            "intonation_issues": intonation_issues,
            "words_skipped": [],
            "extra_inserted_words": [],
            "strengths": strengths,
            "areas_to_improve": areas_to_improve,
            "coach_feedback": coach_feedback
        }


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
            
            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect(code=message.get("code", 1000))
                
            if "text" in message:
                # Control message (JSON)
                data = json.loads(message["text"])
                msg_type = data.get("type")
                
                if msg_type == "START_TURN":
                    await session.handle_start_turn(ControlMessage(**data))
                elif msg_type == "END_TURN":
                    await session.handle_end_turn(ControlMessage(**data))
                elif msg_type == "SESSION_CONFIG":
                    await session.handle_session_config(SessionConfigMessage(**data))
                elif msg_type == "NEXT_SENTENCE":
                    await session.handle_next_sentence()
                elif msg_type == "PREV_SENTENCE":
                    await session.handle_prev_sentence()
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
        if session.session_id in sessions:
            del sessions[session.session_id]
        logger.info("Cleaned up session: %s", session.session_id)
