# app/services/phoneme_analysis_service.py
"""
Phoneme Analysis Service
Handles phoneme extraction, comparison, and accuracy scoring for pronunciation feedback
"""

from typing import List, Dict, Tuple, Optional
from g2p_en import G2p
from difflib import SequenceMatcher
import json
from dataclasses import dataclass, asdict
from fastapi import UploadFile
import librosa
import numpy as np
import io

# IPA to common pronunciation mapping for feedback
IPA_FEEDBACK_MAP = {
    "θ": {"description": "th sound", "tip": "Place tongue between teeth and blow air"},
    "ð": {"description": "th sound (voiced)", "tip": "Place tongue between teeth and voice it"},
    "ŋ": {"description": "ng sound", "tip": "Back of tongue touches soft palate"},
    "ʃ": {"description": "sh sound", "tip": "Round lips and push air forward"},
    "ʒ": {"description": "zh sound", "tip": "Round lips and voice the sound"},
    "tʃ": {"description": "ch sound", "tip": "Touch palate with tongue tip, release with air"},
    "dʒ": {"description": "j sound", "tip": "Touch palate with tongue tip, voice and release"},
    "r": {"description": "r sound", "tip": "Curl tongue tip slightly back, don't touch palate"},
    "l": {"description": "l sound", "tip": "Touch alveolar ridge (behind upper teeth) with tongue"},
    "æ": {"description": "a sound in cat", "tip": "Jaw open, tongue flat, similar to 'a' in 'father' but shorter"},
    "ɪ": {"description": "i sound in bit", "tip": "Front-middle tongue position, relaxed"},
    "ɛ": {"description": "e sound in bed", "tip": "Mid-front tongue position"},
    "ʌ": {"description": "u sound in strut", "tip": "Central tongue position, lips slightly rounded"},
    "ɑ": {"description": "a sound in father", "tip": "Jaw very open, tongue low and back"},
}

@dataclass
class PhonemeSegment:
    """Represents a single phoneme segment"""
    phoneme: str
    expected: str
    actual: str
    accuracy: float
    is_correct: bool
    feedback: Optional[str] = None
    suggestions: Optional[List[str]] = None

@dataclass
class WordPhonemeAnalysis:
    """Analysis of phonemes in a word"""
    word: str
    expected_ipa: str
    expected_phonemes: List[str]
    actual_phonemes: List[str]
    segments: List[PhonemeSegment]
    word_accuracy: float
    phoneme_matches: int
    total_phonemes: int
    suggestions: List[str]

@dataclass
class SentencePhonemeAnalysis:
    """Analysis of entire sentence"""
    sentence: str
    words: List[WordPhonemeAnalysis]
    overall_accuracy: float
    problematic_phonemes: List[str]
    mastered_phonemes: List[str]
    most_common_errors: List[Tuple[str, int]]

class PhonemeAnalyzer:
    """Main class for phoneme analysis"""
    
    def __init__(self):
        """Initialize the phoneme analyzer"""
        self.g2p = G2p()
        
    def text_to_ipa(self, text: str) -> Dict[str, List[str]]:
        """
        Convert text to IPA phonemes for each word
        
        Args:
            text: Input text to convert
            
        Returns:
            Dictionary mapping words to their phoneme lists
        """
        try:
            words = text.lower().split()
            result = {}
            
            for word in words:
                # Remove punctuation
                clean_word = ''.join(c for c in word if c.isalpha())
                if not clean_word:
                    continue
                    
                # Get phonemes using g2p-en
                phonemes = self.g2p(clean_word)
                # Filter out spaces
                phonemes = [p for p in phonemes if p.strip()]
                result[clean_word] = phonemes
                
            return result
        except Exception as e:
            print(f"Error converting text to IPA: {str(e)}")
            return {}
    
    async def extract_phonemes_from_audio(self, audio_file: UploadFile) -> List[str]:
        """
        Extract phonemes from audio file using Deepgram
        
        Args:
            audio_file: Audio file to analyze
            
        Returns:
            List of detected phonemes
        """
        try:
            # For now, return empty list - this would be extended with actual phoneme extraction
            # In production, you'd use Deepgram's phoneme output or another phoneme extraction service
            content = await audio_file.read()
            # Placeholder: actual implementation would extract phonemes from audio
            return []
        except Exception as e:
            print(f"Error extracting phonemes from audio: {str(e)}")
            return []
    
    def calculate_phoneme_similarity(
        self, 
        expected_phonemes: List[str], 
        actual_phonemes: List[str]
    ) -> Tuple[float, List[PhonemeSegment]]:
        """
        Calculate similarity between expected and actual phonemes using sequence matching
        
        Args:
            expected_phonemes: Expected phoneme sequence
            actual_phonemes: Actual phoneme sequence from user
            
        Returns:
            Tuple of (similarity_score: float, segments: List[PhonemeSegment])
        """
        try:
            # Use SequenceMatcher for alignment
            matcher = SequenceMatcher(None, expected_phonemes, actual_phonemes)
            matching_blocks = matcher.get_matching_blocks()
            
            # Calculate total matches
            total_matches = sum(block.size for block in matching_blocks)
            max_length = max(len(expected_phonemes), len(actual_phonemes))
            
            if max_length == 0:
                similarity_score = 1.0
            else:
                similarity_score = (total_matches / max_length) * 100
            
            # Create phoneme segments
            segments = self._create_segments(expected_phonemes, actual_phonemes, matcher)
            
            return similarity_score, segments
        except Exception as e:
            print(f"Error calculating phoneme similarity: {str(e)}")
            return 0.0, []
    
    def _create_segments(
        self, 
        expected: List[str], 
        actual: List[str],
        matcher: SequenceMatcher
    ) -> List[PhonemeSegment]:
        """Create phoneme segments from matching results"""
        segments = []
        matching_blocks = matcher.get_matching_blocks()
        
        # Mark matched positions
        matched_expected = set()
        matched_actual = set()
        
        for block in matching_blocks:
            for i in range(block.size):
                matched_expected.add(block.a + i)
                matched_actual.add(block.b + i)
        
        # Create segments for each phoneme in expected
        for i, exp_phoneme in enumerate(expected):
            is_correct = i in matched_expected
            actual_phoneme = actual[i] if i < len(actual) else ""
            
            feedback = self._get_phoneme_feedback(exp_phoneme) if not is_correct else None
            suggestions = self._get_phoneme_suggestions(exp_phoneme, actual_phoneme) if not is_correct else None
            
            segment = PhonemeSegment(
                phoneme=exp_phoneme,
                expected=exp_phoneme,
                actual=actual_phoneme,
                accuracy=100.0 if is_correct else 0.0,
                is_correct=is_correct,
                feedback=feedback,
                suggestions=suggestions
            )
            segments.append(segment)
        
        return segments
    
    def _get_phoneme_feedback(self, phoneme: str) -> Optional[str]:
        """Get user-friendly feedback for a phoneme"""
        if phoneme in IPA_FEEDBACK_MAP:
            return IPA_FEEDBACK_MAP[phoneme]["description"]
        return None
    
    def _get_phoneme_suggestions(self, expected: str, actual: str) -> List[str]:
        """Get pronunciation suggestions based on expected vs actual"""
        suggestions = []
        
        if expected in IPA_FEEDBACK_MAP:
            suggestions.append(IPA_FEEDBACK_MAP[expected]["tip"])
        
        if actual and actual != expected:
            # Add common confusion patterns
            confusion_tips = {
                ("θ", "s"): "Your 's' is too sharp. Place your tongue between your teeth for 'th'.",
                ("ð", "d"): "Your 'd' is too hard. Use your tongue between teeth for 'th' sound.",
                ("r", "l"): "You're making an 'l' sound. Curl your tongue back slightly without touching.",
                ("ŋ", "n"): "Your 'n' is too forward. Move back to the soft palate for 'ng'.",
            }
            
            if (expected, actual) in confusion_tips:
                suggestions.append(confusion_tips[(expected, actual)])
        
        return suggestions if suggestions else None
    
    async def analyze_word(
        self, 
        word: str, 
        user_transcript: Optional[str] = None
    ) -> WordPhonemeAnalysis:
        """
        Complete analysis of a single word
        
        Args:
            word: Word to analyze
            user_transcript: What the user actually said (optional)
            
        Returns:
            WordPhonemeAnalysis object with detailed breakdown
        """
        try:
            # Get expected IPA
            expected_ipa_list = self.text_to_ipa(word)
            expected_phonemes = expected_ipa_list.get(word.lower(), [])
            expected_ipa = "".join(expected_phonemes)
            
            # Get actual phonemes (for now, use expected as placeholder if not provided)
            if user_transcript:
                actual_phonemes = self.text_to_ipa(user_transcript).get(user_transcript.lower(), [])
            else:
                actual_phonemes = expected_phonemes.copy()
            
            # Calculate similarity
            accuracy, segments = self.calculate_phoneme_similarity(expected_phonemes, actual_phonemes)
            
            # Count matches
            matches = sum(1 for seg in segments if seg.is_correct)
            
            # Generate suggestions
            suggestions = []
            for seg in segments:
                if seg.suggestions:
                    suggestions.extend(seg.suggestions)
            
            return WordPhonemeAnalysis(
                word=word,
                expected_ipa=expected_ipa,
                expected_phonemes=expected_phonemes,
                actual_phonemes=actual_phonemes,
                segments=segments,
                word_accuracy=accuracy,
                phoneme_matches=matches,
                total_phonemes=len(expected_phonemes),
                suggestions=list(set(suggestions))  # Remove duplicates
            )
        except Exception as e:
            print(f"Error analyzing word '{word}': {str(e)}")
            return None
    
    async def analyze_sentence(
        self, 
        sentence: str, 
        user_transcript: Optional[str] = None
    ) -> SentencePhonemeAnalysis:
        """
        Complete analysis of entire sentence
        
        Args:
            sentence: Target sentence
            user_transcript: What user actually said
            
        Returns:
            SentencePhonemeAnalysis with word-by-word breakdown
        """
        try:
            words = sentence.lower().split()
            word_analyses = []
            
            for word in words:
                clean_word = ''.join(c for c in word if c.isalpha())
                if not clean_word:
                    continue
                
                user_word = None
                if user_transcript:
                    user_words = user_transcript.lower().split()
                    if len(user_words) > len(word_analyses):
                        user_word = user_words[len(word_analyses)]
                
                analysis = await self.analyze_word(clean_word, user_word)
                if analysis:
                    word_analyses.append(analysis)
            
            # Calculate overall metrics
            if word_analyses:
                overall_accuracy = sum(w.word_accuracy for w in word_analyses) / len(word_analyses)
            else:
                overall_accuracy = 0.0
            
            # Find problematic phonemes (accuracy < 50%)
            problematic = []
            mastered = []
            error_counts = {}
            
            for word_analysis in word_analyses:
                for segment in word_analysis.segments:
                    if segment.is_correct:
                        if segment.phoneme not in mastered:
                            mastered.append(segment.phoneme)
                    else:
                        if segment.phoneme not in problematic:
                            problematic.append(segment.phoneme)
                        error_counts[segment.phoneme] = error_counts.get(segment.phoneme, 0) + 1
            
            # Get most common errors
            most_common_errors = sorted(
                error_counts.items(), 
                key=lambda x: x[1], 
                reverse=True
            )[:5]
            
            return SentencePhonemeAnalysis(
                sentence=sentence,
                words=word_analyses,
                overall_accuracy=overall_accuracy,
                problematic_phonemes=problematic,
                mastered_phonemes=mastered,
                most_common_errors=most_common_errors
            )
        except Exception as e:
            print(f"Error analyzing sentence: {str(e)}")
            return None

# Initialize global analyzer instance
phoneme_analyzer = PhonemeAnalyzer()
