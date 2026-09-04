"""Unit tests for the Phase-1 acoustic scoring core.

These cover the model-independent logic: articulatory distance, Needleman-Wunsch
alignment, GOP-style score aggregation, and graceful fallback. The phoneme
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

    def test_affricates_in_every_notation(self):
        """Recognizer vocabs spell CH/JH three different ways; all must map.

        The default checkpoint emits the precomposed U+02A7/U+02A4 forms. Before
        these were mapped, ipa_to_arpabet dropped them as unknown symbols, so
        every CH/JH in the reference silently read as a deletion.
        """
        for ch_form in ("tʃ", "ʧ", "t͡ʃ"):
            with self.subTest(form=ch_form):
                self.assertEqual(ipa_to_arpabet(ch_form), ["CH"])
        for jh_form in ("dʒ", "ʤ", "d͡ʒ"):
            with self.subTest(form=jh_form):
                self.assertEqual(ipa_to_arpabet(jh_form), ["JH"])

    def test_diacritics_carry_no_phone(self):
        """Stress, length, and a bare tie bar must not produce phones."""
        self.assertEqual(ipa_to_arpabet("ˈˌː.͡ "), [])
        # Stress/length around a real phone leave the phone intact.
        self.assertEqual(ipa_to_arpabet("ˈtiː"), ["T", "IY"])

    def test_default_phoneme_vocab_maps_completely(self):
        """Every phone token in the configured checkpoint's vocab must resolve.

        A token that fails to map is silently dropped by ipa_to_arpabet, which
        shows up as a phantom deletion in the user's score rather than as an
        error. This pins the vocab of the default model
        (vitouphy/wav2vec2-xls-r-300m-timit-phoneme) so a bad env-var swap or a
        mapping regression fails loudly here instead.
        """
        vocab = [
            "ɑ", "æ", "ə", "aʊ", "aɪ", "b", "ʧ",
            "d", "ð", "ɾ", "ɛ", "ɝ", "eɪ", "f", "g",
            "h", "ɪ", "i", "ʤ", "k", "l", "m", "n", "ŋ",
            "oʊ", "ɔɪ", "p", "ɹ", "s", "ʃ", "t",
            "θ", "ʊ", "u", "v", "w", "j", "z",
        ]
        for token in vocab:
            with self.subTest(token=token):
                mapped = ipa_to_arpabet(token)
                self.assertEqual(
                    len(mapped), 1,
                    f"{token!r} -> {mapped} (expected exactly one ARPAbet phone)",
                )


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

    def test_registry_honours_acoustic_flag(self):
        """Registry must pick the scorer the flag asks for -- both directions.

        Asserted unconditionally: an `if settings.ENABLE_ACOUSTIC_SCORING`
        guard here would make the test pass vacuously whenever the default
        flips, which is exactly the regression this guards against.
        """
        from unittest import mock

        from app.services.pronunciation import registry

        for enabled, expected in ((True, "acoustic"), (False, "text_proxy")):
            with self.subTest(enabled=enabled):
                with mock.patch.object(
                    registry.settings, "ENABLE_ACOUSTIC_SCORING", enabled
                ):
                    registry._scorer = None  # reset cached singleton
                    self.assertEqual(registry.get_scorer().name, expected)
        registry._scorer = None  # don't leak a mocked-config scorer to other tests

    def test_acoustic_is_the_configured_default(self):
        """The shipped default must be acoustic; text proxy is the fallback only."""
        from app.core.config import settings

        self.assertTrue(settings.ENABLE_ACOUSTIC_SCORING)


if __name__ == "__main__":
    unittest.main()
