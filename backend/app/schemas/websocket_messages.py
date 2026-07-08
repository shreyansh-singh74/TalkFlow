from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ControlMessage(BaseModel):
    type: Literal["START_TURN", "END_TURN", "INTERRUPT"]
    turn_id: str
    timestamp: float


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
    deepgram_text: Optional[str] = None
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
