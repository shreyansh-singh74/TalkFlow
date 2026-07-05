"""Legacy text-vs-text scorer wrapped behind the PronunciationScorer interface.

This is the pre-existing behaviour (G2P(target) vs G2P(transcript)). Kept as the
safe default and as an A/B baseline against the acoustic scorer.
"""

from __future__ import annotations

from typing import Optional

from app.services.phoneme_analysis_service import (
    build_pronunciation_result_dict,
    phoneme_analyzer,
)
from app.services.pronunciation.base import PronunciationResult


class TextProxyScorer:
    name = "text_proxy"

    def score(
        self,
        target_text: str,
        heard_text: str,
        audio_pcm16: Optional[bytes] = None,
    ) -> PronunciationResult:
        body = build_pronunciation_result_dict(phoneme_analyzer, target_text, heard_text)
        return PronunciationResult(
            expected_phonemes=body["expected_phonemes"],
            actual_phonemes=body["actual_phonemes"],
            errors=body["errors"],
            score=body["score"],
            feedback=body["feedback"],
            method=self.name,
            per_phoneme=[],
        )
