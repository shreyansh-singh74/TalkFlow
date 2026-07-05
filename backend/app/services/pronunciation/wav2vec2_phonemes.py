"""Acoustic phoneme recognizer (wav2vec2 CTC), lazy singleton.

Returns the recognized phone sequence WITH a per-phone confidence derived from
the CTC frame posteriors. Confidence feeds the GOP-style scoring so a phone the
model is unsure about is not treated as a confident error.

Distinct from ``wav2vec2_asr.py`` (which returns words). This emits IPA phones
and maps them into ARPAbet space for alignment against the G2P reference.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from threading import Lock
from typing import Any, List, Optional, Tuple

import numpy as np

from app.core.config import settings
from app.services.pronunciation.phone_set import ipa_to_arpabet

logger = logging.getLogger(__name__)

_lock = Lock()
_processor: Any = None
_model: Any = None


@dataclass
class RecognizedPhone:
    phone: str  # ARPAbet
    confidence: float  # mean CTC posterior over contributing frames, 0..1


def _load() -> Tuple[Any, Any]:
    global _processor, _model
    with _lock:
        if _processor is not None and _model is not None:
            return _processor, _model
        from transformers import AutoProcessor, AutoModelForCTC

        model_id = settings.ACOUSTIC_PHONEME_MODEL_ID
        logger.info("Loading acoustic phoneme model %s", model_id)
        _processor = AutoProcessor.from_pretrained(model_id)
        _model = AutoModelForCTC.from_pretrained(model_id)
        _model.eval()
        return _processor, _model


def warm_phoneme_model() -> None:
    if not settings.ENABLE_ACOUSTIC_SCORING:
        return
    try:
        _load()
    except Exception:
        logger.exception("Acoustic phoneme model load failed")
        raise


def _pcm16le_to_float(pcm: bytes) -> np.ndarray:
    n = len(pcm) // 2
    if n == 0:
        return np.zeros(0, dtype=np.float32)
    return np.frombuffer(pcm[: n * 2], dtype=np.int16).astype(np.float32) / 32768.0


def _ctc_collapse(
    ids: np.ndarray, probs: np.ndarray, blank_id: int
) -> List[Tuple[int, float]]:
    """Collapse a CTC frame path to (token_id, mean_confidence) pairs."""
    out: List[Tuple[int, float]] = []
    run_id: Optional[int] = None
    run_conf: List[float] = []
    for tok, p in zip(ids.tolist(), probs.tolist()):
        if tok == run_id:
            run_conf.append(p)
            continue
        if run_id is not None and run_id != blank_id and run_conf:
            out.append((run_id, float(np.mean(run_conf))))
        run_id = tok
        run_conf = [p]
    if run_id is not None and run_id != blank_id and run_conf:
        out.append((run_id, float(np.mean(run_conf))))
    return out


def recognize_phones(pcm16: bytes) -> List[RecognizedPhone]:
    """Audio (PCM16 mono 16kHz) -> list of recognized ARPAbet phones w/ confidence."""
    if not settings.ENABLE_ACOUSTIC_SCORING:
        return []
    x = _pcm16le_to_float(pcm16)
    if x.shape[0] < 400:  # < 25ms, nothing to recognize
        return []

    import torch

    processor, model = _load()
    inputs = processor(x, sampling_rate=16_000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits[0]  # (T, V)
        probs_t = torch.softmax(logits, dim=-1)
        max_probs, ids = probs_t.max(dim=-1)

    blank_id = getattr(processor.tokenizer, "pad_token_id", 0) or 0
    collapsed = _ctc_collapse(ids.cpu().numpy(), max_probs.cpu().numpy(), blank_id)

    tokenizer = processor.tokenizer
    out: List[RecognizedPhone] = []
    for tok_id, conf in collapsed:
        token = tokenizer.convert_ids_to_tokens(int(tok_id))
        if not token or token in ("|", "<pad>", "<s>", "</s>", "<unk>", " "):
            continue
        for arp in ipa_to_arpabet(token):
            out.append(RecognizedPhone(phone=arp, confidence=conf))
    return out
