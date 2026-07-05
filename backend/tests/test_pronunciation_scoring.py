"""Unit tests for the Phase-1 acoustic scoring core.

These cover the model-independent logic: articulatory distance, Needleman-Wunsch
alignment, GOP-style score aggregation, and graceful fallback. The wav2vec2
recognizer itself needs a downloaded model and is validated separately.
"""

import unittest

from app.services.pronunciation.alignment import align_phonemes
from app.services.pronunciation.phone_set import (
    ipa_to_arpabet,
    is_vowel,
    normalize_arpabet,
    phone_distance,
)
from app.services.pronunciation.scoring import score_alignment


class PhoneSetTests(unittest.TestCase):
    def test_normalize_strips_stress(self):
        self.assertEqual(normalize_arpabet("AH0"), "AH")
        self.assertEqual(normalize_arpabet("ih1"), "IH")

    def test_identical_distance_zero(self):
        self.assertEqual(phone_distance("TH", "TH"), 0.0)

    def test_near_miss_cheaper_than_far_miss(self):
        # TH->S (both voiceless fricatives) should cost less than TH->K.
        self.assertLess(phone_distance("TH", "S"), phone_distance("TH", "K"))

    def test_vowel_vs_consonant_maximal(self):
        self.assertEqual(phone_distance("IY", "K"), 1.0)

    def test_is_vowel(self):
        self.assertTrue(is_vowel("AA1"))
        self.assertFalse(is_vowel("T"))

    def test_ipa_to_arpabet_roundtrip(self):
        self.assertEqual(ipa_to_arpabet("θɪŋk"), ["TH", "IH", "NG", "K"])


class AlignmentTests(unittest.TestCase):
    def test_exact_match_all_equal(self):
        pairs = align_phonemes(["TH", "IH", "NG", "K"], ["TH", "IH", "NG", "K"])
        self.assertTrue(all(p.op == "equal" for p in pairs))

    def test_substitution_detected(self):
        # "think" said as "tink": TH -> T
        pairs = align_phonemes(["TH", "IH", "NG", "K"], ["T", "IH", "NG", "K"])
        subs = [p for p in pairs if p.op == "sub"]
        self.assertEqual(len(subs), 1)
        self.assertEqual(subs[0].expected, "TH")
        self.assertEqual(subs[0].actual, "T")

    def test_deletion_detected(self):
        pairs = align_phonemes(["K", "AE", "T"], ["K", "AE"])
        self.assertTrue(any(p.op == "delete" and p.expected == "T" for p in pairs))

    def test_insertion_detected(self):
        pairs = align_phonemes(["K", "AE", "T"], ["K", "AE", "T", "S"])
        self.assertTrue(any(p.op == "insert" and p.actual == "S" for p in pairs))

    def test_empty_inputs(self):
        self.assertEqual(align_phonemes([], []), [])


class ScoringTests(unittest.TestCase):
    def test_perfect_match_scores_100(self):
        pairs = align_phonemes(["TH", "IH", "NG", "K"], ["TH", "IH", "NG", "K"])
        result = score_alignment(pairs, use_confidence=False)
        self.assertEqual(result["score"], 100.0)
        self.assertEqual(result["errors"], [])

    def test_th_to_t_flagged_with_feedback(self):
        pairs = align_phonemes(["TH", "IH", "NG", "K"], ["T", "IH", "NG", "K"])
        result = score_alignment(pairs, use_confidence=False)
        self.assertLess(result["score"], 100.0)
        self.assertTrue(any(e["op"] == "replace" for e in result["errors"]))
        self.assertTrue(len(result["feedback"]) >= 1)
        # The substituted phone is reported in IPA.
        self.assertTrue(any(e["expected"] == "θ" for e in result["errors"]))

    def test_low_confidence_softens_penalty(self):
        pairs = align_phonemes(["TH", "IH"], ["S", "IH"])
        high = score_alignment(pairs, use_confidence=True, confidences=[1.0, 1.0])
        low = score_alignment(pairs, use_confidence=True, confidences=[0.1, 1.0])
        self.assertGreaterEqual(low["score"], high["score"])

    def test_per_phoneme_detail_shape(self):
        pairs = align_phonemes(["K", "AE", "T"], ["K", "AE", "T"])
        result = score_alignment(pairs, use_confidence=False)
        self.assertEqual(len(result["per_phoneme"]), 3)
        for d in result["per_phoneme"]:
            self.assertIn("expected", d)
            self.assertIn("accuracy", d)
            self.assertIn("is_correct", d)


class FallbackTests(unittest.TestCase):
    def test_acoustic_scorer_falls_back_without_audio(self):
        from app.services.pronunciation.acoustic_scorer import AcousticScorer

        scorer = AcousticScorer()
        result = scorer.score("hello", "hello", audio_pcm16=None)
        # Fallback path uses the text proxy and still returns a valid result.
        self.assertEqual(result.method, "text_proxy")
        self.assertIsInstance(result.score, float)

    def test_registry_default_is_text_proxy(self):
        # With acoustic scoring disabled (default), registry returns text proxy.
        from app.core.config import settings
        from app.services.pronunciation import registry

        if not settings.ENABLE_ACOUSTIC_SCORING:
            registry._scorer = None  # reset cache for a clean read
            self.assertEqual(registry.get_scorer().name, "text_proxy")


if __name__ == "__main__":
    unittest.main()
