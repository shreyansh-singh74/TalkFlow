from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.responses import SentencePhonemeAnalysisResponse


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


class PhonemeAnalysisMessage(BaseModel):
    type: Literal["PHONEME_ANALYSIS"]
    turn_id: str
    target_text: str
    analysis: SentencePhonemeAnalysisResponse


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

