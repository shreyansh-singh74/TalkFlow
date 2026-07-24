"""AlignmentService — wrapper service for forced alignment.

Orchestrates the forced alignment pipeline:
  1. Input validation (audio_pcm and transcript must be non-empty)
  2. PCM16 -> WAV conversion in-memory
  3. Temporary WAV persistence on disk (/tmp/<uuid>.wav)
  4. Execution of the configured AlignmentProvider (e.g. WhisperXAlignmentProvider)
  5. Guaranteed cleanup of the temporary WAV file (in a `finally` block)
  6. Post-processing / enrichment with PronunciationService if required

This service is the primary entrypoint used by FastAPI routes or WebSocket handlers.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.schemas.alignment import AlignmentResult
from app.services.alignment.base import AlignmentProvider
from app.services.alignment.whisperx_provider import WhisperXAlignmentProvider
from app.services.audio_store import pcm16_to_wav_bytes

logger = logging.getLogger(__name__)


class AlignmentService:
    """Wrapper service orchestrating forced alignment through a provider."""

    def __init__(self, provider: Optional[AlignmentProvider] = None) -> None:
        if provider is None:
            provider = WhisperXAlignmentProvider()
        self._provider = provider

    @property
    def provider_name(self) -> str:
        return self._provider.provider_name

    async def align(
        self,
        audio_pcm: bytes,
        transcript: str,
        language: str = "en",
    ) -> AlignmentResult:
        """Align PCM16 audio against expected transcript.

        Parameters
        ----------
        audio_pcm : bytes
            Raw PCM16 mono 16kHz audio bytes.
        transcript : str
            The target / expected transcript text.
        language : str
            Language code (default "en").

        Returns
        -------
        AlignmentResult
            Structured alignment result containing words and phonemes.
        """
        clean_transcript = (transcript or "").strip()
        if not clean_transcript:
            raise ValueError("Transcript is required for forced alignment")
        if not audio_pcm:
            raise ValueError("Audio PCM bytes are required for forced alignment")

        # Convert PCM16 to WAV container
        wav_bytes = pcm16_to_wav_bytes(audio_pcm)

        # Write to temporary file
        temp_dir = settings.TEMP_DIR or tempfile.gettempdir()
        temp_filename = f"align_{uuid.uuid4().hex}.wav"
        temp_path = Path(temp_dir) / temp_filename

        try:
            with open(temp_path, "wb") as f:
                f.write(wav_bytes)

            # Execute provider in thread pool to avoid blocking async event loop
            result = await asyncio.to_thread(
                self._provider.align,
                temp_path,
                clean_transcript,
                language,
            )
            return result

        finally:
            if temp_path.exists():
                try:
                    os.remove(temp_path)
                except OSError:
                    logger.warning("Failed to remove temporary alignment WAV: %s", temp_path)


# Global singleton instance
alignment_service = AlignmentService()
