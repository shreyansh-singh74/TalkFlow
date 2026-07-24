"""PronunciationAnalysisService — Phase 3B pipeline orchestrator.

Orchestrates the full deterministic pronunciation pipeline:
  Audio + Transcript
         │
         ▼
  AlignmentService (Phase 2) ──► AlignmentResult
         │
         ▼
  PronunciationComparisonService (Phase 3A) ──► ComparisonResult
         │
         ▼
  PenaltyEngine + PhonemeScoringService (Phase 3B) ──► PhonemeAnalysis
         │
         ▼
  SyllableScoring (Phase 3B) ──► SyllableAnalysis
         │
         ▼
  WordScoring (Phase 3B) ──► WordAnalysis
         │
         ▼
  SentenceScoring (Phase 3B) ──► PronunciationAnalysis

Routes call only this service.
"""

from __future__ import annotations

import logging

from app.schemas.comparison import ComparisonResult
from app.schemas.pronunciation_analysis import PhonemeAnalysis, PronunciationAnalysis, SyllableAnalysis, WordAnalysis
from app.services.alignment_service import alignment_service
from app.services.pronunciation_comparison_service import pronunciation_comparison_service
from app.services.pronunciation_scoring_service import pronunciation_scoring_service
from app.services.sentence_scoring import sentence_scoring
from app.services.syllable_scoring import syllable_scoring
from app.services.word_scoring import word_scoring

logger = logging.getLogger(__name__)


class PronunciationAnalysisService:
    """Orchestrator for the full deterministic pronunciation scoring pipeline."""

    def analyze_comparison(self, comparison: ComparisonResult) -> PronunciationAnalysis:
        """Convert a Phase 3A ComparisonResult into a complete PronunciationAnalysis.

        Parameters
        ----------
        comparison : ComparisonResult
            The difference graph produced by PronunciationComparisonService.

        Returns
        -------
        PronunciationAnalysis
            Hierarchical analysis containing scores and explicit penalty breakdowns.
        """
        word_analyses: List[WordAnalysis] = []

        for comp_word in comparison.words:
            # 1. Score each phoneme
            phoneme_analyses: List[PhonemeAnalysis] = [
                pronunciation_scoring_service.score_phoneme(ph)
                for ph in comp_word.phonemes
            ]

            # 2. Syllable grouping & scoring
            syllable_analyses: List[SyllableAnalysis] = syllable_scoring.score_syllables(
                word=comp_word.word,
                phoneme_analyses=phoneme_analyses,
            )

            # 3. Word aggregation
            word_analysis: WordAnalysis = word_scoring.score_word(
                word=comp_word.word,
                syllables=syllable_analyses,
            )

            word_analyses.append(word_analysis)

        # 4. Sentence aggregation
        return sentence_scoring.score_sentence(
            transcript=comparison.transcript,
            words=word_analyses,
        )

    async def analyze_audio(
        self,
        audio_pcm: bytes,
        transcript: str,
        language: str = "en",
    ) -> PronunciationAnalysis:
        """Run full end-to-end pipeline: Audio -> Alignment -> Comparison -> Analysis.

        Parameters
        ----------
        audio_pcm : bytes
            PCM16 mono 16kHz audio bytes.
        transcript : str
            Expected transcript text.
        language : str
            Language code (default "en").

        Returns
        -------
        PronunciationAnalysis
            Full hierarchical analysis result.
        """
        # Step 1: Forced Alignment (Phase 2)
        alignment_result = await alignment_service.align(
            audio_pcm=audio_pcm,
            transcript=transcript,
            language=language,
        )

        # Step 2: Feature-Based Comparison (Phase 3A)
        comparison_result = pronunciation_comparison_service.compare(alignment_result)

        # Step 3: Scoring & Analysis (Phase 3B)
        return self.analyze_comparison(comparison_result)


# Global singleton instance
pronunciation_analysis_service = PronunciationAnalysisService()
