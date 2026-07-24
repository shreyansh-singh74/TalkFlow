"""Pydantic models for the pronunciation domain.

These models are shared across:
  - PronunciationService  (service layer)
  - /api/phonemes routes  (API layer)
  - Future: acoustic scorer, forced alignment, AI coach

Design notes
------------
All nullable fields (confidence, expected_duration_ms) are intentionally None
in Phase 1. They are filled by later phases without any API contract change:
  - confidence          : Phase 3 — acoustic scoring
  - expected_duration_ms: Phase 5 — forced alignment / rhythm scoring
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class PhonemeEntry(BaseModel):
    """A single ARPABET phoneme with pronunciation metadata.

    Fields
    ------
    symbol : str
        ARPABET base symbol with stress digit stripped, e.g. ``"AE"``
        (never ``"AE1"``).  ARPABET is the canonical representation; IPA
        and display strings are derived from this.
    stress : int
        ``0`` = no stress, ``1`` = primary stress, ``2`` = secondary stress.
    viseme_id : int
        Integer ID (0–9) mapping to a mouth-shape group.  System-agnostic —
        the animation layer maps this integer to SVG / Rive / Lottie / 3D.
        See ``app/utils/arpabet_tables.VISEME_ID_MAP`` for the full table.
    confidence : float | None
        Acoustic confidence that the learner produced this phoneme correctly.
        ``None`` in Phase 1; filled by the acoustic scorer in Phase 3.
    expected_duration_ms : float | None
        Expected duration in milliseconds from a reference speaker.
        ``None`` in Phase 1; filled by forced alignment in Phase 5 and used
        for rhythm / fluency scoring.
    """

    symbol: str
    stress: int
    viseme_id: int
    confidence: Optional[float] = None
    expected_duration_ms: Optional[float] = None


class SyllableEntry(BaseModel):
    """A single syllable with its simplified display text and stress level.

    The ``text`` field contains a readable phonetic respelling (e.g. ``"nat"``,
    ``"chur"``) derived from ARPABET via the display helper in
    ``pronunciation_reference.py``.  The frontend or a server-side helper
    renders the full display string (e.g. ``"nat • chur • uh • lee"``) from
    these objects at render time — it is never stored inside the model.
    """

    text: str
    stress: int


class PronunciationEntry(BaseModel):
    """Full structured pronunciation data for a single word.

    Design notes
    ------------
    * ``ipa`` is a **derived** representation computed by
      ``arpabet_tables.arpabet_to_ipa()`` at response serialization time.
      It is never stored in any cache or database.
    * ``phonemes`` is the canonical representation.  All downstream
      consumers (scorer, aligner, coach) should work from ``phonemes``,
      not from ``ipa``.
    * ``syllables`` provide the display layer.  Future dialect-specific
      display variants are built from ``phonemes`` by a dialect-aware
      helper — the model itself stays dialect-agnostic.
    """

    word: str
    ipa: str
    phonemes: List[PhonemeEntry]
    syllables: List[SyllableEntry]
