"""Phonological syllabification of ARPABET phone sequences.

Why this module exists
----------------------
The previous implementation (``pronunciation_reference._allocate_phonemes``)
hyphenated the word's *spelling* with pyphen and then cut the *phoneme* list at
character-proportional offsets.  Orthographic syllables are not phonological
syllables, and a proportional cut is subject to no phonological constraint at
all, so the output was routinely wrong in ways a learner can see:

    circumstances  S ER K AH M S T AE N S AH Z
        was  ->  serk | uhms | tansuhz          (3 syllables, K in the wrong one)
        now  ->  ser | kuhm | stan | suhz       (4, matches the dictionary)

    naturally      N AE CH ER AH L IY
        was  ->  na | ch | eruh | lee           ('ch' has no vowel in it)
        now  ->  na | cher | uh | lee

    particularly   P AA R T IH K Y AH L ER L IY
        was  ->  pahr | tik | y | uhler | lee   ('y' has no vowel in it)
        now  ->  pahr | ti | kyuh | ler | lee

This module implements the standard **Maximum Onset Principle** (MOP) instead:
every syllable is built around exactly one vowel nucleus, and each intervocalic
consonant cluster is divided so that the following syllable takes the longest
onset that is phonotactically legal in English; whatever is left becomes the
preceding syllable's coda.

Two properties follow by construction and are what the old code lacked:

* every syllable contains exactly one nucleus, so a vowel-less syllable is
  impossible;
* the syllable count equals the vowel count, which is the count a dictionary
  reports.

The output is a partition of *token indices* rather than of the tokens
themselves, so callers can map each phoneme back to the syllable it belongs to
(see ``PhonemeEntry.syllable_index``) instead of re-deriving the grouping.
"""

from __future__ import annotations

import re
from typing import List, Sequence

__all__ = [
    "VOWEL_BASES",
    "base_phone",
    "is_vowel",
    "syllabify",
    "syllable_stress",
]

_STRESS_DIGITS = re.compile(r"\d+$")

#: ARPABET vowel bases.  ``ER`` is included: it is a syllabic r-coloured vowel
#: and heads its own syllable ("bird" = B ER D, one syllable).
VOWEL_BASES = frozenset(
    {
        "AA", "AE", "AH", "AO", "AW", "AY",
        "EH", "ER", "EY",
        "IH", "IY",
        "OW", "OY",
        "UH", "UW",
    }
)

#: Consonants that never begin an English syllable.
_ILLEGAL_SINGLE_ONSETS = frozenset({"NG"})

#: Legal English onset clusters of two or more consonants.
#:
#: Drawn from the standard descriptions of English phonotactics.  Deliberately
#: conservative: a cluster wrongly listed here steals a consonant that belongs
#: to the previous syllable's coda, which is exactly the class of error this
#: module exists to remove.  Marginal loanword onsets (SHM- in "schmuck",
#: SV- in "svelte") are omitted for that reason.
_LEGAL_CLUSTER_ONSETS = frozenset(
    {
        # stop + /r/
        ("P", "R"), ("B", "R"), ("T", "R"), ("D", "R"), ("K", "R"), ("G", "R"),
        # stop + /l/  (no *TL-, *DL-)
        ("P", "L"), ("B", "L"), ("K", "L"), ("G", "L"),
        # fricative + liquid
        ("F", "R"), ("F", "L"), ("TH", "R"), ("SH", "R"),
        # /s/ + voiceless stop
        ("S", "P"), ("S", "T"), ("S", "K"),
        # /s/ + nasal / fricative / liquid / glide
        ("S", "M"), ("S", "N"), ("S", "F"), ("S", "L"), ("S", "W"),
        # consonant + /w/
        ("T", "W"), ("D", "W"), ("K", "W"), ("G", "W"), ("TH", "W"),
        # consonant + /j/  ("pure", "beauty", "cute", "few", "music", "huge")
        ("P", "Y"), ("B", "Y"), ("T", "Y"), ("D", "Y"), ("K", "Y"), ("G", "Y"),
        ("F", "Y"), ("V", "Y"), ("M", "Y"), ("N", "Y"), ("L", "Y"), ("S", "Y"),
        ("HH", "Y"),
        # /s/ + voiceless stop + liquid / glide
        ("S", "P", "L"), ("S", "P", "R"), ("S", "T", "R"),
        ("S", "K", "R"), ("S", "K", "W"),
        ("S", "P", "Y"), ("S", "T", "Y"), ("S", "K", "Y"),
    }
)


def base_phone(token: str) -> str:
    """Strip the ARPABET stress digit and upper-case (``"ah0"`` -> ``"AH"``).

    Returns ``""`` for punctuation and separator tokens, which callers treat as
    "not a phone".
    """
    t = (token or "").strip().upper()
    if not t or not t[0].isalnum():
        return ""
    return _STRESS_DIGITS.sub("", t)


def is_vowel(token: str) -> bool:
    """True if ``token`` is an ARPABET vowel (a possible syllable nucleus)."""
    return base_phone(token) in VOWEL_BASES


def _is_legal_onset(cluster: Sequence[str]) -> bool:
    """True if ``cluster`` (a sequence of ARPABET bases) can begin a syllable."""
    n = len(cluster)
    if n == 0:
        return True  # an onsetless syllable is legal ("a-orta")
    if n == 1:
        return cluster[0] not in _ILLEGAL_SINGLE_ONSETS
    return tuple(cluster) in _LEGAL_CLUSTER_ONSETS


def _split_cluster(bases: Sequence[str]) -> int:
    """Return how many of ``bases`` start the *following* syllable.

    Maximum Onset Principle: prefer the longest legal onset, so
    ``["M", "S", "T"]`` (circu**mst**ances) yields 2 — ``ST`` is a legal onset,
    ``MST`` is not — leaving ``M`` as the preceding syllable's coda.
    """
    for take in range(len(bases), -1, -1):
        if _is_legal_onset(bases[len(bases) - take :] if take else ()):
            return take
    return 0


def syllabify(tokens: Sequence[str]) -> List[List[int]]:
    """Partition ARPABET token indices into syllables.

    ``tokens`` is a sequence of raw ARPABET tokens, with or without stress
    digits (``["S", "ER1", "K", "AH0", ...]``).  Returns one list of indices
    into ``tokens`` per syllable, in order; the lists are contiguous,
    non-overlapping, and together cover every index.

    A token sequence with no vowel (``"hmm"``, a stray consonant) cannot be
    syllabified and is returned as a single group, so the result is never empty
    for non-empty input.
    """
    n = len(tokens)
    if n == 0:
        return []

    nuclei = [i for i, t in enumerate(tokens) if is_vowel(t)]
    if not nuclei:
        return [list(range(n))]

    bases = [base_phone(t) for t in tokens]

    # Each syllable starts at the previous nucleus + 1 by default; the loop
    # below moves that boundary left to hand the next syllable its onset.
    starts = [0]
    for prev_nucleus, next_nucleus in zip(nuclei, nuclei[1:]):
        cluster_lo, cluster_hi = prev_nucleus + 1, next_nucleus
        onset_len = _split_cluster(bases[cluster_lo:cluster_hi])
        starts.append(cluster_hi - onset_len)

    groups: List[List[int]] = []
    for k, start in enumerate(starts):
        end = starts[k + 1] if k + 1 < len(starts) else n
        groups.append(list(range(start, end)))
    return groups


def syllable_stress(tokens: Sequence[str], indices: Sequence[int]) -> int:
    """Return the stress level of a syllable: 1 primary, 2 secondary, 0 none.

    Read off the nucleus's ARPABET stress digit.  Primary wins over secondary
    so that a word with both (``particularly`` = P AA2 R T IH1 K ...) reports
    exactly one primary-stressed syllable, rather than marking every stressed
    vowel identically the way ``bool(stress)`` did.
    """
    level = 0
    for i in indices:
        if i < 0 or i >= len(tokens) or not is_vowel(tokens[i]):
            continue
        m = _STRESS_DIGITS.search((tokens[i] or "").strip())
        if not m:
            continue
        digit = m.group(0)
        if digit == "1":
            return 1
        if digit == "2":
            level = 2
    return level
