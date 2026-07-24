"""Articulatory feature database for ARPABET phonemes.

Single source of truth for phonetic attributes across 9 articulatory dimensions:
  - phone_type : "vowel" | "consonant" | "silence"
  - place      : "bilabial" | "labiodental" | "dental" | "alveolar" | "palatal" | "velar" | "glottal" | "none"
  - manner     : "plosive" | "fricative" | "affricate" | "nasal" | "approximant" | "lateral" | "none"
  - voicing    : "voiced" | "voiceless" | "none"
  - height     : "high" | "mid-high" | "mid" | "mid-low" | "low" | "none"
  - backness   : "front" | "central" | "back" | "none"
  - rounded    : bool
  - sonorant   : bool
  - continuant : bool

This module provides deterministic feature comparison helpers used by the
pronunciation comparator to identify specific articulatory errors.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Set

_STRESS_RE = re.compile(r"\d+$")


def _strip_stress(symbol: str) -> str:
    """Strip stress digit if present (e.g. 'AE1' -> 'AE')."""
    s = (symbol or "").strip().upper()
    return _STRESS_RE.sub("", s)


@dataclass(frozen=True)
class PhonemeFeatures:
    """Articulatory feature vector for a single phoneme."""

    phone_type: str        # "vowel", "consonant", "silence"
    place: str             # "bilabial", "labiodental", "dental", "alveolar", "palatal", "velar", "glottal", "none"
    manner: str            # "plosive", "fricative", "affricate", "nasal", "approximant", "lateral", "none"
    voicing: str           # "voiced", "voiceless", "none"
    height: str            # "high", "mid-high", "mid", "mid-low", "low", "none"
    backness: str          # "front", "central", "back", "none"
    rounded: bool
    sonorant: bool
    continuant: bool


# ---------------------------------------------------------------------------
# Default feature vector for unknown/silence phonemes
# ---------------------------------------------------------------------------

_DEFAULT_SILENCE_FEATURES = PhonemeFeatures(
    phone_type="silence",
    place="none",
    manner="none",
    voicing="none",
    height="none",
    backness="none",
    rounded=False,
    sonorant=False,
    continuant=False,
)

# ---------------------------------------------------------------------------
# Full ARPABET Articulatory Feature Database (39 phonemes + SIL/SP)
# ---------------------------------------------------------------------------

PHONEME_FEATURE_DB: Dict[str, PhonemeFeatures] = {
    # -----------------------------------------------------------------------
    # Vowels
    # -----------------------------------------------------------------------
    "AA": PhonemeFeatures("vowel", "none", "none", "voiced", "low", "back", False, True, True),
    "AE": PhonemeFeatures("vowel", "none", "none", "voiced", "low", "front", False, True, True),
    "AH": PhonemeFeatures("vowel", "none", "none", "voiced", "mid", "central", False, True, True),
    "AO": PhonemeFeatures("vowel", "none", "none", "voiced", "mid-low", "back", True, True, True),
    "AW": PhonemeFeatures("vowel", "none", "none", "voiced", "low", "central", True, True, True),  # diphthong low->high back
    "AY": PhonemeFeatures("vowel", "none", "none", "voiced", "low", "front", False, True, True),    # diphthong low->high front
    "EH": PhonemeFeatures("vowel", "none", "none", "voiced", "mid-low", "front", False, True, True),
    "ER": PhonemeFeatures("vowel", "none", "none", "voiced", "mid", "central", False, True, True),
    "EY": PhonemeFeatures("vowel", "none", "none", "voiced", "mid-high", "front", False, True, True),
    "IH": PhonemeFeatures("vowel", "none", "none", "voiced", "high", "front", False, True, True),
    "IY": PhonemeFeatures("vowel", "none", "none", "voiced", "high", "front", False, True, True),
    "OW": PhonemeFeatures("vowel", "none", "none", "voiced", "mid-high", "back", True, True, True),
    "OY": PhonemeFeatures("vowel", "none", "none", "voiced", "mid-low", "back", True, True, True),
    "UH": PhonemeFeatures("vowel", "none", "none", "voiced", "high", "back", True, True, True),
    "UW": PhonemeFeatures("vowel", "none", "none", "voiced", "high", "back", True, True, True),

    # -----------------------------------------------------------------------
    # Consonants - Plosives / Stops
    # -----------------------------------------------------------------------
    "P":  PhonemeFeatures("consonant", "bilabial", "plosive", "voiceless", "none", "none", False, False, False),
    "B":  PhonemeFeatures("consonant", "bilabial", "plosive", "voiced", "none", "none", False, False, False),
    "T":  PhonemeFeatures("consonant", "alveolar", "plosive", "voiceless", "none", "none", False, False, False),
    "D":  PhonemeFeatures("consonant", "alveolar", "plosive", "voiced", "none", "none", False, False, False),
    "K":  PhonemeFeatures("consonant", "velar", "plosive", "voiceless", "none", "none", False, False, False),
    "G":  PhonemeFeatures("consonant", "velar", "plosive", "voiced", "none", "none", False, False, False),

    # -----------------------------------------------------------------------
    # Consonants - Fricatives
    # -----------------------------------------------------------------------
    "F":  PhonemeFeatures("consonant", "labiodental", "fricative", "voiceless", "none", "none", False, False, True),
    "V":  PhonemeFeatures("consonant", "labiodental", "fricative", "voiced", "none", "none", False, False, True),
    "TH": PhonemeFeatures("consonant", "dental", "fricative", "voiceless", "none", "none", False, False, True),
    "DH": PhonemeFeatures("consonant", "dental", "fricative", "voiced", "none", "none", False, False, True),
    "S":  PhonemeFeatures("consonant", "alveolar", "fricative", "voiceless", "none", "none", False, False, True),
    "Z":  PhonemeFeatures("consonant", "alveolar", "fricative", "voiced", "none", "none", False, False, True),
    "SH": PhonemeFeatures("consonant", "palatal", "fricative", "voiceless", "none", "none", False, False, True),
    "ZH": PhonemeFeatures("consonant", "palatal", "fricative", "voiced", "none", "none", False, False, True),
    "HH": PhonemeFeatures("consonant", "glottal", "fricative", "voiceless", "none", "none", False, False, True),

    # -----------------------------------------------------------------------
    # Consonants - Affricates
    # -----------------------------------------------------------------------
    "CH": PhonemeFeatures("consonant", "palatal", "affricate", "voiceless", "none", "none", False, False, False),
    "JH": PhonemeFeatures("consonant", "palatal", "affricate", "voiced", "none", "none", False, False, False),

    # -----------------------------------------------------------------------
    # Consonants - Nasals
    # -----------------------------------------------------------------------
    "M":  PhonemeFeatures("consonant", "bilabial", "nasal", "voiced", "none", "none", False, True, False),
    "N":  PhonemeFeatures("consonant", "alveolar", "nasal", "voiced", "none", "none", False, True, False),
    "NG": PhonemeFeatures("consonant", "velar", "nasal", "voiced", "none", "none", False, True, False),

    # -----------------------------------------------------------------------
    # Consonants - Approximants / Liquids / Glides
    # -----------------------------------------------------------------------
    "L":  PhonemeFeatures("consonant", "alveolar", "lateral", "voiced", "none", "none", False, True, True),
    "R":  PhonemeFeatures("consonant", "alveolar", "approximant", "voiced", "none", "none", False, True, True),
    "W":  PhonemeFeatures("consonant", "bilabial", "approximant", "voiced", "none", "none", True, True, True),
    "Y":  PhonemeFeatures("consonant", "palatal", "approximant", "voiced", "none", "none", False, True, True),

    # -----------------------------------------------------------------------
    # Silence / Pause
    # -----------------------------------------------------------------------
    "SIL": _DEFAULT_SILENCE_FEATURES,
    "SP":  _DEFAULT_SILENCE_FEATURES,
}


def get_phoneme_features(symbol: str) -> PhonemeFeatures:
    """Retrieve PhonemeFeatures for a given ARPABET symbol.

    Strips stress digits if present (e.g. 'AE1' -> 'AE').
    Returns default silence features if the symbol is unknown.
    """
    clean_sym = _strip_stress(symbol)
    return PHONEME_FEATURE_DB.get(clean_sym, _DEFAULT_SILENCE_FEATURES)


def compare_phoneme_features(expected_symbol: str, actual_symbol: str) -> List[str]:
    """Compare two ARPABET phonemes and return a list of difference tags.

    Difference tags emitted:
      - "phone_type_mismatch" (vowel vs consonant vs silence)
      - "voicing_changed"
      - "place_of_articulation_changed"
      - "manner_of_articulation_changed"
      - "vowel_height_changed"
      - "vowel_backness_changed"
      - "rounding_changed"

    If the phonemes are identical, returns an empty list [].
    """
    exp_sym = _strip_stress(expected_symbol)
    act_sym = _strip_stress(actual_symbol)

    if exp_sym == act_sym:
        return []

    exp_feat = get_phoneme_features(exp_sym)
    act_feat = get_phoneme_features(act_sym)

    diffs: List[str] = []

    # 1. Type mismatch (vowel vs consonant)
    if exp_feat.phone_type != act_feat.phone_type:
        diffs.append("phone_type_mismatch")
        return diffs  # Structural difference is primary

    # 2. Voicing difference
    if exp_feat.voicing != act_feat.voicing and exp_feat.voicing != "none" and act_feat.voicing != "none":
        diffs.append("voicing_changed")

    # 3. Consonant articulatory differences
    if exp_feat.phone_type == "consonant":
        if exp_feat.place != act_feat.place and exp_feat.place != "none" and act_feat.place != "none":
            diffs.append("place_of_articulation_changed")
        if exp_feat.manner != act_feat.manner and exp_feat.manner != "none" and act_feat.manner != "none":
            diffs.append("manner_of_articulation_changed")

    # 4. Vowel articulatory differences
    elif exp_feat.phone_type == "vowel":
        if exp_feat.height != act_feat.height and exp_feat.height != "none" and act_feat.height != "none":
            diffs.append("vowel_height_changed")
        if exp_feat.backness != act_feat.backness and exp_feat.backness != "none" and act_feat.backness != "none":
            diffs.append("vowel_backness_changed")
        if exp_feat.rounded != act_feat.rounded:
            diffs.append("rounding_changed")

    return diffs
