"""WordScoring — word level scoring and aggregation.

Aggregates SyllableAnalysis objects (and underlying PhonemeAnalysis objects)
into a WordAnalysis object.

Metrics calculated
------------------
  - pronunciation_score : mean final_score across expected/spoken phonemes [0.0 - 100.0]
  - completeness_score  : (N_expected - N_deleted) / N_expected * 100.0 [0.0 - 100.0]
  - timing_score        : mean timing_score across syllables, or None
"""

from __future__ import annotations

from typing import List, Optional

from app.schemas.pronunciation_analysis import SyllableAnalysis, WordAnalysis


class WordScoring:
    """Aggregates syllable analyses into word analysis."""

    def score_word(
        self,
        word: str,
        syllables: List[SyllableAnalysis],
    ) -> WordAnalysis:
        """Aggregate SyllableAnalysis objects into a WordAnalysis.

        Parameters
        ----------
        word : str
            Target word text.
        syllables : List[SyllableAnalysis]
            Scored syllable analyses for this word.

        Returns
        -------
        WordAnalysis
            Populated word analysis object.
        """
        clean_word = (word or "").strip().lower()

        if not syllables:
            return WordAnalysis(
                word=clean_word,
                pronunciation_score=100.0,
                completeness_score=100.0,
                timing_score=None,
                syllables=[],
            )

        # Flatten all phonemes from syllables
        all_phonemes = [p for s in syllables for p in s.phonemes]

        if not all_phonemes:
            return WordAnalysis(
                word=clean_word,
                pronunciation_score=100.0,
                completeness_score=100.0,
                timing_score=None,
                syllables=syllables,
            )

        # 1. Pronunciation score (mean of phoneme final_scores)
        phoneme_scores = [p.final_score for p in all_phonemes]
        pronunciation_score = sum(phoneme_scores) / len(phoneme_scores)
        pronunciation_score = max(0.0, min(100.0, pronunciation_score))

        # 2. Completeness score: (N_expected - N_deleted) / N_expected * 100.0
        expected_phonemes = [p for p in all_phonemes if p.expected is not None]
        if expected_phonemes:
            deleted_count = sum(1 for p in expected_phonemes if p.operation == "deletion")
            completeness_score = ((len(expected_phonemes) - deleted_count) / len(expected_phonemes)) * 100.0
        else:
            completeness_score = 100.0
        completeness_score = max(0.0, min(100.0, completeness_score))

        # 3. Timing score (mean of non-None syllable timing_scores)
        timing_scores = [s.timing_score for s in syllables if s.timing_score is not None]
        timing_score = (sum(timing_scores) / len(timing_scores)) if timing_scores else None
        if timing_score is not None:
            timing_score = max(0.0, min(100.0, timing_score))

        return WordAnalysis(
            word=clean_word,
            pronunciation_score=round(pronunciation_score, 2),
            completeness_score=round(completeness_score, 2),
            timing_score=round(timing_score, 2) if timing_score is not None else None,
            syllables=syllables,
        )


# Global singleton instance
word_scoring = WordScoring()
