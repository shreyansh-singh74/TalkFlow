"""Pydantic schemas for Phase 3A Pronunciation Comparison Engine.

These models represent the deterministic difference graph produced by comparing
expected pronunciations against actual forced-alignment output.

Phase 3A models do NOT contain scores, grades, feedback text, or LLM output.
They form the clean structural graph consumed by:
  - Phase 3B: Pronunciation Scoring Engine
  - Phase 4: L1-aware Coaching & Error Analysis
  - Phase 8: Viseme-driven Mouth Animation
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class ComparisonPhoneme(BaseModel):
    """Comparison entry for a single phoneme slot in sequence alignment.

    Fields
    ------
    expected : str | None
        Expected ARPABET base symbol (e.g. ``"AE"``), or None if this is an insertion.
    actual : str | None
        Actual spoken ARPABET base symbol (e.g. ``"EH"``), or None if this is a deletion.
    operation : "match" | "substitution" | "deletion" | "insertion"
        The alignment operation determined by Needleman-Wunsch sequence alignment.
    articulatory_differences : List[str]
        List of specific articulatory feature differences between expected and actual
        phonemes (e.g. ``["voicing_changed"]``, ``["vowel_height_changed"]``, ``["phoneme_deleted"]``).
    expected_viseme_id : int | None
        Integer viseme ID (0–9) for the expected phoneme.
    actual_viseme_id : int | None
        Integer viseme ID (0–9) for the actual spoken phoneme.
    start : float | None
        Start timestamp in seconds from audio start (from Forced Alignment).
    end : float | None
        End timestamp in seconds from audio start (from Forced Alignment).
    observed_duration_ms : float | None
        Observed duration in milliseconds: ``(end - start) * 1000``.
    alignment_source : "provider" | "interpolated" | None
        ``"provider"`` if timestamp came from forced aligner, ``"interpolated"`` if estimated.
    """

    expected: Optional[str] = None
    actual: Optional[str] = None
    operation: Literal["match", "substitution", "deletion", "insertion"]
    articulatory_differences: List[str] = []
    expected_viseme_id: Optional[int] = None
    actual_viseme_id: Optional[int] = None
    start: Optional[float] = None
    end: Optional[float] = None
    confidence: Optional[float] = None
    observed_duration_ms: Optional[float] = None
    alignment_source: Optional[Literal["provider", "interpolated"]] = None


class ComparisonWord(BaseModel):
    """Comparison breakdown for a single word.

    Fields
    ------
    word : str
        The target word text (normalised, lowercased).
    start : float | None
        Word start timestamp in seconds.
    end : float | None
        Word end timestamp in seconds.
    phonemes : List[ComparisonPhoneme]
        Ordered sequence of phoneme comparisons for this word.
    """

    word: str
    start: Optional[float] = None
    end: Optional[float] = None
    phonemes: List[ComparisonPhoneme] = []


class ComparisonResult(BaseModel):
    """Top-level difference graph for a full sentence comparison.

    Fields
    ------
    transcript : str
        The expected target transcript text.
    words : List[ComparisonWord]
        List of per-word comparison objects.
    provider : str
        Alignment provider name (e.g. ``"whisperx"``).
    """

    transcript: str
    words: List[ComparisonWord]
    provider: str
