"""Pronunciation scoring package.

Phase 1 of the audio-based scoring roadmap. Exposes a swappable
``PronunciationScorer`` interface with two implementations:

- ``TextProxyScorer``  – the legacy text-vs-text comparison (transcript based).
- ``AcousticScorer``   – wav2vec2 phoneme recognition on the raw audio + GOP-style
                          alignment scoring against the G2P reference.

The active scorer is chosen by configuration so the engine can be swapped or
A/B tested without touching the WebSocket layer.
"""

from app.services.pronunciation.base import (
    PronunciationResult,
    PronunciationScorer,
)
from app.services.pronunciation.prosody_types import (
    IntonationResult,
    Pause,
    StressResult,
    SyllableStress,
    TimingResult,
)
from app.services.pronunciation.registry import get_scorer

__all__ = [
    "PronunciationResult",
    "PronunciationScorer",
    "get_scorer",
    "StressResult",
    "SyllableStress",
    "TimingResult",
    "Pause",
    "IntonationResult",
]
