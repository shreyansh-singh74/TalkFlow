"""Phoneme respelling service — compatibility adapter (Phase 1).

This module is now a thin adapter over ``PronunciationService``.
It preserves the existing public interface (``get_dialect_respelling``)
so that any callers that were using it continue to work unchanged.

Phase 1 changes
---------------
* Removed: ``COMMON_WORDS`` hardcoded dictionary (5 words, brittle)
* Removed: OpenRouter LLM respelling call (slow, costly, unreliable)
* Removed: ``_local_fallback()`` (superseded by PronunciationService._from_g2p)
* Removed: disk cache ``respellings_cache.json`` (superseded by LRU in PronunciationService)
* Rewritten: ``get_dialect_respelling()`` now delegates to PronunciationService
  and reshapes ``syllables[]`` into the legacy ``[{phones, display, stressed}]`` format.

Future
------
Delete this module once the frontend migrates to ``GET /api/phonemes/info/{word}``.
At that point the ``PhonemeRespellingService`` class and its singleton can be removed
entirely.  All pronunciation logic lives in ``PronunciationService``.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from app.services.pronunciation_service import pronunciation_service

logger = logging.getLogger(__name__)


class PhonemeRespellingService:
    """Thin compatibility adapter over PronunciationService.

    Preserves the original ``get_dialect_respelling(word, lang)`` interface
    so existing callers require no changes.  The ``lang`` parameter is
    accepted for forward-compatibility with future dialect-specific display
    variants but is currently unused in the lookup pipeline.
    """

    async def get_dialect_respelling(
        self, word: str, lang: str
    ) -> List[Dict[str, Any]]:
        """Return syllable respelling rows in the legacy format.

        Returns a list of dicts with keys: ``phones``, ``display``, ``stressed``.
        This matches the shape expected by the existing frontend consumers and
        the ``/api/phonemes/reference/{word}`` endpoint.
        """
        w = (word or "").strip().lower()
        if not w:
            return []

        try:
            entry = pronunciation_service.lookup(w)
        except Exception:
            logger.exception("PronunciationService.lookup failed for %r", w)
            return [{"phones": "", "display": w, "stressed": True}]

        if not entry.syllables:
            return [{"phones": "", "display": w, "stressed": True}]

        return [
            {
                "phones": "",          # not required by current frontend
                "display": syl.text,
                "stressed": bool(syl.stress),
            }
            for syl in entry.syllables
        ]


# Singleton — kept for backward compatibility
phoneme_respelling_service = PhonemeRespellingService()
