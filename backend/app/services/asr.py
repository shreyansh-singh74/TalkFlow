"""Speech-to-text ASR: lazy singleton, PCM16LE mono 16kHz -> text. Thread-only inference.

Model-agnostic by design: the checkpoint is resolved through
``AutoProcessor``/``AutoModelForCTC`` from ``settings.ASR_MODEL_ID``, so swapping
architectures (WavLM, wav2vec2, HuBERT, ...) is an env-var change only.

Default is WavLM-Large, chosen for out-of-domain robustness on accented,
non-native, real-microphone audio rather than for clean read-speech WER.
"""
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
        from transformers import AutoProcessor, AutoModelForCTC

        model_id = settings.ASR_MODEL_ID
        logger.info("Loading ASR model %s", model_id)
        _processor = AutoProcessor.from_pretrained(model_id)
        _model = AutoModelForCTC.from_pretrained(model_id)
        _model.eval()
        logger.info(
            "ASR model ready: %s (%s)", model_id, type(_model).__name__
        )
        return _processor, _model


def warm_asr() -> None:
    if not settings.ENABLE_ASR:
        return
    try:
        _load()
    except Exception:
        logger.exception("ASR model load failed")
        raise


def pcm16le_to_text(pcm: bytes) -> str:
    if not settings.ENABLE_ASR:
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
