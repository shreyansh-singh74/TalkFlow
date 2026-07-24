"""Centralized scoring configuration for Phase 3B Pronunciation Scoring Engine.

All scoring rules, feature penalty weights, component weights, and thresholds
are defined here.  No magic numbers exist in scoring services.

Design Principles
-----------------
1. Base scores start at 100.0.
2. Substitutions are scored purely based on feature-driven deductions:
   - P -> B (voicing change only)    => deduction -2.0  => score 98.0
   - P -> IY (phone type mismatch)  => deduction -15.0 => score 85.0
3. Deletions and insertions carry structural penalties:
   - Deletion => deduction -20.0
   - Insertion => deduction -12.0
4. Component weights determine overall word and sentence aggregations.
5. All scores are bounded strictly within [0.0, 100.0].
"""

from __future__ import annotations

from typing import Dict

# Phoneme Maximum Base Score
PHONEME_MAX_SCORE: float = 100.0

# Structural Operation Penalties
DELETION_PENALTY: float = 20.0
INSERTION_PENALTY: float = 12.0
UNMATCHED_SUBSTITUTION_PENALTY: float = 15.0

# Articulatory Feature Penalty Deductions (Deducted from 100.0)
FEATURE_PENALTY_WEIGHTS: Dict[str, float] = {
    "phone_type_mismatch": 15.0,
    "place_of_articulation_changed": 5.0,
    "manner_of_articulation_changed": 5.0,
    "vowel_height_changed": 4.0,
    "vowel_backness_changed": 4.0,
    "rounding_changed": 3.0,
    "voicing_changed": 2.0,
}

# Weights for Phoneme Final Score Calculation
PRONUNCIATION_WEIGHT: float = 0.85
CONFIDENCE_WEIGHT: float = 0.15

# Sentence Level Aggregation Weights
SENTENCE_PRONUNCIATION_WEIGHT: float = 0.70
SENTENCE_COMPLETENESS_WEIGHT: float = 0.30
