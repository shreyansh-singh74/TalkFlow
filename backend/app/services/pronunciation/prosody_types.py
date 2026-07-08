"""Result shapes for the suprasegmental scoring dimensions (B, C, D).

Kept separate from ``base.py`` so the Phase-1 phoneme scorer has zero hard
dependency on the prosody stack; these are imported only when prosody is on.
All shapes serialize to plain dicts for the WebSocket message + persistence.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class SyllableStress:
    """One syllable's stress assessment vs the canonical reference."""

    syllable: str  # IPA-ish label, e.g. "tin"
    expected_stressed: Optional[bool]  # from CMUdict; None if unknown
    score: float  # 0..1 prominence match
    cues: Dict[str, float] = field(default_factory=dict)
    # cues may carry {duration, energy, f0} prominence ratios


@dataclass
class StressResult:
    """Dimension B — lexical stress accuracy."""

    score: float  # 0..100 aggregate
    syllables: List[SyllableStress] = field(default_factory=list)
    method: str = "heuristic"  # or "md_dnn" once trained

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "syllables": [s.__dict__ for s in self.syllables],
            "method": self.method,
        }


@dataclass
class Pause:
    start: float
    end: float
    duration: float


@dataclass
class TimingResult:
    """Dimension C — rhythm / rate / pausing."""

    score: float  # 0..100
    speech_rate: float  # syllables / sec of speech
    articulation_rate: float  # syllables / sec of speech+pauses
    pace_label: str  # "slow" | "natural" | "fast"
    pauses: List[Pause] = field(default_factory=list)
    speech_fraction: float = 0.0  # fraction of clip that is speech

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "speech_rate": round(self.speech_rate, 3),
            "articulation_rate": round(self.articulation_rate, 3),
            "pace_label": self.pace_label,
            "pauses": [p.__dict__ for p in self.pauses],
            "speech_fraction": round(self.speech_fraction, 3),
        }


@dataclass
class IntonationResult:
    """Dimension D — pitch contour shape vs reference."""

    score: float  # 0..100
    dtw_distance: float  # lower = closer to reference
    slope: float  # semitone slope across the contour
    label: str  # "rising" | "falling" | "level"
    contour: List[float] = field(default_factory=list)  # semitone-normalized F0
    reference_contour: List[float] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "dtw_distance": round(self.dtw_distance, 3),
            "slope": round(self.slope, 3),
            "label": self.label,
            "contour": [round(c, 3) for c in self.contour],
            "reference_contour": [round(c, 3) for c in self.reference_contour],
        }
