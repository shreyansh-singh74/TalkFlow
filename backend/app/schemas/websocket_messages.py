from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ControlMessage(BaseModel):
    type: Literal["START_TURN", "END_TURN", "INTERRUPT"]
    turn_id: str
    timestamp: float


class PracticeStepMessage(BaseModel):
    index: int
    text: str
    note: Optional[str] = None


class SessionConfigMessage(BaseModel):
    type: Literal["SESSION_CONFIG"]
    session_id: Optional[str] = None
    coach_name: Optional[str] = None
    coach_instructions: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    accent: str = "en-US"
    #: Falls back to the difficulty tier's default when omitted.
    pass_threshold: Optional[float] = None
    #: The full script, decided at session-creation time. The engine executes
    #: this list -- it no longer picks content of its own.
    steps: List[PracticeStepMessage] = Field(default_factory=list)
    source: Literal["coach", "custom"] = "coach"


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
    audio_path: Optional[str] = None
    stress: Optional[dict] = None
    timing: Optional[dict] = None
    intonation: Optional[dict] = None
    diagnosis: dict = Field(default_factory=dict)


class SessionCompleteMessage(BaseModel):
    type: Literal["SESSION_COMPLETE"]
    report: dict
