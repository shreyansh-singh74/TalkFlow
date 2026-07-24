"""ARPABET phoneme metadata tables.

Single source of truth for:
  - ARPABET_TO_IPA   : all 39 ARPABET bases → IPA symbol
  - VISEME_ID_MAP    : all 39 ARPABET bases → viseme integer ID (0–9)
  - arpabet_to_ipa() : derive an IPA string from a list of PhonemeEntry objects

Design notes
------------
* ARPABET (from CMUDict) is the canonical representation throughout TalkFlow.
* IPA is always **derived** — never stored, never the source of truth.
* viseme_id is an integer so the animation layer can map it to any target
  system (Rive, Oculus LipSync, Azure Speech, Lottie, 3D avatar) without
  touching the API.

Viseme groups (0–9)
-------------------
 0  closed_lips      — B P M SIL
 1  teeth_lip        — F V
 2  tongue_tip       — D T L N
 3  tongue_back      — K G NG
 4  teeth_gap        — S Z SH ZH CH JH TH DH
 5  open             — AE EH AY AW
 6  neutral_schwa    — AH UH HH
 7  spread_lips      — IY IH EY W Y
 8  rounded_lips     — UW OW OY AO
 9  r_colored        — ER R
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.schemas.pronunciation import PhonemeEntry

# ---------------------------------------------------------------------------
# ARPABET → IPA
# ---------------------------------------------------------------------------

ARPABET_TO_IPA: dict[str, str] = {
    # Vowels
    "AA": "ɑ",
    "AE": "æ",
    "AH": "ə",   # unstressed; stressed AH → "ʌ" handled in arpabet_to_ipa()
    "AO": "ɔ",
    "AW": "aʊ",
    "AY": "aɪ",
    "EH": "ɛ",
    "ER": "ɝ",   # stressed r-colored; unstressed → "ɚ"
    "EY": "eɪ",
    "IH": "ɪ",
    "IY": "iː",
    "OW": "oʊ",
    "OY": "ɔɪ",
    "UH": "ʊ",
    "UW": "uː",
    # Consonants
    "B":  "b",
    "CH": "tʃ",
    "D":  "d",
    "DH": "ð",
    "F":  "f",
    "G":  "ɡ",
    "HH": "h",
    "JH": "dʒ",
    "K":  "k",
    "L":  "l",
    "M":  "m",
    "N":  "n",
    "NG": "ŋ",
    "P":  "p",
    "R":  "ɹ",
    "S":  "s",
    "SH": "ʃ",
    "T":  "t",
    "TH": "θ",
    "V":  "v",
    "W":  "w",
    "Y":  "j",
    "Z":  "z",
    "ZH": "ʒ",
    # Silence / punctuation tokens
    "SIL": "",
    "SP":  "",
}

# ---------------------------------------------------------------------------
# ARPABET → Viseme ID
# ---------------------------------------------------------------------------

VISEME_ID_MAP: dict[str, int] = {
    # 0 — Closed lips
    "P": 0, "B": 0, "M": 0, "SIL": 0, "SP": 0,

    # 1 — Teeth + lower lip
    "F": 1, "V": 1,

    # 2 — Tongue tip (alveolar stops / lateral / nasal)
    "D": 2, "T": 2, "L": 2, "N": 2,

    # 3 — Tongue back (velar)
    "K": 3, "G": 3, "NG": 3,

    # 4 — Teeth gap (sibilants + affricates + dental fricatives)
    "S": 4, "Z": 4, "SH": 4, "ZH": 4, "CH": 4, "JH": 4, "TH": 4, "DH": 4,

    # 5 — Open mouth (front/low vowels)
    "AE": 5, "EH": 5, "AY": 5, "AW": 5, "AA": 5, "AO": 5,

    # 6 — Neutral / schwa
    "AH": 6, "UH": 6, "HH": 6,

    # 7 — Spread lips (front vowels + approximants)
    "IY": 7, "IH": 7, "EY": 7, "W": 7, "Y": 7,

    # 8 — Rounded lips
    "UW": 8, "OW": 8, "OY": 8,

    # 9 — R-colored
    "ER": 9, "R": 9,
}

VISEME_DEFAULT: int = 0  # fallback for unknown phonemes

_STRESS_RE = re.compile(r"\d+$")


def _strip_stress(token: str) -> tuple[str, int]:
    """Parse 'AE1' → ('AE', 1).  Returns stress=0 if no digit."""
    t = token.strip().upper()
    m = _STRESS_RE.search(t)
    if m:
        return t[: m.start()], int(m.group())
    return t, 0


def arpabet_to_ipa(phonemes: "List[PhonemeEntry]") -> str:
    """Derive an IPA string from a list of PhonemeEntry objects.

    Stress diacritics are prepended to the **syllable** containing the
    stressed vowel.  Since PhonemeEntry only has phone-level data (not
    syllable-level boundaries) we approximate by prepending the diacritic
    immediately before the stressed vowel's IPA symbol.

    This function is called only at API response serialization time.
    The result is never stored or cached.
    """
    parts: list[str] = []
    for ph in phonemes:
        sym = ph.symbol.upper()
        ipa_sym = ARPABET_TO_IPA.get(sym, sym.lower())
        if not ipa_sym:
            continue
        # Stressed AH → ʌ (not ə)
        if sym == "AH" and ph.stress in (1, 2):
            ipa_sym = "ʌ"
        # Unstressed ER → ɚ
        if sym == "ER" and ph.stress == 0:
            ipa_sym = "ɚ"
        if ph.stress == 1:
            parts.append("ˈ" + ipa_sym)
        elif ph.stress == 2:
            parts.append("ˌ" + ipa_sym)
        else:
            parts.append(ipa_sym)
    return "".join(parts)
