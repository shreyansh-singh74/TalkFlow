"""Scorer selection. Chooses the active scorer from config (cached singleton)."""

from __future__ import annotations

import logging
from threading import Lock

from app.core.config import settings
from app.services.pronunciation.base import PronunciationScorer
from app.services.pronunciation.text_proxy_scorer import TextProxyScorer

logger = logging.getLogger(__name__)

_lock = Lock()
_scorer: PronunciationScorer | None = None


def get_scorer() -> PronunciationScorer:
    global _scorer
    if _scorer is not None:
        return _scorer
    with _lock:
        if _scorer is None:
            if settings.ENABLE_ACOUSTIC_SCORING:
                from app.services.pronunciation.acoustic_scorer import AcousticScorer

                logger.info("Pronunciation scorer: acoustic (wav2vec2 + GOP)")
                _scorer = AcousticScorer()
            else:
                logger.info("Pronunciation scorer: text_proxy")
                _scorer = TextProxyScorer()
    return _scorer
