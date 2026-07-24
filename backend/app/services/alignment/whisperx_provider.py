"""WhisperX alignment provider — Phase 2.

Uses WhisperX forced alignment to produce word-level (and optionally
phoneme-level) timestamps from a WAV file + expected transcript.

Model loading
-------------
The alignment model is loaded lazily on the first call to ``align()`` and
reused for all subsequent requests.  Loading is protected by a ``threading.Lock``
so concurrent requests don't trigger parallel downloads.

GPU / CPU
---------
CUDA is used automatically when ``torch.cuda.is_available()`` is True.
Falls back to CPU silently.

Phoneme alignment
-----------------
WhisperX provides reliable **word-level** timestamps.  Phoneme-level output
varies by model version.  This provider:
  1. Attempts to extract phoneme timings from WhisperX ``char_segments`` output.
  2. Falls back to proportional interpolation across each word's time span when
     phoneme timing is unavailable.

``alignment_source`` on each ``PhonemeAlignment`` records which path was taken:
  - ``"provider"``     — WhisperX supplied the timing directly.
  - ``"interpolated"`` — timestamps were estimated; treat as approximate.

Phoneme symbols come from ``PronunciationService.lookup(word)`` which uses
CMUDict + g2p_en to get the expected ARPABET sequence.
"""

from __future__ import annotations

import logging
import tempfile
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional, Tuple

from app.schemas.alignment import AlignmentResult, PhonemeAlignment, WordAlignment
from app.services.alignment.base import AlignmentProvider
from app.utils.arpabet_tables import VISEME_ID_MAP, VISEME_DEFAULT

logger = logging.getLogger(__name__)

_SUPPORTED_LANGUAGES = {"en"}


class WhisperXAlignmentProvider(AlignmentProvider):
    """Forced alignment via WhisperX.

    Provider name: ``"whisperx"``

    This is the Phase 2 initial provider.  It will be complemented by a
    Montreal Forced Aligner provider in Phase 3+ for stronger phoneme-level
    accuracy.
    """

    provider_name: str = "whisperx"

    def __init__(self) -> None:
        self._align_model = None
        self._align_metadata: Optional[Dict] = None
        self._lock = Lock()
        self._device: Optional[str] = None

    def _get_device(self) -> str:
        if self._device is None:
            try:
                import torch
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                self._device = "cpu"
        return self._device

    def _load_model(self, language: str = "en") -> None:
        """Lazy-load the WhisperX alignment model. Thread-safe."""
        if self._align_model is not None:
            return
        with self._lock:
            if self._align_model is not None:
                return
            import whisperx
            device = self._get_device()
            logger.info("Loading WhisperX alignment model (lang=%s, device=%s)", language, device)
            self._align_model, self._align_metadata = whisperx.load_align_model(
                language_code=language,
                device=device,
            )
            logger.info("WhisperX alignment model loaded on %s", device)

    def is_available(self) -> bool:
        try:
            import whisperx  # noqa: F401
            return True
        except ImportError:
            return False

    def align(
        self,
        audio_path: Path,
        transcript: str,
        language: str = "en",
    ) -> AlignmentResult:
        """Align *audio_path* against *transcript* using WhisperX.

        Returns an ``AlignmentResult`` with word-level timestamps.
        Phoneme timestamps are provided by WhisperX if available, otherwise
        interpolated proportionally and marked with ``alignment_source="interpolated"``.
        """
        import whisperx

        self._load_model(language)
        device = self._get_device()

        # Load audio as float32 numpy array
        audio = whisperx.load_audio(str(audio_path))
        audio_duration_s = float(len(audio)) / 16000.0  # WhisperX uses 16kHz

        # Build a single-segment transcript in WhisperX format
        segments = [{"text": transcript, "start": 0.0, "end": audio_duration_s}]

        # Run forced alignment
        aligned = whisperx.align(
            segments,
            self._align_model,
            self._align_metadata,
            audio,
            device,
            return_char_alignments=True,  # request character-level if available
        )

        word_segments = aligned.get("word_segments", [])
        words = self._build_word_alignments(word_segments, transcript, audio_duration_s)

        return AlignmentResult(
            transcript=transcript,
            words=words,
            provider=self.provider_name,
            audio_duration_s=audio_duration_s,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_word_alignments(
        self,
        word_segments: List[Dict],
        transcript: str,
        audio_duration_s: float,
    ) -> List[WordAlignment]:
        """Convert WhisperX word_segments into WordAlignment objects."""
        result: List[WordAlignment] = []

        for seg in word_segments:
            word_text = (seg.get("word") or "").strip().lower()
            if not word_text:
                continue

            start = float(seg.get("start", 0.0))
            end = float(seg.get("end", start))
            confidence = seg.get("score")  # WhisperX uses "score" at word level

            # Attempt to get phoneme alignments for this word
            phonemes = self._build_phoneme_alignments(word_text, start, end, seg)

            result.append(
                WordAlignment(
                    word=word_text,
                    start=start,
                    end=end,
                    confidence=float(confidence) if confidence is not None else None,
                    phonemes=phonemes,
                )
            )

        return result

    def _build_phoneme_alignments(
        self,
        word: str,
        word_start: float,
        word_end: float,
        seg: Dict,
    ) -> List[PhonemeAlignment]:
        """Build phoneme alignments for a word.

        Strategy:
        1. Try to use WhisperX ``chars`` field for character-level timings.
        2. Fall back to PronunciationService expected phoneme sequence with
           proportional interpolation across the word's time span.

        All interpolated phonemes are marked ``alignment_source="interpolated"``.
        """
        # Strategy 1: WhisperX char-level alignment
        chars = seg.get("chars") or []
        if chars:
            phonemes = self._phonemes_from_chars(chars, word_start, word_end)
            if phonemes:
                return phonemes

        # Strategy 2: Interpolate from PronunciationService expected phonemes
        return self._interpolate_phonemes(word, word_start, word_end)

    def _phonemes_from_chars(
        self,
        chars: List[Dict],
        word_start: float,
        word_end: float,
    ) -> List[PhonemeAlignment]:
        """Build PhonemeAlignment from WhisperX character-level output.

        WhisperX char alignment gives per-character timing, not per-phoneme.
        We group consecutive chars and map them to ARPABET symbols as a
        best-effort approximation.  This is still marked ``"provider"`` since
        the timings are real, not interpolated.
        """
        result: List[PhonemeAlignment] = []
        for ch in chars:
            char_text = (ch.get("char") or "").upper()
            if not char_text.strip():
                continue
            start = float(ch.get("start", word_start))
            end = float(ch.get("end", start))
            # Map single character to closest ARPABET base (rough approximation)
            symbol = char_text if char_text.isalpha() else "SIL"
            viseme_id = VISEME_ID_MAP.get(symbol, VISEME_DEFAULT)
            duration_ms = (end - start) * 1000.0
            result.append(
                PhonemeAlignment(
                    symbol=symbol,
                    start=start,
                    end=end,
                    confidence=ch.get("score"),
                    viseme_id=viseme_id,
                    observed_duration_ms=round(duration_ms, 2),
                    alignment_source="provider",
                )
            )
        return result

    def _interpolate_phonemes(
        self,
        word: str,
        word_start: float,
        word_end: float,
    ) -> List[PhonemeAlignment]:
        """Interpolate phoneme timestamps proportionally across a word's time span.

        Uses ``PronunciationService.lookup(word)`` for the expected ARPABET
        sequence and spreads the word duration evenly across all phonemes.
        All results are marked ``alignment_source="interpolated"``.
        """
        try:
            from app.services.pronunciation_service import pronunciation_service
            entry = pronunciation_service.lookup(word)
            phoneme_symbols = [p.symbol for p in entry.phonemes]
        except Exception:
            logger.warning("PronunciationService failed for %r; skipping phoneme interpolation", word)
            return []

        if not phoneme_symbols:
            return []

        word_duration = max(0.0, word_end - word_start)
        step = word_duration / len(phoneme_symbols)

        result: List[PhonemeAlignment] = []
        for i, symbol in enumerate(phoneme_symbols):
            ph_start = word_start + i * step
            ph_end = ph_start + step
            viseme_id = VISEME_ID_MAP.get(symbol, VISEME_DEFAULT)
            duration_ms = step * 1000.0
            result.append(
                PhonemeAlignment(
                    symbol=symbol,
                    start=round(ph_start, 4),
                    end=round(ph_end, 4),
                    confidence=None,
                    viseme_id=viseme_id,
                    observed_duration_ms=round(duration_ms, 2),
                    alignment_source="interpolated",
                )
            )
        return result
