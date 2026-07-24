"""Alignment result schemas — Phase 2 Forced Alignment.

These Pydantic models form the contract between:
  - AlignmentService (producer)
  - Phase 3: phoneme scoring / comparison
  - Phase 5: rhythm and fluency scoring
  - Phase 8: viseme-driven mouth animation

Design notes
------------
alignment_source
    Every PhonemeAlignment carries an ``alignment_source`` field that records
    whether timestamps came directly from the alignment provider (``"provider"``)
    or were interpolated proportionally across a word's time span
    (``"interpolated"``).  Downstream phases must not treat interpolated timings
    as ground-truth phoneme boundaries.

observed_duration_ms
    The actual measured duration of the phoneme in the audio
    (``(end - start) * 1000``).  This is NOT the same as ``expected_duration_ms``
    which belongs to Phase 5 and will be derived from reference pronunciations
    or aggregated statistics for rhythm scoring.

provider field in AlignmentResult
    Records which alignment engine produced the result.  The provider abstraction
    allows future substitution with MFA, Azure Speech Alignment, or Deepgram
    without changing any schema or application logic.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class PhonemeAlignment(BaseModel):
    """Timestamp and metadata for a single ARPABET phoneme.

    Fields
    ------
    symbol : str
        ARPABET base symbol with stress digit stripped, e.g. ``"AE"``.
    start : float
        Start time in seconds from the beginning of the audio clip.
    end : float
        End time in seconds from the beginning of the audio clip.
    confidence : float | None
        Provider-reported confidence for this phoneme, or None if unavailable.
    viseme_id : int
        Integer viseme group ID (0–9).  Set from ``VISEME_ID_MAP`` in
        ``arpabet_tables.py``.  Phase 8 maps this to a mouth-shape animation.
    observed_duration_ms : float | None
        Actual duration of this phoneme in the audio: ``(end - start) * 1000``.
        **Not** the expected or reference duration — that is a Phase 5 concept.
    alignment_source : "provider" | "interpolated"
        ``"provider"``    — timestamps came directly from the alignment engine.
        ``"interpolated"`` — timestamps were estimated by spreading the word's
        duration proportionally across its phoneme sequence because the provider
        did not return phoneme-level timing.  Phase 3+ consumers should treat
        interpolated timings as approximate only.
    """

    symbol: str
    start: float
    end: float
    confidence: Optional[float] = None
    viseme_id: int
    observed_duration_ms: Optional[float] = None
    alignment_source: Literal["provider", "interpolated"] = "provider"


class WordAlignment(BaseModel):
    """Timestamp and phoneme breakdown for a single word.

    Fields
    ------
    word : str
        The word string as it appears in the expected transcript (normalised,
        lowercased).
    start : float
        Start time in seconds.
    end : float
        End time in seconds.
    confidence : float | None
        Provider-reported word-level confidence, or None if unavailable.
    phonemes : List[PhonemeAlignment]
        Ordered list of phoneme alignments within this word.  May be derived
        from interpolation if the provider does not supply phoneme-level output.
    """

    word: str
    start: float
    end: float
    confidence: Optional[float] = None
    phonemes: List[PhonemeAlignment] = []


class AlignmentResult(BaseModel):
    """Full alignment output for a single audio + transcript pair.

    Fields
    ------
    transcript : str
        The normalised expected transcript that was aligned against.
    words : List[WordAlignment]
        Ordered list of word-level alignments.
    provider : str
        Name of the alignment engine that produced this result, e.g.
        ``"whisperx"``.  Future providers: ``"mfa"``, ``"azure"``, ``"deepgram"``.
    audio_duration_s : float | None
        Total duration of the input audio in seconds.
    """

    transcript: str
    words: List[WordAlignment]
    provider: str
    audio_duration_s: Optional[float] = None
