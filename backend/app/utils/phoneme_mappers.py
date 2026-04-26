"""Mappers between phoneme dataclasses and their Pydantic response models."""

from app.schemas.responses import (
    PhonemeErrorCount,
    PhonemeSegmentResponse,
    SentencePhonemeAnalysisResponse,
    WordPhonemeAnalysisResponse,
)
from app.services.phoneme_analysis_service import (
    PhonemeSegment,
    SentencePhonemeAnalysis,
    WordPhonemeAnalysis,
)


def segment_to_response(seg: PhonemeSegment) -> PhonemeSegmentResponse:
    return PhonemeSegmentResponse(
        phoneme=seg.phoneme,
        expected=seg.expected,
        actual=seg.actual,
        accuracy=seg.accuracy,
        is_correct=seg.is_correct,
        feedback=seg.feedback,
        suggestions=seg.suggestions,
    )


def word_to_response(word: WordPhonemeAnalysis) -> WordPhonemeAnalysisResponse:
    return WordPhonemeAnalysisResponse(
        word=word.word,
        expected_ipa=word.expected_ipa,
        expected_phonemes=word.expected_phonemes,
        actual_phonemes=word.actual_phonemes,
        segments=[segment_to_response(s) for s in word.segments],
        word_accuracy=word.word_accuracy,
        phoneme_matches=word.phoneme_matches,
        total_phonemes=word.total_phonemes,
        suggestions=word.suggestions,
    )


def sentence_to_response(analysis: SentencePhonemeAnalysis) -> SentencePhonemeAnalysisResponse:
    return SentencePhonemeAnalysisResponse(
        sentence=analysis.sentence,
        words=[word_to_response(w) for w in analysis.words],
        overall_accuracy=analysis.overall_accuracy,
        problematic_phonemes=analysis.problematic_phonemes,
        mastered_phonemes=analysis.mastered_phonemes,
        most_common_errors=[
            PhonemeErrorCount(phoneme=p, count=c) for p, c in analysis.most_common_errors
        ],
    )
