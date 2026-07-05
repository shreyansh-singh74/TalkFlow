"""Acoustic pronunciation scorer: scores the actual audio waveform.

Pipeline:  audio --(wav2vec2 CTC)--> recognized phones (+confidence)
           target text --(g2p_en)--> canonical ARPAbet reference
           Needleman-Wunsch align --> GOP-style scoring

Falls back to the text-proxy scorer when audio is missing/too short or the
acoustic model is disabled, so the WebSocket flow never breaks.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from app.services.phoneme_analysis_service import phoneme_analyzer
from app.services.pronunciation.alignment import align_phonemes
from app.services.pronunciation.base import PronunciationResult
from app.services.pronunciation.phone_set import ARPABET_TO_IPA, normalize_arpabet
from app.services.pronunciation.scoring import score_alignment
from app.services.pronunciation.text_proxy_scorer import TextProxyScorer
from app.services.pronunciation.wav2vec2_phonemes import recognize_phones

logger = logging.getLogger(__name__)

MIN_AUDIO_BYTES = 4000  # ~125ms of 16kHz PCM16; below this, defer to text proxy


def _ipa_list(arpabet: List[str]) -> List[str]:
    return [ARPABET_TO_IPA.get(normalize_arpabet(p), p.lower()) for p in arpabet]


class AcousticScorer:
    name = "acoustic"

    def __init__(self) -> None:
        self._fallback = TextProxyScorer()

    def _reference_arpabet(self, target_text: str) -> List[str]:
        raw = phoneme_analyzer.phonemes_for_text_flat(target_text)
        return [normalize_arpabet(p) for p in raw if p]

    def score(
        self,
        target_text: str,
        heard_text: str,
        audio_pcm16: Optional[bytes] = None,
    ) -> PronunciationResult:
        target_text = (target_text or "").strip()
        if not target_text:
            return self._fallback.score(target_text, heard_text, audio_pcm16)

        if not audio_pcm16 or len(audio_pcm16) < MIN_AUDIO_BYTES:
            logger.debug("Acoustic scorer: insufficient audio, using text proxy")
            return self._fallback.score(target_text, heard_text, audio_pcm16)

        try:
            recognized = recognize_phones(audio_pcm16)
        except Exception:
            logger.exception("Acoustic phoneme recognition failed; using text proxy")
            return self._fallback.score(target_text, heard_text, audio_pcm16)

        if not recognized:
            logger.debug("Acoustic scorer: no phones recognized, using text proxy")
            return self._fallback.score(target_text, heard_text, audio_pcm16)

        expected = self._reference_arpabet(target_text)
        actual = [r.phone for r in recognized]
        pairs = align_phonemes(expected, actual)

        # Build confidence list parallel to pairs (only matched/sub pairs carry one).
        actual_iter = iter(recognized)
        confidences: List[float] = []
        consumed: List[Optional[float]] = []
        for r in recognized:
            consumed.append(r.confidence)
        ci = 0
        for p in pairs:
            if p.op in ("equal", "sub", "insert"):
                conf = consumed[ci] if ci < len(consumed) else 1.0
                ci += 1
            else:  # delete: no actual phone consumed
                conf = 1.0
            confidences.append(conf)

        result = score_alignment(pairs, use_confidence=True, confidences=confidences)

        return PronunciationResult(
            expected_phonemes=_ipa_list(expected),
            actual_phonemes=_ipa_list(actual),
            errors=result["errors"],
            score=result["score"],
            feedback=result["feedback"],
            method=self.name,
            per_phoneme=result["per_phoneme"],
        )
