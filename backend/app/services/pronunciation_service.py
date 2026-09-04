"""PronunciationService — Phase 1 Pronunciation Knowledge Base.

Provides word-level pronunciation lookups backed by:
  1. CMU Pronouncing Dictionary (standalone ``cmudict`` package, ~126k words)
  2. g2p_en fallback for out-of-vocabulary words

Returns fully structured ``PronunciationEntry`` objects (Pydantic) containing:
  - ARPABET phonemes with stress, viseme_id, confidence, expected_duration_ms
  - Syllables with display text and stress
  - IPA string derived on-the-fly (never stored)

Design notes
------------
* ARPABET is the canonical representation — everything else is derived.
* Results are memoised with ``@functools.lru_cache(maxsize=10_000)``, giving
  O(1) repeated lookups with automatic LRU eviction and no cleanup logic.
* g2p_en is lazy-loaded on first OOV request to avoid slowing startup.
* For words with multiple CMUDict pronunciations (e.g. "read"), the first
  entry (most common / neutral) is used.  A ``variant`` param can be added
  in Phase 2 to expose alternates.
"""

from __future__ import annotations

import logging
import re
from functools import lru_cache
from threading import Lock
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

_STRESS_RE = re.compile(r"\d+$")
_ALPHA_RE = re.compile(r"[^a-z\-']")


def _strip_stress(token: str) -> tuple[str, int]:
    """Parse ``'AE1'`` → ``('AE', 1)``.  Returns stress=0 if no digit."""
    t = token.strip().upper()
    m = _STRESS_RE.search(t)
    if m:
        return t[: m.start()], int(m.group())
    return t, 0


class PronunciationService:
    """Thread-safe pronunciation lookup service.

    Usage
    -----
    Import the singleton::

        from app.services.pronunciation_service import pronunciation_service

        entry = pronunciation_service.lookup("naturally")
        print(entry.ipa)          # "ˈnætʃɝəli"
        print(entry.phonemes[1].viseme_id)   # 5 (open)
    """

    def __init__(self) -> None:
        # Load CMUDict once at startup — it's a pure in-memory dict after load
        try:
            import cmudict as _cmudict_pkg
            self._cmu: Dict[str, List[List[str]]] = _cmudict_pkg.dict()
            logger.info("CMUDict loaded: %d entries", len(self._cmu))
        except Exception:
            logger.exception("Failed to load CMUDict; all lookups will use g2p_en fallback")
            self._cmu = {}

        self._g2p = None
        self._g2p_lock = Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def lookup(self, word: str) -> "PronunciationEntry":
        """Return a PronunciationEntry for *word*.

        Results are cached by the LRU decorator.  The cache key is the
        normalised (lowercase, punctuation-stripped) word string.
        """
        return self._lookup_cached(self._normalise(word))

    # ------------------------------------------------------------------
    # Private — normalisation and cache
    # ------------------------------------------------------------------

    @staticmethod
    def _normalise(word: str) -> str:
        """Lowercase, strip non-alpha characters (keep hyphen/apostrophe)."""
        return _ALPHA_RE.sub("", (word or "").lower().strip())

    @lru_cache(maxsize=10_000)
    def _lookup_cached(self, word: str) -> "PronunciationEntry":
        """Cached inner lookup — keyed on the normalised word string."""
        if not word:
            return self._empty_entry(word)

        entry = self._from_cmudict(word)
        if entry is not None:
            return entry

        logger.debug("CMUDict miss for %r — using g2p_en fallback", word)
        return self._from_g2p(word)

    # ------------------------------------------------------------------
    # Private — CMUDict path
    # ------------------------------------------------------------------

    def _from_cmudict(self, word: str) -> "Optional[PronunciationEntry]":
        """Look up *word* in CMUDict.  Returns None on miss."""
        pronunciations = self._cmu.get(word)
        if not pronunciations:
            return None
        # Multiple pronunciations → take [0] (most common/neutral)
        raw_tokens: List[str] = pronunciations[0]
        return self._build_entry(word, raw_tokens)

    # ------------------------------------------------------------------
    # Private — g2p_en fallback path
    # ------------------------------------------------------------------

    def _get_g2p(self):
        """Lazy-load g2p_en.G2p (and its NLTK dependencies) on first call."""
        if self._g2p is None:
            with self._g2p_lock:
                if self._g2p is None:
                    self._ensure_nltk()
                    from g2p_en import G2p
                    logger.info("Loading g2p_en model (OOV fallback)")
                    self._g2p = G2p()
        return self._g2p

    @staticmethod
    def _ensure_nltk() -> None:
        """Download NLTK resources required by g2p_en if not already present."""
        import nltk
        required = [
            ("taggers/averaged_perceptron_tagger_eng", "averaged_perceptron_tagger_eng"),
            ("taggers/averaged_perceptron_tagger", "averaged_perceptron_tagger"),
            ("corpora/cmudict", "cmudict"),
        ]
        for path, pkg in required:
            try:
                nltk.data.find(path)
            except LookupError:
                logger.info("Downloading NLTK resource %s", pkg)
                try:
                    nltk.download(pkg, quiet=True)
                except Exception:
                    logger.exception("Failed to download NLTK resource %s", pkg)

    def _from_g2p(self, word: str) -> "PronunciationEntry":
        """Use g2p_en to produce ARPABET tokens for *word*."""
        try:
            g2p = self._get_g2p()
            raw: List[str] = g2p(word)
            # Filter to phoneme tokens only (skip whitespace / punctuation)
            tokens = [t for t in raw if t and t[0].isalnum()]
            if tokens:
                return self._build_entry(word, tokens)
        except Exception:
            logger.exception("g2p_en failed for %r", word)
        return self._empty_entry(word)

    # ------------------------------------------------------------------
    # Private — entry construction
    # ------------------------------------------------------------------

    def _build_entry(self, word: str, raw_tokens: List[str]) -> "PronunciationEntry":
        """Build a PronunciationEntry from a list of raw ARPABET tokens."""
        from app.schemas.pronunciation import PronunciationEntry
        from app.utils.arpabet_tables import arpabet_to_ipa
        from app.utils.syllabify import syllabify

        # Filter once and partition once, then build both the phoneme list and
        # the syllable list from that single partition. Previously
        # _extract_phonemes and _extract_syllables each re-filtered the same raw
        # tokens independently, so the two lists stayed index-aligned only by
        # coincidence — and neither could say which syllable a phoneme was in.
        tokens = [t.strip() for t in raw_tokens if t and t.strip() and t.strip()[0].isalnum()]
        groups = syllabify(tokens)

        phonemes = self._extract_phonemes(tokens, groups)
        syllables = self._extract_syllables(word, tokens, groups)
        ipa = arpabet_to_ipa(phonemes)

        return PronunciationEntry(
            word=word,
            ipa=ipa,
            phonemes=phonemes,
            syllables=syllables,
        )

    def _extract_phonemes(
        self, tokens: List[str], groups: List[List[int]]
    ) -> "List[PhonemeEntry]":
        """Convert filtered ARPABET tokens into PhonemeEntry objects."""
        from app.schemas.pronunciation import PhonemeEntry
        from app.utils.arpabet_tables import VISEME_ID_MAP, VISEME_DEFAULT

        syllable_of = {i: s for s, group in enumerate(groups) for i in group}

        result = []
        for index, token in enumerate(tokens):
            symbol, stress = _strip_stress(token)
            viseme_id = VISEME_ID_MAP.get(symbol, VISEME_DEFAULT)
            result.append(
                PhonemeEntry(
                    symbol=symbol,
                    stress=stress,
                    viseme_id=viseme_id,
                    syllable_index=syllable_of.get(index, 0),
                    confidence=None,
                    # Reserved for Phase 5 forced alignment. Deliberately left
                    # None: the mouth animation derives its frame timing on the
                    # client from the measured audio duration, and must never
                    # write nominal constants into a field that rhythm scoring
                    # will read as a reference measurement.
                    expected_duration_ms=None,
                )
            )
        return result

    def _extract_syllables(
        self, word: str, tokens: List[str], groups: List[List[int]]
    ) -> "List[SyllableEntry]":
        """Build syllable objects from the shared phone partition."""
        from app.schemas.pronunciation import SyllableEntry
        from app.utils.pronunciation_reference import _phone_bits
        from app.utils.syllabify import syllable_stress

        if not tokens:
            return [SyllableEntry(text=word, stress=0)]

        result = []
        for group in groups:
            if not group:
                continue
            result.append(
                SyllableEntry(
                    text=_phone_bits([tokens[i] for i in group]),
                    # Real level: 1 primary, 2 secondary, 0 none. Previously
                    # collapsed to 1 for either, so a word with both marked two
                    # syllables as stressed.
                    stress=syllable_stress(tokens, group),
                )
            )
        return result

    @staticmethod
    def _empty_entry(word: str) -> "PronunciationEntry":
        """Return a minimal entry for words that completely fail lookup."""
        from app.schemas.pronunciation import PronunciationEntry
        return PronunciationEntry(
            word=word,
            ipa=word,
            phonemes=[],
            syllables=[],
        )


# Singleton — import this everywhere
pronunciation_service = PronunciationService()
