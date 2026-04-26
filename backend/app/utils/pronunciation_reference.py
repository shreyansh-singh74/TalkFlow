"""User-facing pronunciation reference: ARPAbet syllables + display strings, aligned via pyphen."""

from __future__ import annotations

import re
from typing import Any, Dict, List

try:
    import pyphen
except ImportError:
    pyphen = None  # type: ignore

_STRESS = re.compile(r"(\d+)$")

_VOWEL_BASES = frozenset(
    {
        "AA",
        "AE",
        "AH",
        "AO",
        "AW",
        "AY",
        "EH",
        "ER",
        "EY",
        "IH",
        "IY",
        "OW",
        "OY",
        "UH",
        "UW",
    }
)

_ARPABET_TO_DISPLAY: dict[str, str] = {
    "AA": "a",
    "AE": "a",
    "AH": "uh",
    "AO": "aw",
    "AW": "ow",
    "AY": "ay",
    "B": "b",
    "CH": "ch",
    "D": "d",
    "DH": "th",
    "EH": "e",
    "ER": "er",
    "EY": "ay",
    "F": "f",
    "G": "g",
    "HH": "h",
    "IH": "i",
    "IY": "ee",
    "JH": "j",
    "K": "k",
    "L": "l",
    "M": "m",
    "N": "n",
    "NG": "ng",
    "OW": "oh",
    "OY": "oy",
    "P": "p",
    "R": "r",
    "S": "s",
    "SH": "sh",
    "T": "t",
    "TH": "th",
    "UH": "u",
    "UW": "oo",
    "V": "v",
    "W": "w",
    "Y": "y",
    "Z": "z",
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


def _mop_syllabify(tokens: List[str], vidx: List[int]) -> List[List[str]]:
    if not vidx:
        return [tokens] if tokens else [[]]
    syls: List[List[str]] = []
    n = len(vidx)
    for k, vi in enumerate(vidx):
        lo = 0 if k == 0 else vidx[k - 1] + 1
        syls.append(tokens[lo : vi + 1])
    if vidx and vidx[-1] < len(tokens) - 1:
        syls[-1] = syls[-1] + tokens[vidx[-1] + 1 :]
    return syls


def _allocate_phonemes(word: str, tokens: List[str]) -> List[List[str]]:
    w = re.sub(r"[^\w]", "", (word or "").lower())
    if not w or not tokens:
        return [tokens] if tokens else [[]]
    vidx = [i for i, t in enumerate(tokens) if _is_vowel_token(t)]
    if not vidx:
        return [tokens] if tokens else [[]]
    if pyphen is None:
        return _mop_syllabify(tokens, vidx)
    try:
        dic = pyphen.Pyphen(lang="en_US")
        hyph = dic.inserted(w)
    except Exception:
        return _mop_syllabify(tokens, vidx)
    if not hyph or "-" not in hyph:
        return _mop_syllabify(tokens, vidx)
    parts = [p for p in hyph.split("-") if p]
    if len(parts) <= 1:
        return _mop_syllabify(tokens, vidx)
    nchars = [max(1, len(p)) for p in parts]
    tot = sum(nchars)
    nph = len(tokens)
    raw = [max(1, int(round(n * nph / tot))) for n in nchars]
    while sum(raw) < nph:
        raw[raw.index(min(raw))] += 1
    while sum(raw) > nph and max(raw) > 1:
        i = raw.index(max(raw))
        raw[i] -= 1
    syls: List[List[str]] = []
    i = 0
    for r in raw:
        chunk = tokens[i : i + r]
        syls.append(chunk)
        i += r
    if i < nph and syls:
        syls[-1] = syls[-1] + tokens[i:]
    return [c for c in syls if c]


def build_syllable_rows(word: str, raw_tokens: List[str]) -> List[Dict[str, Any]]:
    tks: List[str] = []
    for t in raw_tokens:
        s = (t or "").strip()
        if not s or s == " ":
            continue
        tks.append(s)
    if not tks:
        return []
    chunks = _allocate_phonemes(word, tks)
    out: List[Dict[str, Any]] = []
    for ch in chunks:
        if not ch:
            continue
        stressed = any(_stressed_vowel(p) for p in ch)
        out.append(
            {
                "phones": " ".join(ch),
                "display": _phone_bits(ch),
                "stressed": stressed,
            }
        )
    return out
