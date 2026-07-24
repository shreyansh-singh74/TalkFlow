"""PronunciationScoringService — phoneme level scoring engine.

Converts a ComparisonPhoneme (from Phase 3A) into a PhonemeAnalysis object.

Calculates:
  - pronunciation_score : max(0.0, 100.0 - total_penalties)
  - timing_score        : 100.0 if observed_duration_ms is present, else None
  - confidence_score    : confidence * 100.0 if present, else None
  - final_score         : weighted combination bounded in [0.0, 100.0]
  - penalty_breakdown   : itemized dict of deductions from PenaltyEngine
"""

from __future__ import annotations

from app.core.scoring_config import CONFIDENCE_WEIGHT, PHONEME_MAX_SCORE, PRONUNCIATION_WEIGHT
from app.schemas.comparison import ComparisonPhoneme
from app.schemas.pronunciation_analysis import PhonemeAnalysis
from app.services.penalty_engine import penalty_engine


class PronunciationScoringService:
    """Scoring engine for individual phonemes."""

    def score_phoneme(self, phoneme: ComparisonPhoneme) -> PhonemeAnalysis:
        """Score a single ComparisonPhoneme into a PhonemeAnalysis.

        Parameters
        ----------
        phoneme : ComparisonPhoneme
            Output slot from sequence alignment & feature comparison.

        Returns
        -------
        PhonemeAnalysis
            Populated analysis object with explicit penalty breakdown.
        """
        penalties = penalty_engine.calculate_penalties(phoneme)
        total_penalty = sum(penalties.values())

        # 1. Phonetic correctness score
        pronunciation_score = max(0.0, min(PHONEME_MAX_SCORE, PHONEME_MAX_SCORE - total_penalty))

        # 2. Timing score (observed duration present = 100.0, no fake reference durations)
        timing_score = 100.0 if phoneme.observed_duration_ms is not None else None

        # 3. Confidence score
        confidence_score = (
            max(0.0, min(100.0, phoneme.confidence * 100.0))
            if phoneme.confidence is not None
            else None
        )

        # 4. Final composite score
        if confidence_score is not None:
            final_score = (
                PRONUNCIATION_WEIGHT * pronunciation_score + CONFIDENCE_WEIGHT * confidence_score
            )
        else:
            final_score = pronunciation_score

        final_score = max(0.0, min(100.0, final_score))

        return PhonemeAnalysis(
            expected=phoneme.expected,
            actual=phoneme.actual,
            operation=phoneme.operation,
            pronunciation_score=round(pronunciation_score, 2),
            timing_score=round(timing_score, 2) if timing_score is not None else None,
            confidence_score=round(confidence_score, 2) if confidence_score is not None else None,
            final_score=round(final_score, 2),
            articulatory_differences=phoneme.articulatory_differences,
            penalty_breakdown=penalties,
        )


# Global singleton instance
pronunciation_scoring_service = PronunciationScoringService()
