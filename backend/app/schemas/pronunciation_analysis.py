"""Pydantic schemas for Phase 3B Pronunciation Analysis Engine.

These models represent the explainable hierarchical pronunciation analysis
output at the phoneme, syllable, word, and sentence levels.

Design notes
------------
penalty_breakdown : Dict[str, float]
    Itemized dictionary of score deductions applied to each phoneme.
    Example: ``{"substitution_base": 15.0, "voicing_changed": 2.0}``

fluency_score : float | None
    Set to None in Phase 3B. Reserved for Phase 5 when pause, speech rate,
    and hesitation metrics are built.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from pydantic import BaseModel


class PhonemeAnalysis(BaseModel):
    """Analysis metrics for a single aligned phoneme slot.

    Fields
    ------
    expected : str | None
        Expected ARPABET base symbol (e.g. ``"AE"``), or None if insertion.
    actual : str | None
        Actual spoken ARPABET base symbol (e.g. ``"EH"``), or None if deletion.
    operation : str
        Sequence alignment operation (``"match"``, ``"substitution"``, ``"deletion"``, ``"insertion"``).
    pronunciation_score : float
        Score derived strictly from phonetic correctness [0.0 - 100.0].
    timing_score : float | None
        Score derived from timing analysis, or None if unmeasured.
    confidence_score : float | None
        Score derived from alignment confidence [0.0 - 100.0], or None if unmeasured.
    final_score : float
        Weighted composite score for this phoneme [0.0 - 100.0].
    articulatory_differences : List[str]
        List of articulatory differences (e.g. ``["voicing_changed"]``).
    penalty_breakdown : Dict[str, float]
        Itemized deductions applied (e.g. ``{"voicing_changed": 2.0}``).
    """

    expected: Optional[str] = None
    actual: Optional[str] = None
    operation: str
    pronunciation_score: float
    timing_score: Optional[float] = None
    confidence_score: Optional[float] = None
    final_score: float
    articulatory_differences: List[str] = []
    penalty_breakdown: Dict[str, float] = {}


class SyllableAnalysis(BaseModel):
    """Analysis metrics for a single syllable.

    Fields
    ------
    text : str
        Syllable text (e.g. ``"nat"``).
    pronunciation_score : float
        Mean pronunciation score of phonemes in this syllable [0.0 - 100.0].
    timing_score : float | None
        Mean timing score of phonemes in this syllable, or None.
    phonemes : List[PhonemeAnalysis]
        Phoneme analyses belonging to this syllable.
    """

    text: str
    pronunciation_score: float
    timing_score: Optional[float] = None
    phonemes: List[PhonemeAnalysis] = []


class WordAnalysis(BaseModel):
    """Analysis metrics for a single word.

    Fields
    ------
    word : str
        Target word text (normalised, lowercased).
    pronunciation_score : float
        Overall pronunciation accuracy score for this word [0.0 - 100.0].
    completeness_score : float
        Percentage of expected phonemes correctly spoken [0.0 - 100.0].
    timing_score : float | None
        Timing score for this word, or None.
    syllables : List[SyllableAnalysis]
        Syllable analyses belonging to this word.
    """

    word: str
    pronunciation_score: float
    completeness_score: float
    timing_score: Optional[float] = None
    syllables: List[SyllableAnalysis] = []


class PronunciationAnalysis(BaseModel):
    """Sentence-level top-level pronunciation analysis result.

    Fields
    ------
    transcript : str
        Target transcript text.
    pronunciation_score : float
        Mean pronunciation score across all words [0.0 - 100.0].
    fluency_score : float | None
        Fluency score, set to None in Phase 3B (reserved for Phase 5).
    completeness_score : float
        Mean completeness score across all words [0.0 - 100.0].
    overall_score : float
        Weighted overall score for the sentence [0.0 - 100.0].
    words : List[WordAnalysis]
        List of per-word analysis objects.
    """

    transcript: str
    pronunciation_score: float
    fluency_score: Optional[float] = None
    completeness_score: float
    overall_score: float
    words: List[WordAnalysis] = []
