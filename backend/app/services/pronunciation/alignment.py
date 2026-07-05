"""Needleman-Wunsch phoneme alignment with articulatory substitution cost.

Unlike difflib's LCS (which only finds exact matches), this produces a true
position-by-position alignment with substitution / insertion / deletion labels
and *partial credit* for near-misses. The alignment labels ARE the
mispronunciation diagnosis.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from app.services.pronunciation.phone_set import phone_distance

GAP_COST = 1.0  # cost of an insertion or deletion


@dataclass
class AlignedPair:
    op: str  # "equal" | "sub" | "delete" (missing) | "insert" (extra)
    expected: Optional[str]  # canonical phone (None for insertions)
    actual: Optional[str]  # recognized phone (None for deletions)
    distance: float  # 0..1 articulatory distance (0 for exact match)


def align_phonemes(expected: List[str], actual: List[str]) -> List[AlignedPair]:
    """Global alignment of two phone sequences (ARPAbet, stress already stripped)."""
    n, m = len(expected), len(actual)
    if n == 0 and m == 0:
        return []

    # DP cost matrix + backpointers.
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = i * GAP_COST
    for j in range(1, m + 1):
        dp[0][j] = j * GAP_COST

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sub = dp[i - 1][j - 1] + phone_distance(expected[i - 1], actual[j - 1])
            delete = dp[i - 1][j] + GAP_COST  # expected phone missing from actual
            insert = dp[i][j - 1] + GAP_COST  # extra phone in actual
            dp[i][j] = min(sub, delete, insert)

    # Traceback.
    pairs: List[AlignedPair] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            d = phone_distance(expected[i - 1], actual[j - 1])
            if abs(dp[i][j] - (dp[i - 1][j - 1] + d)) < 1e-9:
                op = "equal" if d == 0.0 else "sub"
                pairs.append(AlignedPair(op, expected[i - 1], actual[j - 1], d))
                i -= 1
                j -= 1
                continue
        if i > 0 and abs(dp[i][j] - (dp[i - 1][j] + GAP_COST)) < 1e-9:
            pairs.append(AlignedPair("delete", expected[i - 1], None, 1.0))
            i -= 1
            continue
        pairs.append(AlignedPair("insert", None, actual[j - 1], 1.0))
        j -= 1

    pairs.reverse()
    return pairs
