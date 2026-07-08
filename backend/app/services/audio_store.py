"""Raw turn-audio persistence to local disk (Phase 0 + Phase 5 eval datasets).

Consent-gated by ``settings.PERSIST_TURN_AUDIO``: never writes unless the flag
is on. A background sweep deletes files older than ``TURN_AUDIO_RETENTION_HOURS``
so disk does not grow unbounded.

Layout:  ``<TURN_AUDIO_DIR>/<meeting_id>/<turn_id>.wav``

We store WAV (not raw PCM) so the files are directly usable by the eval harness
and external tools (Praat, audacity, MFA) without a conversion step.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import time
import wave
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_SAMPLE_RATE = settings.AUDIO_SAMPLE_RATE  # 16000
_CHANNELS = settings.AUDIO_CHANNELS  # 1
_SAMPLE_WIDTH = 2  # PCM16

_last_sweep: float = 0.0


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def save_turn_audio(meeting_id: str, turn_id: str, pcm16: bytes) -> Optional[str]:
    """Persist a turn's PCM16 audio as a WAV. Returns the file path or None.

    Returns None silently when persistence is disabled or the audio is empty,
    so callers can treat this as best-effort.
    """
    if not settings.PERSIST_TURN_AUDIO:
        return None
    if not pcm16:
        return None
    safe_meeting = (meeting_id or "unknown").replace("/", "_") or "unknown"
    safe_turn = (turn_id or "turn").replace("/", "_") or "turn"
    folder = os.path.join(settings.TURN_AUDIO_DIR, safe_meeting)
    try:
        _ensure_dir(folder)
        path = os.path.join(folder, f"{safe_turn}.wav")
        with wave.open(path, "wb") as wf:
            wf.setnchannels(_CHANNELS)
            wf.setsampwidth(_SAMPLE_WIDTH)
            wf.setframerate(_SAMPLE_RATE)
            wf.writeframes(pcm16)
        return path
    except Exception:
        logger.exception("Failed to persist turn audio for %s/%s", safe_meeting, safe_turn)
        return None


def pcm16_to_wav_bytes(pcm16: bytes) -> bytes:
    """Wrap raw PCM16 in a WAV container in-memory (for prosody tools needing a header)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(_CHANNELS)
        wf.setsampwidth(_SAMPLE_WIDTH)
        wf.setframerate(_SAMPLE_RATE)
        wf.writeframes(pcm16)
    return buf.getvalue()


def _sweep_sync() -> int:
    """Delete audio files older than the retention window. Returns count removed."""
    if not os.path.isdir(settings.TURN_AUDIO_DIR):
        return 0
    cutoff = time.time() - settings.TURN_AUDIO_RETENTION_HOURS * 3600
    removed = 0
    for root, _dirs, files in os.walk(settings.TURN_AUDIO_DIR):
        for name in files:
            if not name.endswith(".wav"):
                continue
            full = os.path.join(root, name)
            try:
                if os.path.getmtime(full) < cutoff:
                    os.remove(full)
                    removed += 1
            except OSError:
                pass
        # Drop now-empty meeting dirs.
        try:
            if not os.listdir(root) and root != settings.TURN_AUDIO_DIR:
                os.rmdir(root)
        except OSError:
            pass
    return removed


async def sweep_old_audio_loop() -> None:
    """Background coroutine: periodically prune stale audio files."""
    global _last_sweep
    interval = max(60, settings.AUDIO_RETENTION_SWEEP_INTERVAL_SECONDS)
    while True:
        try:
            await asyncio.sleep(interval)
            if not settings.PERSIST_TURN_AUDIO:
                continue
            removed = await asyncio.to_thread(_sweep_sync)
            _last_sweep = time.time()
            if removed:
                logger.info("Audio retention sweep removed %d stale file(s)", removed)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Audio retention sweep failed")

