"""PenaltyEngine — dedicated feature-driven score deduction engine.

Converts a ComparisonPhoneme (from Phase 3A) into an itemized penalty breakdown
dictionary.  No score deduction is magic or hidden.

Example outputs:
  - Match: {}
  - P -> B (voicing change): {"voicing_changed": 2.0}
  - P -> IY (phone type mismatch): {"phone_type_mismatch": 15.0}
  - Deletion: {"deletion": 20.0}
  - Insertion: {"insertion": 12.0}
"""

from __future__ import annotations

from typing import Dict

from app.core.scoring_config import (
    DELETION_PENALTY,
    FEATURE_PENALTY_WEIGHTS,
    INSERTION_PENALTY,
    UNMATCHED_SUBSTITUTION_PENALTY,
)
from app.schemas.comparison import ComparisonPhoneme


class PenaltyEngine:
    """Calculates explicit itemized score deductions for phoneme comparisons."""

    @staticmethod
    def calculate_penalties(phoneme: ComparisonPhoneme) -> Dict[str, float]:
        """Calculate itemized score deductions for a ComparisonPhoneme.

        Returns
        -------
        Dict[str, float]
            Dictionary mapping penalty tag names to numeric deduction values.
        """
        penalties: Dict[str, float] = {}

        if phoneme.operation == "match":
            return penalties

        if phoneme.operation == "deletion":
            penalties["deletion"] = DELETION_PENALTY
            return penalties

        if phoneme.operation == "insertion":
            penalties["insertion"] = INSERTION_PENALTY
            return penalties

        if phoneme.operation == "substitution":
            diffs = phoneme.articulatory_differences or []
            applied_any = False

            for diff_tag in diffs:
                if diff_tag in FEATURE_PENALTY_WEIGHTS:
                    penalties[diff_tag] = FEATURE_PENALTY_WEIGHTS[diff_tag]
                    applied_any = True

            if not applied_any:
                penalties["substitution_base"] = UNMATCHED_SUBSTITUTION_PENALTY

            return penalties

        return penalties


# Global singleton instance
penalty_engine = PenaltyEngine()
