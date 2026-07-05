"""ARPAbet phone inventory, IPA mapping, and an articulatory-feature distance.

Comparison happens in ARPAbet space because the canonical reference comes from
``g2p_en`` (ARPAbet). Acoustic recognizers emit IPA, so ``ipa_to_arpabet`` maps
their output back into the same space for alignment.

The feature distance gives *partial credit*: substituting θ→s (both voiceless
fricatives) costs far less than θ→k, which matches how a coach would grade it.
"""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

_STRESS_RE = re.compile(r"\d+$")

# Canonical ARPAbet (stress stripped) -> IPA.
ARPABET_TO_IPA: Dict[str, str] = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "ɛ", "ER": "ɝ",
    "EY": "eɪ", "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "i",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ",
    "OW": "oʊ", "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "u", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}

# IPA -> ARPAbet. Longest IPA strings first so multi-char symbols match greedily.
_IPA_TO_ARPABET_RAW: Dict[str, str] = {ipa: arp for arp, ipa in ARPABET_TO_IPA.items()}
# Common espeak/recognizer variants mapped onto the canonical inventory.
_IPA_TO_ARPABET_RAW.update({
    "ɹ": "R", "r": "R", "ɾ": "T", "g": "G", "a": "AA", "ə": "AH",
    "ɐ": "AH", "ɜ": "ER", "ɚ": "ER", "ɡ": "G", "e": "EY", "o": "OW",
    "ʔ": "T", "x": "K", "ç": "HH", "ɫ": "L",
})
_IPA_KEYS_BY_LEN: List[str] = sorted(_IPA_TO_ARPABET_RAW, key=len, reverse=True)

VOWELS = {
    "AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY",
    "IH", "IY", "OW", "OY", "UH", "UW",
}

# (manner, place, voiced) for consonants used by the feature distance.
_MANNER: Dict[str, str] = {
    "B": "stop", "P": "stop", "D": "stop", "T": "stop", "G": "stop", "K": "stop",
    "CH": "affricate", "JH": "affricate",
    "F": "fric", "V": "fric", "TH": "fric", "DH": "fric", "S": "fric",
    "Z": "fric", "SH": "fric", "ZH": "fric", "HH": "fric",
    "M": "nasal", "N": "nasal", "NG": "nasal",
    "L": "liquid", "R": "liquid",
    "W": "glide", "Y": "glide",
}
_PLACE: Dict[str, str] = {
    "B": "bilabial", "P": "bilabial", "M": "bilabial", "W": "bilabial",
    "F": "labiodental", "V": "labiodental",
    "TH": "dental", "DH": "dental",
    "D": "alveolar", "T": "alveolar", "S": "alveolar", "Z": "alveolar",
    "N": "alveolar", "L": "alveolar", "R": "alveolar",
    "SH": "postalveolar", "ZH": "postalveolar", "CH": "postalveolar",
    "JH": "postalveolar", "Y": "palatal",
    "G": "velar", "K": "velar", "NG": "velar",
    "HH": "glottal",
}
_VOICED = {"B", "D", "G", "V", "DH", "Z", "ZH", "JH", "M", "N", "NG", "L", "R", "W", "Y"}

# Rough vowel coordinates (frontness, height) in [0,1] for vowel-vowel distance.
_VOWEL_COORDS: Dict[str, Tuple[float, float]] = {
    "IY": (1.0, 1.0), "IH": (0.85, 0.8), "EH": (0.8, 0.55), "AE": (0.75, 0.2),
    "AH": (0.5, 0.5), "ER": (0.5, 0.55), "AA": (0.25, 0.0), "AO": (0.2, 0.3),
    "UH": (0.2, 0.8), "UW": (0.1, 1.0), "OW": (0.2, 0.6),
    "AW": (0.4, 0.4), "AY": (0.5, 0.4), "OY": (0.35, 0.5), "EY": (0.7, 0.7),
}


def normalize_arpabet(token: str) -> str:
    """Strip ARPAbet stress digits and upper-case (e.g. 'ah0' -> 'AH')."""
    return _STRESS_RE.sub("", (token or "").strip()).upper()


def is_vowel(phone: str) -> bool:
    return normalize_arpabet(phone) in VOWELS


def ipa_to_arpabet(ipa: str) -> List[str]:
    """Greedily segment an IPA string into ARPAbet phones (best effort)."""
    out: List[str] = []
    i = 0
    s = (ipa or "").strip()
    while i < len(s):
        ch = s[i]
        if ch in (" ", "\t", "ˈ", "ˌ", "ː", "."):
            i += 1
            continue
        matched = False
        for key in _IPA_KEYS_BY_LEN:
            if s.startswith(key, i):
                out.append(_IPA_TO_ARPABET_RAW[key])
                i += len(key)
                matched = True
                break
        if not matched:
            i += 1  # drop unknown symbol
    return out


def phone_distance(a: str, b: str) -> float:
    """Articulatory distance in [0, 1]. 0 == identical, 1 == maximally different."""
    a = normalize_arpabet(a)
    b = normalize_arpabet(b)
    if a == b:
        return 0.0

    a_vowel, b_vowel = a in VOWELS, b in VOWELS
    if a_vowel != b_vowel:
        return 1.0  # vowel vs consonant: maximally different

    if a_vowel and b_vowel:
        ca = _VOWEL_COORDS.get(a)
        cb = _VOWEL_COORDS.get(b)
        if ca is None or cb is None:
            return 0.6
        d = ((ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2) ** 0.5
        return min(1.0, d / (2 ** 0.5))

    # both consonants
    score = 0.0
    if _MANNER.get(a) != _MANNER.get(b):
        score += 0.5
    if _PLACE.get(a) != _PLACE.get(b):
        score += 0.35
    if (a in _VOICED) != (b in _VOICED):
        score += 0.15
    return min(1.0, score)
