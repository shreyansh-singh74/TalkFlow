"""SyllableScoring — syllable level scoring and phoneme aggregation.

Groups a word's list of PhonemeAnalysis objects into SyllableAnalysis objects using
the expected syllable structure from PronunciationService.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from app.schemas.pronunciation_analysis import PhonemeAnalysis, SyllableAnalysis
from app.services.pronunciation_service import pronunciation_service

logger = logging.getLogger(__name__)


class SyllableScoring:
    """Aggregates phoneme analysis objects into syllable analysis objects."""

    def score_syllables(
        self,
        word: str,
        phoneme_analyses: List[PhonemeAnalysis],
    ) -> List[SyllableAnalysis]:
        """Group phoneme analyses by expected syllable boundaries and aggregate scores.

        Parameters
        ----------
        word : str
            Target word text.
        phoneme_analyses : List[PhonemeAnalysis]
            Scored phoneme analysis list for the word.

        Returns
        -------
        List[SyllableAnalysis]
            Ordered list of SyllableAnalysis objects.
        """
        if not phoneme_analyses:
            return []

        clean_word = (word or "").strip().lower()
        try:
            entry = pronunciation_service.lookup(clean_word)
            expected_syllable_entries = entry.syllables
        except Exception:
            logger.exception("PronunciationService lookup failed for %r", clean_word)
            expected_syllable_entries = []

        if not expected_syllable_entries:
            # Fallback: single syllable containing all phonemes
            return [self._aggregate_syllable(clean_word, phoneme_analyses)]

        # Partition phoneme_analyses proportionally across expected syllables
        num_syllables = len(expected_syllable_entries)
        num_phonemes = len(phoneme_analyses)

        if num_syllables == 1:
            return [self._aggregate_syllable(expected_syllable_entries[0].text, phoneme_analyses)]

        # Determine chunk sizes for partitioning
        chunk_size = max(1, num_phonemes // num_syllables)
        result: List[SyllableAnalysis] = []
        cursor = 0

        for idx, syl_entry in enumerate(expected_syllable_entries):
            if idx == num_syllables - 1:
                chunk = phoneme_analyses[cursor:]
            else:
                chunk = phoneme_analyses[cursor : cursor + chunk_size]
                cursor += chunk_size

            if chunk:
                result.append(self._aggregate_syllable(syl_entry.text, chunk))

        return result

    @staticmethod
    def _aggregate_syllable(text: str, phonemes: List[PhonemeAnalysis]) -> SyllableAnalysis:
        """Aggregate a chunk of phonemes into a single SyllableAnalysis."""
        if not phonemes:
            return SyllableAnalysis(text=text, pronunciation_score=100.0, timing_score=None, phonemes=[])

        p_scores = [p.final_score for p in phonemes]
        mean_p_score = sum(p_scores) / len(p_scores)

        t_scores = [p.timing_score for p in phonemes if p.timing_score is not None]
        mean_t_score = (sum(t_scores) / len(t_scores)) if t_scores else None

        return SyllableAnalysis(
            text=text,
            pronunciation_score=round(mean_p_score, 2),
            timing_score=round(mean_t_score, 2) if mean_t_score is not None else None,
            phonemes=phonemes,
        )


# Global singleton instance
syllable_scoring = SyllableScoring()
