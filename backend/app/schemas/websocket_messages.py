from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ControlMessage(BaseModel):
    type: Literal["START_TURN", "END_TURN", "INTERRUPT"]
    turn_id: str
    timestamp: float


class PracticeStepMessage(BaseModel):
    index: int
    text: str
    note: Optional[str] = None


class SessionResumeState(BaseModel):
    """Where a reconnecting client left off.

    The engine keeps attempts in memory per connection, so a dropped socket
    used to throw the learner back to step 1 with every score forgotten. A
    client that has already connected once on this practice session sends this
    along with SESSION_CONFIG, and the engine seeks instead of resetting. A
    first connect (or a deliberate "Practise Again") omits it, which keeps the
    old from-scratch behaviour.
    """

    step_index: int = 0
    #: Steps the learner explicitly skipped.
    skipped: List[int] = Field(default_factory=list)
    #: Best score reached per step index. Keys are ints: over the wire JSON
    #: makes them strings, and pydantic's int key coerces them back -- leaving
    #: them as bare ``dict`` str keys would make the range filter compare
    #: ``0 <= "2"`` and raise.
    best_scores: Dict[int, float] = Field(default_factory=dict)
    #: Target texts of steps already passed, so the session report still
    #: counts them as completed.
    completed_targets: List[str] = Field(default_factory=list)


class SessionConfigMessage(BaseModel):
    type: Literal["SESSION_CONFIG"]
    session_id: Optional[str] = None
    coach_name: Optional[str] = None
    coach_instructions: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    accent: str = "en-US"
    #: Bare ISO-639-1 / BCP-47 code for the learner's first language. Coaching
    #: only: it biases which sounds get named, never how a turn is scored.
    l1: Optional[str] = None
    #: Whether the learner consented to raw audio being written to disk. The
    #: server-wide PERSIST_TURN_AUDIO switch still has to allow it.
    retain_audio: bool = False
    #: Falls back to the difficulty tier's default when omitted.
    pass_threshold: Optional[float] = None
    #: The full script, decided at session-creation time. The engine executes
    #: this list -- it no longer picks content of its own.
    steps: List[PracticeStepMessage] = Field(default_factory=list)
    source: Literal["coach", "custom"] = "coach"
    #: Progress to restore on a reconnect. Absent on a first connect.
    resume: Optional[SessionResumeState] = None


class PracticeProgressMessage(BaseModel):
    current: int
    total: int


class PracticeTargetMessage(BaseModel):
    type: Literal["PRACTICE_TARGET"]
    target_text: str
    mode: Literal["word", "sentence"]
    sentence: str
    progress: PracticeProgressMessage
    step_index: int = 0
    pass_threshold: float = 88.0
    #: True when this step arrived because the previous one was *passed*, not
    #: because the learner skipped or navigated. The client keeps the last
    #: score and feedback on screen in that case, so a pass does not yank the
    #: feedback away the instant it is earned.
    advanced_from_pass: bool = False
    #: Why the cursor did not move, when it did not. Rendered as a hint.
    gate_message: Optional[str] = None
    #: Surrounding sentences, so someone rehearsing a speech can see where this
    #: line sits. Only populated for custom-text sessions.
    context_before: Optional[str] = None
    context_after: Optional[str] = None
    note: Optional[str] = None


class PartialTranscriptMessage(BaseModel):
    type: Literal["PARTIAL_TRANSCRIPT"]
    text: str
    is_final: bool
    confidence: float


class FinalTranscriptMessage(BaseModel):
    type: Literal["FINAL_TRANSCRIPT"]
    text: str
    confidence: float


class LLMTextChunkMessage(BaseModel):
    type: Literal["LLM_TEXT_CHUNK"]
    text: str
    is_final: bool


class AIResponseMessage(BaseModel):
    type: Literal["AI_RESPONSE"]
    text: str
    has_audio: bool


class TTSChunkMessage(BaseModel):
    type: Literal["TTS_CHUNK"]
    seq: int
    is_final: bool


class ErrorMessage(BaseModel):
    type: Literal["ERROR"]
    message: str
    recoverable: bool


class PronunciationResultMessage(BaseModel):
    type: Literal["PRONUNCIATION_RESULT"]
    turn_id: str
    target_text: str
    heard_text: str
    score: float
    expected_phonemes: List[str] = Field(default_factory=list)
    actual_phonemes: List[str] = Field(default_factory=list)
    errors: List[dict] = Field(default_factory=list)
    feedback: List[str] = Field(default_factory=list)
    misaligned_words: List[dict] = Field(default_factory=list)
    # Phase-1 acoustic scoring fields (additive; older clients ignore them).
    method: str = "text_proxy"
    per_phoneme: List[dict] = Field(default_factory=list)
    # Phase 0/2/3 additive fields.
    accent: str = "en-US"
    accent_label: str = "American English"
    audio_path: Optional[str] = None
    stress: Optional[dict] = None
    timing: Optional[dict] = None
    intonation: Optional[dict] = None
    diagnosis: dict = Field(default_factory=dict)
    #: What this turn did to the cursor: {advanced, completed_sentence,
    #: session_complete, message}. Additive; older clients ignore it and keep
    #: using the explicit NEXT_SENTENCE command.
    practice_update: Optional[dict] = None


class SessionCompleteMessage(BaseModel):
    type: Literal["SESSION_COMPLETE"]
    report: dict
