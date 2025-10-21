# app/schemas/responses.py
from pydantic import BaseModel
from typing import Optional

class HealthResponse(BaseModel):
    status: str
    whisper_model: str

class TranscriptionResponse(BaseModel):
    transcript: str
    success: bool
    error: Optional[str] = None

class ConversationResponse(BaseModel):
    transcript: str
    reply: str
    audio_url: Optional[str] = None
    conversation_id: str
    success: bool
    error: Optional[str] = None

class ConversationCreateResponse(BaseModel):
    conversation_id: str
    success: bool

class ConversationDeleteResponse(BaseModel):
    message: str
    success: bool

