"""Wav2Vec2 ASR: lazy singleton, PCM16LE mono 16kHz -> text. Thread-only inference."""
from __future__ import annotations

import logging
from threading import Lock
from typing import Any, Optional, Tuple

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_processor: Any = None
_model: Any = None


def _load() -> Tuple[Any, Any]:
    global _processor, _model
    with _lock:
        if _processor is not None and _model is not None:
            return _processor, _model
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
        import torch

        model_id = settings.WAV2VEC2_MODEL_ID
        logger.info("Loading Wav2Vec2 model %s", model_id)
        _processor = Wav2Vec2Processor.from_pretrained(model_id)
        _model = Wav2Vec2ForCTC.from_pretrained(model_id)
        _model.eval()
        return _processor, _model


def warm_wav2vec2() -> None:
    if not settings.ENABLE_WAV2VEC2:
        return
    try:
        _load()
    except Exception:
        logger.exception("Wav2Vec2 load failed")
        raise


def pcm16le_to_text(pcm: bytes) -> str:
    if not settings.ENABLE_WAV2VEC2:
        return ""
    if not pcm or len(pcm) < 2:
        return ""
    n = len(pcm) // 2
    if n * 2 != len(pcm):
        pcm = pcm[: n * 2]
    x = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
    if len(x) < 400:
        return ""
    import torch

    processor, model = _load()
    inputs = processor(x, sampling_rate=16_000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits
    pred = torch.argmax(logits, dim=-1)
    decoded = processor.batch_decode(pred)
    if not decoded:
        return ""
    return (decoded[0] or "").strip()
