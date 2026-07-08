"""Turn a phoneme alignment into a GOP-style score + coaching feedback.

Score model: each expected phone earns credit = (1 - articulatory_distance),
optionally weighted by the recognizer's confidence on the matched phone so
low-confidence acoustic guesses don't produce harsh false errors. Insertions
(extra sounds) apply a mild penalty. The result is intelligibility-leaning, not
nativeness-harsh, per the product's scoring philosophy.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services.pronunciation.alignment import AlignedPair
from app.services.pronunciation.phone_set import ARPABET_TO_IPA

# Reuse the existing IPA tips so coaching language stays consistent.
from app.services.phoneme_analysis_service import CONFUSION_TIPS, IPA_FEEDBACK_MAP

# A phone counts as "correct" when its articulatory distance is at/under this.
# All three are env-overridable (see config.py) so they can be tuned against the
# L2-ARCTIC/speechocean762 eval set without a redeploy.
CORRECT_DISTANCE_THRESHOLD = settings.CORRECT_DISTANCE_THRESHOLD
INSERTION_PENALTY = settings.INSERTION_PENALTY  # per extra phone
SOFTEN_ON_UNCERTAINTY = settings.SOFTEN_ON_UNCERTAINTY


def _ipa(phone: Optional[str]) -> str:
    if not phone:
        return ""
    return ARPABET_TO_IPA.get(phone, phone.lower())


def _feedback_for(expected: str, actual: Optional[str]) -> Optional[str]:
    exp_ipa = _ipa(expected)
    act_ipa = _ipa(actual)
    tip = CONFUSION_TIPS.get((exp_ipa, act_ipa))
    if tip:
        return tip
    entry = IPA_FEEDBACK_MAP.get(exp_ipa)
    if entry:
        return entry["tip"]
    if actual:
        return f"Expected /{exp_ipa}/ but it sounded like /{act_ipa}/."
    return f"The /{exp_ipa}/ sound was missing."


def score_alignment(
    pairs: List[AlignedPair],
    use_confidence: bool = True,
    confidences: Optional[List[float]] = None,
) -> Dict[str, Any]:
    """Aggregate aligned pairs into score (0..100), per-phoneme detail, errors, feedback.

    ``confidences`` (parallel to ``pairs``, optional) lets a matched phone's credit
    be down-weighted when the recognizer was unsure.
    """
    expected_total = 0.0
    earned = 0.0
    per_phoneme: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []
    feedback: List[str] = []
    seen_feedback: set = set()
    insertions = 0

    for idx, p in enumerate(pairs):
        if p.op == "insert":
            insertions += 1
            errors.append({"op": "insert", "expected": "", "actual": _ipa(p.actual)})
            continue

        # expected phone present (equal / sub / delete)
        expected_total += 1.0
        conf = 1.0
        if use_confidence and confidences and idx < len(confidences):
            conf = max(0.0, min(1.0, confidences[idx]))

        if p.op == "delete":
            credit = 0.0
            is_correct = False
        else:
            base = 1.0 - p.distance
            # When the recognizer is unsure (low conf), give benefit of the doubt:
            # blend the earned credit toward full credit so we don't penalize the
            # learner for the model's own uncertainty.
            if use_confidence:
                credit = base + (1.0 - base) * (1.0 - conf) * SOFTEN_ON_UNCERTAINTY
            else:
                credit = base
            credit = max(0.0, min(1.0, credit))
            is_correct = p.distance <= CORRECT_DISTANCE_THRESHOLD

        earned += credit

        detail = {
            "expected": _ipa(p.expected),
            "actual": _ipa(p.actual) if p.actual else "",
            "accuracy": round(credit * 100.0, 1),
            "is_correct": is_correct,
            "distance": round(p.distance, 3),
            "confidence": round(conf, 3),
        }
        per_phoneme.append(detail)

        if not is_correct:
            errors.append(
                {
                    "op": "delete" if p.op == "delete" else "replace",
                    "expected": _ipa(p.expected),
                    "actual": _ipa(p.actual) if p.actual else "",
                }
            )
            fb = _feedback_for(p.expected or "", p.actual)
            if fb and fb not in seen_feedback:
                seen_feedback.add(fb)
                feedback.append(fb)

    if expected_total <= 0:
        score = 0.0
    else:
        penalty = INSERTION_PENALTY * insertions
        raw = (earned - penalty) / expected_total
        score = round(max(0.0, min(1.0, raw)) * 100.0, 2)

    if not feedback:
        feedback = ["Clear pronunciation — nicely done!"] if score >= 85 else []

    return {
        "score": score,
        "per_phoneme": per_phoneme,
        "errors": errors,
        "feedback": feedback[:3],
    }
