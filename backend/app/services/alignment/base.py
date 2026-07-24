"""AlignmentProvider — abstract base class for all alignment engines.

Every provider (WhisperX, Montreal Forced Aligner, Azure Speech, etc.)
implements this interface.  No application business logic belongs here.

Usage
-----
    from app.services.alignment.base import AlignmentProvider
    from app.schemas.alignment import AlignmentResult

    class MyProvider(AlignmentProvider):
        @property
        def provider_name(self) -> str:
            return "my_provider"

        def align(self, audio_path, transcript, language="en") -> AlignmentResult:
            ...

        def is_available(self) -> bool:
            ...
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from app.schemas.alignment import AlignmentResult


class AlignmentProvider(ABC):
    """Abstract base class that every forced-alignment provider must implement.

    Contract
    --------
    * ``align()`` receives a WAV file path and an expected transcript string.
    * ``align()`` returns a fully-populated ``AlignmentResult``.
    * The provider is responsible for its own model loading, device selection,
      and output-format conversion.
    * No business logic (scoring, comparison, feedback) belongs in providers.
    * Providers must be stateless with respect to individual requests — all
      mutable state (loaded models, device handles) should be instance variables
      initialised lazily and protected by a threading.Lock.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Short identifier for this provider, e.g. ``"whisperx"``."""
        ...

    @abstractmethod
    def align(
        self,
        audio_path: Path,
        transcript: str,
        language: str = "en",
    ) -> AlignmentResult:
        """Align *audio_path* against *transcript*.

        Parameters
        ----------
        audio_path : Path
            Path to a WAV file (16kHz, mono, PCM16).  The caller creates and
            removes this file; the provider must not delete it.
        transcript : str
            The expected transcript to align against.  Must be non-empty.
        language : str
            BCP-47 language code, default ``"en"``.

        Returns
        -------
        AlignmentResult
            Populated result including word and phoneme alignments.
        """
        ...

    @abstractmethod
    def is_available(self) -> bool:
        """Return True if this provider's dependencies are installed and usable."""
        ...
