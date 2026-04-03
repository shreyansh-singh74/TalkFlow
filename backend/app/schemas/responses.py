# app/schemas/responses.py
from pydantic import BaseModel
from typing import Optional, List

class HealthResponse(BaseModel):
    status: str
    transcription_service: str

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

# Phoneme Analysis Schemas
class PhonemeSegmentResponse(BaseModel):
    phoneme: str
    expected: str
    actual: str
    accuracy: float
    is_correct: bool
    feedback: Optional[str] = None
    suggestions: Optional[List[str]] = None

class WordPhonemeAnalysisResponse(BaseModel):
    word: str
    expected_ipa: str
    expected_phonemes: List[str]
    actual_phonemes: List[str]
    segments: List[PhonemeSegmentResponse]
    word_accuracy: float
    phoneme_matches: int
    total_phonemes: int
    suggestions: List[str]

class SentencePhonemeAnalysisResponse(BaseModel):
    sentence: str
    words: List[WordPhonemeAnalysisResponse]
    overall_accuracy: float
    problematic_phonemes: List[str]
    mastered_phonemes: List[str]
    most_common_errors: List[tuple]

class PhonemeAnalysisRequest(BaseModel):
    sentence: str
    user_transcript: Optional[str] = None

class ConversationWithPhonemeResponse(BaseModel):
    transcript: str
    reply: str
    audio_url: Optional[str] = None
    conversation_id: str
    phoneme_analysis: Optional[SentencePhonemeAnalysisResponse] = None
    success: bool
    error: Optional[str] = None

