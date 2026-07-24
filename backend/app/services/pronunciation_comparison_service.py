"""PronunciationComparisonService — Phase 3A Pronunciation Comparison Engine.

Orchestrates the deterministic comparison pipeline:
  1. Input: AlignmentResult (from Forced Alignment Engine)
  2. For each word:
     - Fetch expected pronunciation entry from PronunciationService
     - Perform sequence alignment (Needleman–Wunsch) between expected & actual phonemes
     - Emit articulatory difference tags via PhonemeComparator & PhonemeFeatures
     - Attach alignment timestamps, viseme IDs, and duration metadata
  3. Output: ComparisonResult (difference graph)

This service performs ZERO scoring, produces NO feedback, and calls NO LLMs.
The resulting ComparisonResult is a pure, explainable structural graph.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from app.schemas.alignment import AlignmentResult, WordAlignment
from app.schemas.comparison import ComparisonPhoneme, ComparisonResult, ComparisonWord
from app.services.phoneme_comparator import compare_phoneme_pair
from app.services.pronunciation_service import pronunciation_service
from app.services.sequence_alignment import align_phoneme_sequences
from app.utils.arpabet_tables import VISEME_DEFAULT, VISEME_ID_MAP

logger = logging.getLogger(__name__)


class PronunciationComparisonService:
    """Orchestrator for comparing expected pronunciations against aligned actual speech."""

    def compare(self, alignment: AlignmentResult) -> ComparisonResult:
        """Compare an AlignmentResult against expected pronunciations.

        Parameters
        ----------
        alignment : AlignmentResult
            The output of the Forced Alignment Engine (Phase 2).

        Returns
        -------
        ComparisonResult
            Structured difference graph detailing every word and phoneme match,
            substitution, deletion, or insertion, along with articulatory features.
        """
        compared_words: List[ComparisonWord] = []

        for word_align in alignment.words:
            comp_word = self._compare_word(word_align)
            compared_words.append(comp_word)

        return ComparisonResult(
            transcript=alignment.transcript,
            words=compared_words,
            provider=alignment.provider,
        )

    def _compare_word(self, word_align: WordAlignment) -> ComparisonWord:
        """Compare expected phonemes vs actual aligned phonemes for a single word."""
        raw_word = word_align.word.strip().lower()

        # 1. Fetch expected pronunciation from PronunciationService
        try:
            entry = pronunciation_service.lookup(raw_word)
            expected_phonemes = [p.symbol for p in entry.phonemes]
        except Exception:
            logger.exception("PronunciationService lookup failed for %r; fallback to empty expected", raw_word)
            expected_phonemes = []

        # 2. Extract actual phonemes from WordAlignment
        actual_phoneme_objs = word_align.phonemes or []
        actual_phoneme_symbols = [p.symbol for p in actual_phoneme_objs]

        # 3. Sequence alignment (Needleman-Wunsch)
        aligned_pairs = align_phoneme_sequences(expected_phonemes, actual_phoneme_symbols)

        # 4. Construct ComparisonPhoneme list and match timestamps
        comp_phonemes: List[ComparisonPhoneme] = []
        act_cursor = 0  # cursor into actual_phoneme_objs list

        for op, exp_sym, act_sym in aligned_pairs:
            # Metadata from actual aligned phoneme (if operation consumes actual audio)
            act_obj = None
            if op in ("match", "substitution", "insertion") and act_cursor < len(actual_phoneme_objs):
                act_obj = actual_phoneme_objs[act_cursor]
                act_cursor += 1

            # Determine visemes
            exp_viseme = VISEME_ID_MAP.get(exp_sym, VISEME_DEFAULT) if exp_sym else None
            act_viseme = act_obj.viseme_id if act_obj else (VISEME_ID_MAP.get(act_sym, VISEME_DEFAULT) if act_sym else None)

            # Determine articulatory differences
            diffs = compare_phoneme_pair(op, exp_sym, act_sym)

            # Build ComparisonPhoneme
            comp_phoneme = ComparisonPhoneme(
                expected=exp_sym,
                actual=act_sym,
                operation=op,
                articulatory_differences=diffs,
                expected_viseme_id=exp_viseme,
                actual_viseme_id=act_viseme,
                start=act_obj.start if act_obj else None,
                end=act_obj.end if act_obj else None,
                confidence=act_obj.confidence if act_obj else None,
                observed_duration_ms=act_obj.observed_duration_ms if act_obj else None,
                alignment_source=act_obj.alignment_source if act_obj else None,
            )
            comp_phonemes.append(comp_phoneme)

        return ComparisonWord(
            word=raw_word,
            start=word_align.start,
            end=word_align.end,
            phonemes=comp_phonemes,
        )


# Global singleton instance
pronunciation_comparison_service = PronunciationComparisonService()
