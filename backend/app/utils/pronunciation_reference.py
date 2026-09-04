"""User-facing pronunciation reference: ARPAbet syllables + display strings.

Syllable boundaries come from :mod:`app.utils.syllabify` (Maximum Onset
Principle over the phone sequence).  They were previously derived from pyphen's
hyphenation of the *spelling*, which produced vowel-less syllables and misplaced
onsets — see that module's docstring for the worked examples.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from app.utils.syllabify import VOWEL_BASES as _VOWEL_BASES
from app.utils.syllabify import syllabify, syllable_stress

_STRESS = re.compile(r"(\d+)$")

_ARPABET_TO_DISPLAY: dict[str, str] = {
    "AA": "ah",    # father, spa  → 'ah' (not 'a' which reads like 'cat')
    "AE": "a",     # cat, hat     → 'a'
    "AH": "uh",   # about, sofa  → 'uh'
    "AO": "oh",   # more, for    → 'oh' (was 'aw' which gave 'mawr'/'fawr')
    "AW": "ow",   # how, cow     → 'ow'
    "AY": "ay",   # kite, like   → 'ay'
    "B":  "b",
    "CH": "ch",
    "D":  "d",
    "DH": "th",
    "EH": "e",    # bed, said    → 'e'
    "ER": "er",   # bird, word   → 'er'
    "EY": "ay",   # face, say    → 'ay'
    "F":  "f",
    "G":  "g",
    "HH": "h",
    "IH": "i",    # kit, bit     → 'i'
    "IY": "ee",   # see, tea     → 'ee'
    "JH": "j",
    "K":  "k",
    "L":  "l",
    "M":  "m",
    "N":  "n",
    "NG": "ng",
    "OW": "oh",   # goat, show   → 'oh'
    "OY": "oy",   # boy, coin    → 'oy'
    "P":  "p",
    "R":  "r",
    "S":  "s",
    "SH": "sh",
    "T":  "t",
    "TH": "th",
    "UH": "u",    # book, put    → 'u'
    "UW": "oo",   # food, blue   → 'oo'
    "V":  "v",
    "W":  "w",
    "Y":  "y",
    "Z":  "z",
    "ZH": "zh",
    "SIL": "",
}


def _base_phone(token: str) -> str:
    t = (token or "").strip().upper()
    if not t or not t[0].isalnum():
        return ""
    return re.sub(r"\d+$", "", t)


def _is_vowel_token(token: str) -> bool:
    b = _base_phone(token)
    return b in _VOWEL_BASES or b == "ER"


def _stressed_vowel(token: str) -> bool:
    m = _STRESS.search((token or "").strip())
    if not m or not _is_vowel_token(token):
        return False
    return m.group(1) in ("1", "2")


def _phone_bits(phones: List[str]) -> str:
    out: List[str] = []
    for p in phones:
        b = _base_phone(p)
        bit = _ARPABET_TO_DISPLAY.get(b) or (b.lower() if b else "")
        if bit:
            out.append(bit)
    s = "".join(out)
    return s[:32] if s else "·"


def allocate_phoneme_indices(tokens: List[str]) -> List[List[int]]:
    """Group token indices into syllables. Public wrapper over :func:`syllabify`.

    Callers that need to know which syllable a given phoneme belongs to (the
    mouth-shape animation, the active-syllable highlight) use this rather than
    re-deriving the grouping from the display strings.
    """
    return syllabify(tokens)


def _allocate_phonemes(word: str, tokens: List[str]) -> List[List[str]]:
    """Group ``tokens`` into syllables.

    ``word`` is unused: syllabification is driven entirely by the phone
    sequence.  The parameter is retained because callers pass it positionally.
    """
    if not tokens:
        return [[]]
    return [[tokens[i] for i in group] for group in syllabify(tokens)]


def build_syllable_rows(word: str, raw_tokens: List[str]) -> List[Dict[str, Any]]:
    tks: List[str] = []
    for t in raw_tokens:
        s = (t or "").strip()
        if not s or s == " ":
            continue
        tks.append(s)
    if not tks:
        return []
    out: List[Dict[str, Any]] = []
    for group in syllabify(tks):
        if not group:
            continue
        phones = [tks[i] for i in group]
        stress = syllable_stress(tks, group)
        out.append(
            {
                "phones": " ".join(phones),
                "display": _phone_bits(phones),
                # Primary stress only, so a word carrying both primary and
                # secondary stress highlights exactly one syllable.
                "stressed": stress == 1,
                "stress_level": stress,
            }
        )
    return out
