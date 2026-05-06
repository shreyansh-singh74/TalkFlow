from pydantic import BaseModel, Field
from typing import Optional, List


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
    suggestions: List[str] = Field(default_factory=list)


class PhonemeErrorCount(BaseModel):
    phoneme: str
    count: int


class SentencePhonemeAnalysisResponse(BaseModel):
    sentence: str
    words: List[WordPhonemeAnalysisResponse]
    overall_accuracy: float
    problematic_phonemes: List[str] = Field(default_factory=list)
    mastered_phonemes: List[str] = Field(default_factory=list)
    most_common_errors: List[PhonemeErrorCount] = Field(default_factory=list)


class PhonemeAnalysisRequest(BaseModel):
    sentence: str
    user_transcript: Optional[str] = None


class WordPhonemeAnalysisRequest(BaseModel):
    word: str
    user_transcript: Optional[str] = None


class PhonemeCompareRequest(BaseModel):
    expected: str
    actual: str


class PhonemeCompareResponse(BaseModel):
    expected: str
    actual: str
    expected_ipa: str
    actual_ipa: str
    accuracy_score: float
    segments: List[PhonemeSegmentResponse]


class IpaResponse(BaseModel):
    word: str
    ipa: str
    phonemes: List[str]


class ArpabetSyllableItem(BaseModel):
    phones: str
    display: str
    stressed: bool


class PronunciationReferenceResponse(BaseModel):
    word: str
    arpabet_syllables: List[ArpabetSyllableItem] = Field(default_factory=list)
