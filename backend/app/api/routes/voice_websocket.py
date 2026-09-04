# app/api/routes/voice_websocket.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.audio_store import save_turn_audio
from app.services.llm_response import stream_llm_response, generate_coach_summary
from app.services.pronunciation import get_scorer
from app.services.pronunciation_coach import build_pronunciation_coach_for_llm
from app.services.tts_service import tts_service
from app.services.asr import pcm16le_to_text
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
    DEFAULT_DIFFICULTY,
    fallback_steps,
    pass_threshold_for,
    split_practice_words,
)
from app.utils.text import tokenize_words
import json
import uuid
import asyncio
import base64
import logging
import time
from collections import defaultdict
from datetime import datetime
from typing import Dict, Optional, List, Tuple

router = APIRouter()
logger = logging.getLogger(__name__)

# Session storage: connection_id -> VoiceSession
sessions: Dict[str, dict] = {}

# Session timeout from config
SESSION_TIMEOUT_SECONDS = settings.SESSION_TIMEOUT_MINUTES * 60

#: The engine no longer chooses practice content -- the script arrives in
#: SESSION_CONFIG. This literal exists only for the degenerate case where a
#: client connects and starts a turn before configuring anything.
EMPTY_SESSION_TEXT = "I want to speak English more naturally"

#: Coach copy kept out of the handler bodies so it is editable in one place.
COACH_LINES = {
    "pass": "Excellent pronunciation! Click Next to move to the next step.",
    "retry": "Almost there. Let's try repeating this one: repeat after me: {target}. ",
    "advance": "Excellent pronunciation! Moving to the next step.",
    "retry_short": "Try repeating this step.",
    "complete": "Perfect! You have completed all {total} steps. Generating session analysis...",
}

#: A phone needs at least this many observations across the session before it is
#: reported as a difficulty. Below that, one unlucky frame reads as a weakness.
MIN_PHONE_OBSERVATIONS = 3


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
            stale_connection_ids = []
            
            for connection_id, session in sessions.items():
                if isinstance(session, VoiceSession):
                    time_since_activity = current_time - session.last_activity
                    
                    if time_since_activity > SESSION_TIMEOUT_SECONDS:
                        logger.info(
                            "Session %s inactive for %.1f minutes, cleaning up",
                            connection_id,
                            time_since_activity / 60,
                        )
                        stale_connection_ids.append(connection_id)
            
            # Clean up stale sessions
            for connection_id in stale_connection_ids:
                session = sessions.get(connection_id)
                if session and isinstance(session, VoiceSession):
                    # Close WebSocket if still open
                    try:
                        await session.websocket.close()
                    except Exception:
                        pass
                    
                    del sessions[connection_id]
                    logger.info("Cleaned up stale session %s", connection_id)
                    
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
    - Integration with the WavLM ASR model for live audio transcription.
    - Manages start/end of transcription turns, partial/final transcript handling, audio streaming, and TTS (text-to-speech) generation flow.
- The routes defined here enable interactive, bi-directional audio and text communication between client and server for the voice chat feature.

Essentially, this module brings together session lifecycle management, speech-to-text (WavLM CTC), text-to-speech (Google TTS), and conversational AI into a single, persistent WebSocket workflow for each connected user.
"""

class VoiceSession:
    def __init__(self, websocket: WebSocket, session_id: Optional[str] = None):
        self.websocket = websocket
        # Two distinct ids, deliberately named apart: `connection_id` keys the
        # in-memory `sessions` registry for the lifetime of this socket, while
        # `practice_session_id` is the Postgres practice_sessions row the client
        # is running. They are not interchangeable.
        self.connection_id = str(uuid.uuid4())
        self.practice_session_id = session_id  # used for audio persistence paths
        self.coach_name = "TalkFlow Coach"
        self.coach_instructions = ""
        self.conversation_history = []
        self.current_turn_id: Optional[str] = None
        self.partial_transcript = ""
        self.final_transcript = ""
        self.target_text = EMPTY_SESSION_TEXT
        self.practice_mode = "sentence"
        self.current_sentence = ""
        self.current_words = []
        self.current_word_index = 0
        self.completed_sentences: List[str] = []
        self.active_expected_target: Optional[str] = None
        self.turn_audio = bytearray()
        self.is_generating_tts = False
        self.should_stop_tts = False

        # The script, supplied wholesale by the client in SESSION_CONFIG.
        self.current_sentence_index = 0
        self.session_sentences: List[str] = []
        self.step_notes: List[Optional[str]] = []
        self.topic = ""
        self.difficulty = DEFAULT_DIFFICULTY
        self.accent = settings.TARGET_ACCENT
        self.source = "coach"
        self.score_threshold = pass_threshold_for(DEFAULT_DIFFICULTY)
        self.all_attempts = []

        # Session metadata
        self.last_activity = time.time()  # Unix timestamp for easy comparison
        self.total_turns = 0

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()

    def _practice_progress(self) -> Dict[str, int]:
        total = len(self.session_sentences) or 1
        current = self.current_sentence_index + 1
        return {"current": max(1, current), "total": max(1, total)}

    def _context_for(self, index: int) -> Tuple[Optional[str], Optional[str]]:
        """The neighbouring steps, for custom-text sessions only.

        Rehearsing a speech line-by-line without seeing what comes before and
        after is how people learn to deliver disconnected sentences. For a
        coach-generated script the steps are independent, so context is noise.
        """
        if self.source != "custom":
            return None, None
        before = self.session_sentences[index - 1] if index > 0 else None
        after = (
            self.session_sentences[index + 1]
            if index + 1 < len(self.session_sentences)
            else None
        )
        return before, after

    def _note_for(self, index: int) -> Optional[str]:
        if 0 <= index < len(self.step_notes):
            return self.step_notes[index]
        return None

    async def _send_practice_target(self):
        before, after = self._context_for(self.current_sentence_index)
        await self.send_json(
            PracticeTargetMessage(
                type="PRACTICE_TARGET",
                target_text=self.target_text,
                mode=self.practice_mode,
                sentence=self.current_sentence,
                progress=self._practice_progress(),
                step_index=self.current_sentence_index,
                pass_threshold=self.score_threshold,
                context_before=before,
                context_after=after,
                note=self._note_for(self.current_sentence_index),
            ).model_dump()
        )

    def _set_sentence(self, sentence: str):
        clean_sentence = (sentence or EMPTY_SESSION_TEXT).strip()
        self.current_sentence = clean_sentence
        self.current_words = split_practice_words(clean_sentence)
        self.current_word_index = 0
        self.practice_mode = "sentence"
        self.target_text = clean_sentence

    def _go_to_step(self, index: int):
        """Move the cursor to *index* and resync every derived field."""
        if not self.session_sentences:
            return
        self.current_sentence_index = max(0, min(index, len(self.session_sentences) - 1))
        self._set_sentence(self.session_sentences[self.current_sentence_index])

    def _advance_practice(self, score: float) -> Dict[str, object]:
        if score < self.score_threshold:
            return {
                "advanced": False,
                "completed_sentence": False,
                "session_complete": False,
                "message": COACH_LINES["retry_short"],
            }

        self.completed_sentences.append(self.current_sentence)
        next_index = self.current_sentence_index + 1
        if next_index < len(self.session_sentences):
            self._go_to_step(next_index)
            return {
                "advanced": True,
                "completed_sentence": True,
                "session_complete": False,
                "message": COACH_LINES["advance"],
            }
        else:
            return {
                "advanced": True,
                "completed_sentence": True,
                "session_complete": True,
                "message": COACH_LINES["complete"].format(
                    total=len(self.session_sentences) or 1
                ),
            }

    async def handle_session_config(self, msg: SessionConfigMessage):
        self.update_activity()
        self.practice_session_id = msg.session_id or self.practice_session_id
        self.coach_name = (msg.coach_name or self.coach_name).strip() or self.coach_name
        self.coach_instructions = (msg.coach_instructions or "").strip()
        self.topic = (msg.topic or "").strip()
        self.difficulty = msg.difficulty
        self.accent = (msg.accent or self.accent).strip() or self.accent
        self.source = msg.source

        # The client owns the script: it was generated, band-validated and
        # possibly hand-edited at session-creation time. The engine executes it
        # and picks nothing of its own.
        steps = sorted(msg.steps, key=lambda s: s.index)
        pairs = [(s.text.strip(), s.note) for s in steps if s.text.strip()]

        if not pairs:
            # An old client, or a session whose script failed to persist.
            # Degrade to the difficulty-tiered bank rather than to one literal.
            logger.warning(
                "SESSION_CONFIG carried no steps; falling back to the %s bank",
                self.difficulty,
            )
            pairs = [(text, None) for text in fallback_steps(self.difficulty, 10)]

        self.session_sentences = [text for text, _ in pairs]
        self.step_notes = [note for _, note in pairs]
        self.score_threshold = msg.pass_threshold or pass_threshold_for(self.difficulty)
        self.completed_sentences = []
        self.all_attempts = []
        self.current_sentence_index = 0
        self._set_sentence(self.session_sentences[0])

        logger.info(
            "Session %s configured: %d steps, source=%s, difficulty=%s, pass=%.0f%%, coach=%s",
            self.connection_id,
            len(self.session_sentences),
            self.source,
            self.difficulty,
            self.score_threshold,
            self.coach_name,
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
        audio_path = save_turn_audio(self.practice_session_id or "", self.current_turn_id or "", pcm)

        # If heard_text was not provided, transcribe via the ASR model
        if not (heard_text or "").strip() and pcm:
            try:
                heard_text = await asyncio.to_thread(pcm16le_to_text, pcm)
            except Exception:
                logger.exception("ASR failed")

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
        stress = result.stress.to_dict() if result.stress else None
        timing = result.timing.to_dict() if result.timing else None
        intonation = result.intonation.to_dict() if result.intonation else None

        await self.send_json(
            PronunciationResultMessage(
                type="PRONUNCIATION_RESULT",
                turn_id=self.current_turn_id or "",
                target_text=expected_for_turn,
                heard_text=heard_text,
                score=result.score,
                expected_phonemes=result.expected_phonemes,
                actual_phonemes=result.actual_phonemes,
                errors=result.errors,
                feedback=result.feedback,
                misaligned_words=coach.get("misaligned_words") or [],
                method=result.method,
                per_phoneme=result.per_phoneme,
                accent=result.accent,
                audio_path=audio_path,
                stress=stress,
                timing=timing,
                intonation=intonation,
                diagnosis=result.diagnosis,
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
            # Retained for the end-of-session report: this is the only source of
            # real phone-level data, and it is what `difficult_sounds` is built
            # from instead of guessing at spelling.
            "method": result.method,
            "per_phoneme": result.per_phoneme or [],
            "stress": stress,
            "timing": timing,
            "intonation": intonation,
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
        """Handle END_TURN: Finalize transcript via ASR and generate streaming response"""
        self.update_activity()
        logger.debug("END_TURN %s", msg.turn_id)

        full_pcm = bytes(self.turn_audio)
        self.turn_audio.clear()

        expected_for_turn = (self.active_expected_target or self.target_text or EMPTY_SESSION_TEXT).strip()
        self.active_expected_target = None

        # Perform primary ASR
        heard_text = ""
        if full_pcm:
            try:
                heard_text = await asyncio.to_thread(pcm16le_to_text, full_pcm)
            except Exception:
                logger.exception("ASR failed during turn processing")

        self.final_transcript = (heard_text or "").strip()

        if not self.final_transcript:
            logger.info("No transcript recognized for turn %s", msg.turn_id)
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
            lead_text = COACH_LINES["pass"]
        else:
            lead_text = COACH_LINES["retry"].format(target=self.target_text)

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
                coach_name=self.coach_name,
                coach_instructions=self.coach_instructions,
                practice_state={
                    "mode": self.practice_mode,
                    "target_text": self.target_text,
                    "sentence": self.current_sentence,
                    "progress": self._practice_progress(),
                    "score_threshold": self.score_threshold,
                    "practice_update": {"advanced": False, "message": COACH_LINES["retry_short"]},
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
        """Advance to the next step, or report on the session once it's done."""
        self.update_activity()
        next_index = self.current_sentence_index + 1
        if next_index < len(self.session_sentences):
            self._go_to_step(next_index)
            await self._send_practice_target()
        else:
            # Session is fully complete! Generate report
            report = await self.generate_session_report()
            await self.send_json(
                SessionCompleteMessage(type="SESSION_COMPLETE", report=report).model_dump()
            )

    async def handle_prev_sentence(self):
        """Go back to the previous step."""
        self.update_activity()
        prev_index = self.current_sentence_index - 1
        if prev_index >= 0:
            self._go_to_step(prev_index)
            await self._send_practice_target()

    def _phone_stats(self) -> Dict[str, Dict[str, float]]:
        """Per-phone tallies across every attempt in the session.

        ``per_phoneme[*]["expected"]`` is already an IPA symbol (see
        ``pronunciation/scoring.py``), so it doubles as the display label.
        """
        stats: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {"total": 0.0, "wrong": 0.0, "accuracy": 0.0}
        )
        for attempt in self.all_attempts:
            for phone in attempt.get("per_phoneme") or []:
                expected = (phone.get("expected") or "").strip()
                if not expected:
                    continue
                bucket = stats[expected]
                bucket["total"] += 1
                bucket["accuracy"] += float(phone.get("accuracy") or 0.0)
                if not phone.get("is_correct"):
                    bucket["wrong"] += 1
        return stats

    def _difficult_sounds(self) -> Tuple[List[str], List[Dict[str, object]]]:
        """The phones this speaker actually got wrong, ranked by error rate.

        Replaces the old spelling heuristic (``if "th" in word``), which
        reported /θ/ for "the", "with" and "author" whether or not the speaker
        had any trouble with it.
        """
        ranked = [
            {
                "phone": phone,
                "label": f"/{phone}/",
                "observations": int(s["total"]),
                "error_rate": round(s["wrong"] / s["total"], 3),
                "avg_accuracy": round(s["accuracy"] / s["total"], 1),
            }
            for phone, s in self._phone_stats().items()
            if s["total"] >= MIN_PHONE_OBSERVATIONS and s["wrong"] > 0
        ]
        ranked.sort(key=lambda d: (-d["error_rate"], -d["observations"]))
        top = ranked[:3]
        return [d["label"] for d in top], top

    def _strong_sounds(self) -> List[str]:
        strong = [
            (phone, s["total"])
            for phone, s in self._phone_stats().items()
            if s["total"] >= MIN_PHONE_OBSERVATIONS and s["wrong"] == 0
        ]
        strong.sort(key=lambda pair: -pair[1])
        return [f"/{phone}/" for phone, _ in strong[:3]]

    async def generate_session_report(self) -> dict:
        """Summarise the session using only values that were measured.

        Every number below is derived from real turn data, or is ``None``.
        Nothing is synthesised from the overall score -- a learner reading
        "longest pause: 1.4s" is reading a pause that was actually timed, and a
        stat that could not be measured is absent rather than invented.
        """
        attempts = self.all_attempts
        scores = [float(a["score"]) for a in attempts]
        overall_score = round(sum(scores) / len(scores), 2) if scores else None

        # --- segmental accuracy, straight off the acoustic scorer ----------
        phone_accuracies = [
            float(p.get("accuracy") or 0.0)
            for a in attempts
            for p in (a.get("per_phoneme") or [])
        ]
        accuracy_score = (
            round(sum(phone_accuracies) / len(phone_accuracies), 2)
            if phone_accuracies
            else None
        )

        # Fluency here means *consistency*: a speaker whose phone accuracy
        # swings wildly is harder to follow than one who is uniformly slightly
        # off at the same mean. Zero spread -> 100; ~40 points of standard
        # deviation -> 0. Requires acoustic scoring; None under the text proxy.
        fluency_score = None
        if len(phone_accuracies) >= MIN_PHONE_OBSERVATIONS and accuracy_score is not None:
            variance = sum((x - accuracy_score) ** 2 for x in phone_accuracies) / len(
                phone_accuracies
            )
            fluency_score = round(max(0.0, min(100.0, 100.0 - (variance ** 0.5) * 2.5)), 1)

        # --- what was actually spoken -------------------------------------
        # Prefer VAD-measured speech time: the raw clip also contains the gap
        # between pressing the button and starting to talk, which would drag
        # every words-per-minute figure down.
        speech_time = 0.0
        for a in attempts:
            timing = a.get("timing") or {}
            fraction = float(timing.get("speech_fraction") or 0.0)
            speech_time += a["duration"] * fraction if fraction > 0 else a["duration"]

        total_speaking_time = round(speech_time, 2) if attempts else None
        words_spoken = sum(len(tokenize_words(a["heard"])) for a in attempts)
        wpm = (
            round(words_spoken / (speech_time / 60.0), 1)
            if speech_time > 0 and words_spoken > 0
            else None
        )

        # --- pausing: VAD only, never derived from the score ---------------
        pauses = [
            float(p.get("duration") or 0.0)
            for a in attempts
            for p in ((a.get("timing") or {}).get("pauses") or [])
        ]
        avg_pause_duration = round(sum(pauses) / len(pauses), 2) if pauses else None
        longest_pause = round(max(pauses), 2) if pauses else None

        # --- word-level alignment ------------------------------------------
        mispronounced: List[str] = []
        words_skipped: List[str] = []
        extra_inserted_words: List[str] = []
        for a in attempts:
            for pair in a["misaligned_words"]:
                expected = (pair.get("expected") or "").strip().lower()
                heard = (pair.get("heard") or "").strip().lower()
                if expected and heard:
                    mispronounced.append(expected)
                elif expected:
                    words_skipped.append(expected)
                elif heard:
                    extra_inserted_words.append(heard)

        mispronounced = sorted(set(mispronounced))
        words_skipped = sorted(set(words_skipped))
        extra_inserted_words = sorted(set(extra_inserted_words))

        difficult_sounds, phone_breakdown = self._difficult_sounds()

        # --- prosody: present only when those scorers ran -------------------
        stress_results = [a["stress"] for a in attempts if a.get("stress")]
        stress_mistakes: Optional[List[str]] = None
        syllable_mistakes: Optional[List[str]] = None
        if stress_results:
            under_stressed, over_stressed = set(), set()
            for result in stress_results:
                for syl in result.get("syllables") or []:
                    label = (syl.get("syllable") or "").strip()
                    expected_stressed = syl.get("expected_stressed")
                    if not label or expected_stressed is None:
                        continue
                    if float(syl.get("score") or 0.0) >= 0.5:
                        continue
                    # Missed the stress on a syllable that carries it, vs put
                    # stress on one that shouldn't have it.
                    (under_stressed if expected_stressed else over_stressed).add(label)
            stress_mistakes = sorted(under_stressed)[:5]
            syllable_mistakes = sorted(over_stressed)[:5]

        intonation_results = [a["intonation"] for a in attempts if a.get("intonation")]
        intonation_issues: Optional[List[str]] = None
        if intonation_results:
            intonation_issues = sorted(
                {
                    f"Pitch contour read as {result.get('label') or 'off target'}"
                    for result in intonation_results
                    if float(result.get("score") or 0.0) < 70.0
                }
            )

        # --- narrative, built from the above rather than from score bands ---
        strengths: List[str] = []
        strong_sounds = self._strong_sounds()
        if strong_sounds:
            strengths.append(f"Consistently clear {', '.join(strong_sounds)}")
        if self.completed_sentences:
            strengths.append(
                f"Completed {len(self.completed_sentences)} of "
                f"{len(self.session_sentences) or 1} steps"
            )
        if not words_skipped and attempts:
            strengths.append("Read every word of each step -- nothing dropped")

        areas_to_improve: List[str] = [
            f"Drill {d['label']} -- off in {int(d['error_rate'] * 100)}% of "
            f"{d['observations']} attempts"
            for d in phone_breakdown
        ]
        if words_skipped:
            areas_to_improve.append(
                "Slow down on words you skipped: " + ", ".join(words_skipped[:3])
            )
        if longest_pause is not None and longest_pause > 1.5:
            areas_to_improve.append(
                f"Shorten mid-sentence pauses (longest measured: {longest_pause}s)"
            )

        coach_feedback = await generate_coach_summary(
            coach_name=self.coach_name,
            coach_instructions=self.coach_instructions,
            overall=overall_score,
            accuracy=accuracy_score,
            fluency=fluency_score,
            wpm=wpm,
            mispronounced_words=mispronounced[:5],
            difficult_sounds=difficult_sounds,
        )

        return {
            "overall_score": overall_score,
            "accuracy_score": accuracy_score,
            "fluency_score": fluency_score,
            "words_spoken": words_spoken,
            "sentences_completed": len(self.completed_sentences),
            "sentences_total": len(self.session_sentences),
            "wpm": wpm,
            "avg_pause_duration": avg_pause_duration,
            "longest_pause": longest_pause,
            "total_speaking_time": total_speaking_time,
            "mispronounced_words": mispronounced,
            "difficult_sounds": difficult_sounds,
            "phone_breakdown": phone_breakdown,
            "stress_mistakes": stress_mistakes,
            "syllable_mistakes": syllable_mistakes,
            "intonation_issues": intonation_issues,
            "words_skipped": words_skipped,
            "extra_inserted_words": extra_inserted_words,
            "strengths": strengths,
            "areas_to_improve": areas_to_improve,
            "coach_feedback": coach_feedback,
            "difficulty": self.difficulty,
            "pass_threshold": self.score_threshold,
            "scoring_method": attempts[-1].get("method") if attempts else None,
        }


@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    """Main WebSocket endpoint for voice conversation"""
    await websocket.accept()
    
    session = VoiceSession(websocket)
    sessions[session.connection_id] = session
    
    logger.info("WebSocket connected: %s", session.connection_id)
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
        logger.info("WebSocket disconnected: %s", session.connection_id)
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
        if session.connection_id in sessions:
            del sessions[session.connection_id]
        logger.info("Cleaned up session: %s", session.connection_id)
