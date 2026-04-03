# app/api/routes/phoneme_routes.py
"""
Phoneme Analysis API Routes
Endpoints for analyzing pronunciation and providing phoneme-level feedback
"""

from fastapi import APIRouter, HTTPException
from app.schemas.responses import (
    PhonemeAnalysisRequest,
    SentencePhonemeAnalysisResponse,
    WordPhonemeAnalysisResponse,
    PhonemeSegmentResponse
)
from app.services.phoneme_analysis_service import phoneme_analyzer
from dataclasses import asdict

router = APIRouter(prefix="/api/phonemes", tags=["phonemes"])

@router.post("/analyze", response_model=SentencePhonemeAnalysisResponse)
async def analyze_phonemes(request: PhonemeAnalysisRequest):
    """
    Analyze phonemes in a sentence
    
    Args:
        request: PhonemeAnalysisRequest with sentence and optional user_transcript
        
    Returns:
        SentencePhonemeAnalysisResponse with detailed phoneme analysis
    """
    try:
        if not request.sentence:
            raise HTTPException(status_code=400, detail="Sentence cannot be empty")
        
        # Perform analysis
        analysis = await phoneme_analyzer.analyze_sentence(
            request.sentence,
            request.user_transcript
        )
        
        if not analysis:
            raise HTTPException(status_code=500, detail="Failed to analyze phonemes")
        
        # Convert to response format
        words_response = []
        for word_analysis in analysis.words:
            segments_response = [
                PhonemeSegmentResponse(
                    phoneme=seg.phoneme,
                    expected=seg.expected,
                    actual=seg.actual,
                    accuracy=seg.accuracy,
                    is_correct=seg.is_correct,
                    feedback=seg.feedback,
                    suggestions=seg.suggestions
                )
                for seg in word_analysis.segments
            ]
            
            words_response.append(WordPhonemeAnalysisResponse(
                word=word_analysis.word,
                expected_ipa=word_analysis.expected_ipa,
                expected_phonemes=word_analysis.expected_phonemes,
                actual_phonemes=word_analysis.actual_phonemes,
                segments=segments_response,
                word_accuracy=word_analysis.word_accuracy,
                phoneme_matches=word_analysis.phoneme_matches,
                total_phonemes=word_analysis.total_phonemes,
                suggestions=word_analysis.suggestions
            ))
        
        return SentencePhonemeAnalysisResponse(
            sentence=analysis.sentence,
            words=words_response,
            overall_accuracy=analysis.overall_accuracy,
            problematic_phonemes=analysis.problematic_phonemes,
            mastered_phonemes=analysis.mastered_phonemes,
            most_common_errors=analysis.most_common_errors
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_phonemes endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Phoneme analysis failed: {str(e)}")

@router.post("/analyze-word")
async def analyze_word(word: str, user_transcript: str = None):
    """
    Analyze phonemes in a single word
    
    Args:
        word: Word to analyze
        user_transcript: Optional user's pronunciation of the word
        
    Returns:
        WordPhonemeAnalysisResponse with word-level phoneme details
    """
    try:
        if not word:
            raise HTTPException(status_code=400, detail="Word cannot be empty")
        
        analysis = await phoneme_analyzer.analyze_word(word, user_transcript)
        
        if not analysis:
            raise HTTPException(status_code=500, detail="Failed to analyze word")
        
        segments_response = [
            PhonemeSegmentResponse(
                phoneme=seg.phoneme,
                expected=seg.expected,
                actual=seg.actual,
                accuracy=seg.accuracy,
                is_correct=seg.is_correct,
                feedback=seg.feedback,
                suggestions=seg.suggestions
            )
            for seg in analysis.segments
        ]
        
        return WordPhonemeAnalysisResponse(
            word=analysis.word,
            expected_ipa=analysis.expected_ipa,
            expected_phonemes=analysis.expected_phonemes,
            actual_phonemes=analysis.actual_phonemes,
            segments=segments_response,
            word_accuracy=analysis.word_accuracy,
            phoneme_matches=analysis.phoneme_matches,
            total_phonemes=analysis.total_phonemes,
            suggestions=analysis.suggestions
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in analyze_word endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Word analysis failed: {str(e)}")

@router.get("/ipa/{word}")
async def get_ipa(word: str):
    """
    Get IPA representation of a word
    
    Args:
        word: Word to convert to IPA
        
    Returns:
        IPA representation of the word
    """
    try:
        if not word:
            raise HTTPException(status_code=400, detail="Word cannot be empty")
        
        ipa_dict = phoneme_analyzer.text_to_ipa(word)
        ipa_str = "".join(ipa_dict.get(word.lower(), []))
        
        return {
            "word": word,
            "ipa": ipa_str,
            "phonemes": ipa_dict.get(word.lower(), [])
        }
    except Exception as e:
        print(f"Error in get_ipa endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"IPA conversion failed: {str(e)}")

@router.post("/compare")
async def compare_phonemes(expected: str, actual: str):
    """
    Compare expected vs actual pronunciation
    
    Args:
        expected: Expected pronunciation
        actual: Actual pronunciation from user
        
    Returns:
        Comparison results with accuracy score
    """
    try:
        if not expected or not actual:
            raise HTTPException(status_code=400, detail="Both expected and actual pronunciations are required")
        
        expected_phonemes = phoneme_analyzer.text_to_ipa(expected).get(expected.lower(), [])
        actual_phonemes = phoneme_analyzer.text_to_ipa(actual).get(actual.lower(), [])
        
        accuracy, segments = phoneme_analyzer.calculate_phoneme_similarity(
            expected_phonemes,
            actual_phonemes
        )
        
        segments_response = [
            PhonemeSegmentResponse(
                phoneme=seg.phoneme,
                expected=seg.expected,
                actual=seg.actual,
                accuracy=seg.accuracy,
                is_correct=seg.is_correct,
                feedback=seg.feedback,
                suggestions=seg.suggestions
            )
            for seg in segments
        ]
        
        return {
            "expected": expected,
            "actual": actual,
            "expected_ipa": "".join(expected_phonemes),
            "actual_ipa": "".join(actual_phonemes),
            "accuracy_score": accuracy,
            "segments": segments_response
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in compare_phonemes endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Phoneme comparison failed: {str(e)}")
