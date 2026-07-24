"""SentenceScoring — sentence level scoring and top-level aggregation.

Aggregates WordAnalysis objects into a top-level PronunciationAnalysis object.

Metrics calculated
------------------
  - pronunciation_score : mean pronunciation_score across all words [0.0 - 100.0]
  - completeness_score  : mean completeness_score across all words [0.0 - 100.0]
  - fluency_score       : None (reserved for Phase 5 when pause/speech-rate metrics exist)
  - overall_score       : 0.70 * pronunciation_score + 0.30 * completeness_score [0.0 - 100.0]
"""

from __future__ import annotations

from typing import List, Optional

from app.core.scoring_config import SENTENCE_COMPLETENESS_WEIGHT, SENTENCE_PRONUNCIATION_WEIGHT
from app.schemas.pronunciation_analysis import PronunciationAnalysis, WordAnalysis


class SentenceScoring:
    """Aggregates word analysis objects into sentence-level PronunciationAnalysis."""

    def score_sentence(
        self,
        transcript: str,
        words: List[WordAnalysis],
    ) -> PronunciationAnalysis:
        """Aggregate word analyses into a top-level PronunciationAnalysis.

        Parameters
        ----------
        transcript : str
            Target transcript text.
        words : List[WordAnalysis]
            Scored word analysis objects.

        Returns
        -------
        PronunciationAnalysis
            Top-level analysis result.
        """
        clean_transcript = (transcript or "").strip()

        if not words:
            return PronunciationAnalysis(
                transcript=clean_transcript,
                pronunciation_score=100.0,
                fluency_score=None,
                completeness_score=100.0,
                overall_score=100.0,
                words=[],
            )

        # 1. Pronunciation score
        p_scores = [w.pronunciation_score for w in words]
        pronunciation_score = sum(p_scores) / len(p_scores)
        pronunciation_score = max(0.0, min(100.0, pronunciation_score))

        # 2. Completeness score
        c_scores = [w.completeness_score for w in words]
        completeness_score = sum(c_scores) / len(c_scores)
        completeness_score = max(0.0, min(100.0, completeness_score))

        # 3. Fluency score (None in Phase 3B)
        fluency_score: Optional[float] = None

        # 4. Overall score
        overall_score = (
            SENTENCE_PRONUNCIATION_WEIGHT * pronunciation_score
            + SENTENCE_COMPLETENESS_WEIGHT * completeness_score
        )
        overall_score = max(0.0, min(100.0, overall_score))

        return PronunciationAnalysis(
            transcript=clean_transcript,
            pronunciation_score=round(pronunciation_score, 2),
            fluency_score=fluency_score,
            completeness_score=round(completeness_score, 2),
            overall_score=round(overall_score, 2),
            words=words,
        )


# Global singleton instance
sentence_scoring = SentenceScoring()
