"""Scorer interface and shared result shape.

The result intentionally serializes to the SAME dict keys the existing
``PRONUNCIATION_RESULT`` WebSocket message already consumes
(``expected_phonemes``, ``actual_phonemes``, ``errors``, ``score``, ``feedback``)
so either scorer is a drop-in for ``build_pronunciation_result_dict``. Extra
acoustic fields are additive and ignored by older clients.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol

from app.services.pronunciation.prosody_types import (
    IntonationResult,
    StressResult,
    TimingResult,
)


@dataclass
class PronunciationResult:
    expected_phonemes: List[str]
    actual_phonemes: List[str]
    errors: List[Dict[str, Any]]
    score: float
    feedback: List[str]
    # Additive Phase-1 fields (safe to ignore on old clients).
    method: str = "text_proxy"
    per_phoneme: List[Dict[str, Any]] = field(default_factory=list)
    # Additive Phase 0/2/3 fields. All optional + default-empty so the text-proxy
    # scorer and any older client keep working unchanged.
    accent: str = "en-US"
    audio_path: Optional[str] = None
    stress: Optional[StressResult] = None
    timing: Optional[TimingResult] = None
    intonation: Optional[IntonationResult] = None
    diagnosis: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "expected_phonemes": self.expected_phonemes,
            "actual_phonemes": self.actual_phonemes,
            "errors": self.errors,
            "score": self.score,
            "feedback": self.feedback,
            "method": self.method,
            "per_phoneme": self.per_phoneme,
            "accent": self.accent,
            "audio_path": self.audio_path,
            "stress": self.stress.to_dict() if self.stress else None,
            "timing": self.timing.to_dict() if self.timing else None,
            "intonation": self.intonation.to_dict() if self.intonation else None,
            "diagnosis": self.diagnosis,
        }


class PronunciationScorer(Protocol):
    """A pronunciation scorer turns (target text, what was heard) into a result.

    ``audio_pcm16`` is mono 16 kHz signed-16-bit little-endian PCM. Text-only
    scorers ignore it; acoustic scorers require it and fall back when absent.
    """

    name: str

    def score(
        self,
        target_text: str,
        heard_text: str,
        audio_pcm16: Optional[bytes] = None,
    ) -> PronunciationResult:
        ...
