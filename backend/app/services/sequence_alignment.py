"""Needleman–Wunsch global sequence alignment for ARPABET phoneme sequences.

Provides deterministic sequence alignment between expected phoneme sequences
(from PronunciationService) and actual phoneme sequences (from Forced Alignment).

Operations produced:
  - "match"        : expected phoneme matched actual phoneme
  - "substitution" : expected phoneme replaced by actual phoneme
  - "deletion"     : expected phoneme missing in actual speech
  - "insertion"    : extra phoneme spoken in actual speech not in expected

Scoring model
-------------
* Match: +2.0
* Substitution: computed dynamically based on articulatory feature similarity.
  Close phonemes (e.g. IH vs IY) receive a mild positive/low-penalty score (+0.8),
  while distant phonemes receive negative scores (down to -1.5).
* Gap penalty (deletion/insertion): -1.0
"""

from __future__ import annotations

import re
from typing import List, Literal, Optional, Tuple

from app.utils.phoneme_features import compare_phoneme_features

_STRESS_RE = re.compile(r"\d+$")

OperationType = Literal["match", "substitution", "deletion", "insertion"]
AlignedPair = Tuple[OperationType, Optional[str], Optional[str]]


def _strip_stress(symbol: str) -> str:
    s = (symbol or "").strip().upper()
    return _STRESS_RE.sub("", s)


def _substitution_score(exp_symbol: str, act_symbol: str) -> float:
    """Calculate similarity score between two ARPABET phonemes based on articulatory features.

    Identical: +2.0
    Type mismatch: -2.0
    Same type: +1.0 base, minus 0.6 per feature difference (min -1.5)
    """
    exp_clean = _strip_stress(exp_symbol)
    act_clean = _strip_stress(act_symbol)

    if exp_clean == act_clean:
        return 2.0

    diffs = compare_phoneme_features(exp_clean, act_clean)
    if "phone_type_mismatch" in diffs:
        return -2.0

    # Base score for same type with minor differences
    score = 1.0 - (0.6 * len(diffs))
    return max(-1.5, min(0.8, score))


GAP_PENALTY: float = -1.0


def align_phoneme_sequences(
    expected_phonemes: List[str],
    actual_phonemes: List[str],
) -> List[AlignedPair]:
    """Align expected vs actual ARPABET phoneme sequences using Needleman–Wunsch.

    Parameters
    ----------
    expected_phonemes : List[str]
        Ordered list of expected ARPABET phoneme symbols (e.g. ["N", "AE", "CH"]).
    actual_phonemes : List[str]
        Ordered list of actual ARPABET phoneme symbols spoken (e.g. ["N", "EH", "CH"]).

    Returns
    -------
    List[AlignedPair]
        Sequence of (operation, expected_phone, actual_phone) tuples in forward order.
    """
    # Clean inputs (strip stress digits for sequence matching)
    exp = [_strip_stress(p) for p in expected_phonemes if p and p.strip()]
    act = [_strip_stress(p) for p in actual_phonemes if p and p.strip()]

    n = len(exp)
    m = len(act)

    # Edge cases: empty sequences
    if n == 0 and m == 0:
        return []
    if n == 0:
        return [("insertion", None, a) for a in act]
    if m == 0:
        return [("deletion", e, None) for e in exp]

    # Initialize Needleman-Wunsch DP matrix
    # dp[i][j] stores max score to align exp[:i] and act[:j]
    dp: List[List[float]] = [[0.0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = i * GAP_PENALTY
    for j in range(1, m + 1):
        dp[0][j] = j * GAP_PENALTY

    # Fill DP matrix
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub_score = _substitution_score(exp[i - 1], act[j - 1])
            diag = dp[i - 1][j - 1] + sub_score
            up = dp[i - 1][j] + GAP_PENALTY        # deletion
            left = dp[i][j - 1] + GAP_PENALTY      # insertion
            dp[i][j] = max(diag, up, left)

    # Backtrack to reconstruct alignment
    i, j = n, m
    rev_alignment: List[AlignedPair] = []

    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sub_score = _substitution_score(exp[i - 1], act[j - 1])
            if abs(dp[i][j] - (dp[i - 1][j - 1] + sub_score)) < 1e-6:
                op: OperationType = "match" if exp[i - 1] == act[j - 1] else "substitution"
                rev_alignment.append((op, exp[i - 1], act[j - 1]))
                i -= 1
                j -= 1
                continue

        if i > 0 and abs(dp[i][j] - (dp[i - 1][j] + GAP_PENALTY)) < 1e-6:
            rev_alignment.append(("deletion", exp[i - 1], None))
            i -= 1
            continue

        if j > 0 and abs(dp[i][j] - (dp[i][j - 1] + GAP_PENALTY)) < 1e-6:
            rev_alignment.append(("insertion", None, act[j - 1]))
            j -= 1
            continue

        # Fallback safeguard if floating point comparisons mismatch
        if i > 0:
            rev_alignment.append(("deletion", exp[i - 1], None))
            i -= 1
        elif j > 0:
            rev_alignment.append(("insertion", None, act[j - 1]))
            j -= 1

    # Reverse to return forward chronological order
    rev_alignment.reverse()
    return rev_alignment
