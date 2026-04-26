"""Phoneme analysis HTTP endpoints."""

import logging
import re

from fastapi import APIRouter, HTTPException

from app.schemas.responses import (
    IpaResponse,
    PhonemeAnalysisRequest,
    PhonemeCompareRequest,
    PhonemeCompareResponse,
    PronunciationReferenceResponse,
    SentencePhonemeAnalysisResponse,
    WordPhonemeAnalysisRequest,
    WordPhonemeAnalysisResponse,
    ArpabetSyllableItem,
)
from app.services.phoneme_analysis_service import phoneme_analyzer
from app.utils.phoneme_mappers import (
    segment_to_response,
    sentence_to_response,
    word_to_response,
)
from app.utils.pronunciation_reference import build_syllable_rows

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/phonemes", tags=["phonemes"])


@router.post("/analyze", response_model=SentencePhonemeAnalysisResponse)
async def analyze_sentence(request: PhonemeAnalysisRequest) -> SentencePhonemeAnalysisResponse:
    if not request.sentence or not request.sentence.strip():
        raise HTTPException(status_code=400, detail="Sentence cannot be empty")

    try:
        analysis = await phoneme_analyzer.analyze_sentence(request.sentence, request.user_transcript)
    except Exception:
        logger.exception("analyze_sentence failed")
        raise HTTPException(status_code=500, detail="Phoneme analysis failed")

    if analysis is None:
        raise HTTPException(status_code=500, detail="Phoneme analysis failed")

    return sentence_to_response(analysis)


@router.post("/analyze-word", response_model=WordPhonemeAnalysisResponse)
async def analyze_word(request: WordPhonemeAnalysisRequest) -> WordPhonemeAnalysisResponse:
    if not request.word or not request.word.strip():
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    try:
        analysis = await phoneme_analyzer.analyze_word(request.word, request.user_transcript)
    except Exception:
        logger.exception("analyze_word failed")
        raise HTTPException(status_code=500, detail="Word analysis failed")

    if analysis is None:
        raise HTTPException(status_code=500, detail="Word analysis failed")

    return word_to_response(analysis)


_WORD_RE = re.compile(r"[A-Za-z']+")


@router.get("/reference/{word}", response_model=PronunciationReferenceResponse)
async def get_pronunciation_reference(word: str) -> PronunciationReferenceResponse:
    raw = (word or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Word is required")
    m = _WORD_RE.search(raw)
    key = m.group(0).lower() if m else re.sub(r"[^\w]", "", raw).lower()
    if not key:
        raise HTTPException(status_code=400, detail="Word is required")
    try:
        tokens = phoneme_analyzer.raw_arpabet_tokens_for_word(key)
    except Exception:
        logger.exception("get_pronunciation_reference g2p failed for %r", key)
        raise HTTPException(status_code=500, detail="Pronunciation reference failed")
    rows = build_syllable_rows(key, tokens)
    return PronunciationReferenceResponse(
        word=key,
        arpabet_syllables=[ArpabetSyllableItem(**r) for r in rows],
    )


@router.get("/ipa/{word}", response_model=IpaResponse)
async def get_ipa(word: str) -> IpaResponse:
    if not word or not word.strip():
        raise HTTPException(status_code=400, detail="Word cannot be empty")

    try:
        phonemes = phoneme_analyzer.text_to_ipa(word).get(word.lower(), [])
    except Exception:
        logger.exception("get_ipa failed")
        raise HTTPException(status_code=500, detail="IPA conversion failed")

    return IpaResponse(word=word, ipa="".join(phonemes), phonemes=phonemes)


@router.post("/compare", response_model=PhonemeCompareResponse)
async def compare_phonemes(request: PhonemeCompareRequest) -> PhonemeCompareResponse:
    if not request.expected or not request.actual:
        raise HTTPException(
            status_code=400,
            detail="Both expected and actual pronunciations are required",
        )

    try:
        expected_map = phoneme_analyzer.text_to_ipa(request.expected)
        actual_map = phoneme_analyzer.text_to_ipa(request.actual)
    except Exception:
        logger.exception("compare_phonemes g2p failed")
        raise HTTPException(status_code=500, detail="Phoneme comparison failed")

    expected_phonemes = [p for word in expected_map.values() for p in word]
    actual_phonemes = [p for word in actual_map.values() for p in word]

    accuracy, segments = phoneme_analyzer.calculate_phoneme_similarity(
        expected_phonemes,
        actual_phonemes,
    )

    return PhonemeCompareResponse(
        expected=request.expected,
        actual=request.actual,
        expected_ipa="".join(expected_phonemes),
        actual_ipa="".join(actual_phonemes),
        accuracy_score=accuracy,
        segments=[segment_to_response(s) for s in segments],
    )
