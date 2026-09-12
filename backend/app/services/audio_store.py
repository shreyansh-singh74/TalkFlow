"""Raw turn-audio persistence to local disk (Phase 0 + Phase 5 eval datasets).

Consent-gated by ``settings.PERSIST_TURN_AUDIO``: never writes unless the flag
is on. A background sweep deletes files older than ``TURN_AUDIO_RETENTION_HOURS``
so disk does not grow unbounded.

Layout:  ``<TURN_AUDIO_DIR>/<session_id>/<turn_id>.wav``

We store WAV (not raw PCM) so the files are directly usable by the eval harness
and external tools (Praat, audacity, MFA) without a conversion step.
"""

from __future__ import annotations

import asyncio
import io
import logging
import os
import re
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


def _safe_segment(value: str, fallback: str) -> str:
    """Reduce one path component to something that cannot escape the root.

    Both ids reach us from the client, so they are untrusted input being turned
    into a filesystem path. Only ``[A-Za-z0-9_-]`` survives: no path separator
    (``/`` *or* ``\\``, which matters on Windows), no ``..``, no leading dot.
    Length is capped so a hostile id cannot overrun the filename limit. The
    previous version replaced only ``/`` -- which left ``..`` and ``\\`` intact.
    """
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "_", str(value or ""))
    cleaned = cleaned.strip("._-")[:64]
    return cleaned or fallback


def save_turn_audio(session_id: str, turn_id: str, pcm16: bytes) -> Optional[str]:
    """Persist a turn's PCM16 audio as a WAV. Returns the file path or None.

    Returns None silently when persistence is disabled or the audio is empty,
    so callers can treat this as best-effort.
    """
    if not settings.PERSIST_TURN_AUDIO:
        return None
    if not pcm16:
        return None
    safe_session = _safe_segment(session_id, "unknown")
    safe_turn = _safe_segment(turn_id, "turn")
    folder = os.path.join(settings.TURN_AUDIO_DIR, safe_session)
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
        logger.exception("Failed to persist turn audio for %s/%s", safe_session, safe_turn)
        return None


def delete_session_audio(session_id: str) -> int:
    """Delete every retained file for one practice session. Returns count removed.

    This is what backs the "delete my stored audio" control: retention has to be
    revocable by the person who consented to it, not only by an expiry sweep.
    The session id is untrusted input turned into a path, so it goes through the
    same sanitiser as writes, and the resolved directory is re-checked against
    the audio root before anything is unlinked.
    """
    safe_session = _safe_segment(session_id, "")
    if not safe_session:
        return 0
    root = os.path.abspath(settings.TURN_AUDIO_DIR)
    folder = os.path.abspath(os.path.join(root, safe_session))
    # `_safe_segment` already removes separators; this is the belt to its braces.
    if folder != root and not folder.startswith(root + os.sep):
        logger.warning("Refusing to delete outside the audio root: %s", folder)
        return 0
    removed = 0
    try:
        for name in os.listdir(folder):
            if not name.endswith(".wav"):
                continue
            try:
                os.remove(os.path.join(folder, name))
                removed += 1
            except OSError:
                pass
        os.rmdir(folder)
    except FileNotFoundError:
        return 0
    except OSError:
        logger.warning("Could not remove audio directory %s", folder)
    return removed


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
        # Drop now-empty session dirs.
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

