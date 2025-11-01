# app/schemas/websocket_messages.py
from pydantic import BaseModel
from typing import Literal


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

