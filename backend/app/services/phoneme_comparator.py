"""PhonemeComparator — pairwise phoneme comparison helper.

Compares an expected ARPABET symbol and an actual spoken ARPABET symbol for a given
sequence alignment operation ("match", "substitution", "deletion", "insertion").

Emits articulatory difference tags such as:
  - [] (for match)
  - ["phoneme_deleted"] (for deletion)
  - ["phoneme_inserted"] (for insertion)
  - ["voicing_changed", "place_of_articulation_changed"] (for substitution)
"""

from __future__ import annotations

from typing import List, Optional

from app.utils.phoneme_features import compare_phoneme_features


def compare_phoneme_pair(
    operation: str,
    expected_symbol: Optional[str],
    actual_symbol: Optional[str],
) -> List[str]:
    """Emit difference tags for an aligned phoneme pair.

    Parameters
    ----------
    operation : "match" | "substitution" | "deletion" | "insertion"
        Alignment operation from sequence alignment.
    expected_symbol : str | None
        Expected ARPABET symbol, or None if insertion.
    actual_symbol : str | None
        Actual spoken ARPABET symbol, or None if deletion.

    Returns
    -------
    List[str]
        List of difference tag strings.
    """
    if operation == "match":
        return []

    if operation == "deletion":
        return ["phoneme_deleted"]

    if operation == "insertion":
        return ["phoneme_inserted"]

    if operation == "substitution":
        if expected_symbol and actual_symbol:
            diffs = compare_phoneme_features(expected_symbol, actual_symbol)
            if diffs:
                return diffs
            return ["phoneme_substituted"]
        return ["phoneme_substituted"]

    return []
