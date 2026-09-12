"""Accent profiles: what "correct" means depends on the accent being learned.

The behaviour worth locking down is that a coach set to a non-rhotic accent
stops charging a British learner for a sound their accent does not pronounce,
while the American target keeps charging for it.
"""

import unittest

from app.services.pronunciation.accents import (
    ACCENT_PROFILES,
    DEFAULT_ACCENT,
    get_accent_profile,
    resolve_accent_code,
)
from app.services.pronunciation.alignment import AlignedPair, align_phonemes
from app.services.pronunciation.scoring import score_alignment


class AccentResolutionTests(unittest.TestCase):
    def test_canonical_codes_survive(self):
        for code in ACCENT_PROFILES:
            self.assertEqual(resolve_accent_code(code), code)

    def test_aliases_and_casing_resolve(self):
        self.assertEqual(resolve_accent_code("uk"), "en-GB")
        self.assertEqual(resolve_accent_code("en_GB"), "en-GB")
        self.assertEqual(resolve_accent_code("EN-gb"), "en-GB")
        self.assertEqual(resolve_accent_code("au"), "en-AU")
        self.assertEqual(resolve_accent_code("en-IN"), "en-IN")

    def test_unknown_or_absent_falls_back_instead_of_raising(self):
        # A bad accent value must never break a turn.
        self.assertEqual(resolve_accent_code(None), DEFAULT_ACCENT)
        self.assertEqual(resolve_accent_code(""), DEFAULT_ACCENT)
        self.assertEqual(resolve_accent_code("klingon"), DEFAULT_ACCENT)
        self.assertEqual(get_accent_profile("klingon").code, DEFAULT_ACCENT)

    def test_every_profile_is_serialisable_for_the_picker(self):
        for profile in ACCENT_PROFILES.values():
            body = profile.to_dict()
            self.assertTrue(body["code"] and body["label"] and body["tts_voice"])
            self.assertIsInstance(body["rhotic"], bool)


class NonRhoticReferenceTests(unittest.TestCase):
    def test_us_reference_is_untouched(self):
        phones = ["P", "AA", "R", "T", "IY"]
        self.assertEqual(get_accent_profile("en-US").normalize_reference(phones), phones)

    def test_gb_drops_coda_r_and_keeps_r_before_a_vowel(self):
        gb = get_accent_profile("en-GB")
        # party: R before a consonant -> dropped.
        self.assertEqual(gb.normalize_reference(["P", "AA", "R", "T", "IY"]), ["P", "AA", "T", "IY"])
        # car: R at the end of the reference -> dropped.
        self.assertEqual(gb.normalize_reference(["K", "AA", "R"]), ["K", "AA"])
        # road: R before a vowel -> pronounced.
        self.assertEqual(gb.normalize_reference(["R", "OW", "D"]), ["R", "OW", "D"])

    def test_indian_english_is_rhotic(self):
        self.assertTrue(get_accent_profile("en-IN").rhotic)
        self.assertEqual(
            get_accent_profile("en-IN").normalize_reference(["P", "AA", "R", "T", "IY"]),
            ["P", "AA", "R", "T", "IY"],
        )

    def test_gb_inserted_linking_r_is_not_a_penalty(self):
        gb = get_accent_profile("en-GB")
        inserted = AlignedPair("insert", None, "R", 1.0)
        self.assertEqual(gb.apply([inserted]), [])
        # ...but the American target still counts an extra sound.
        self.assertEqual(len(get_accent_profile("en-US").apply([inserted])), 1)


class AccentScoringTests(unittest.TestCase):
    def _score(self, accent, expected, actual):
        profile = get_accent_profile(accent)
        pairs = profile.apply(align_phonemes(profile.normalize_reference(expected), actual))
        return score_alignment(pairs, use_confidence=False)

    def test_dropped_coda_r_scores_clean_in_gb_and_errors_in_us(self):
        expected = ["P", "AA", "R", "T", "IY"]
        actual = ["P", "AA", "T", "IY"]  # what a British speaker actually says

        gb = self._score("en-GB", expected, actual)
        self.assertEqual(gb["score"], 100.0)
        self.assertEqual(gb["errors"], [])

        us = self._score("en-US", expected, actual)
        self.assertLess(us["score"], 100.0)
        self.assertTrue(any(e["op"] == "delete" for e in us["errors"]))

    def test_trap_bath_is_forgiven_in_gb_but_not_us(self):
        # "ask": US /æsk/, RP /ɑːsk/.
        expected = ["AE", "S", "K"]
        actual = ["AA", "S", "K"]
        self.assertEqual(self._score("en-GB", expected, actual)["score"], 100.0)
        # Against the American target the same vowel shift is still a miss, and
        # only partial credit applies (both are open front-ish vowels).
        us = self._score("en-US", expected, actual)
        self.assertLess(us["score"], 100.0)
        self.assertTrue(us["errors"])

    def test_an_intelligibility_error_is_never_forgiven(self):
        # θ -> t is typical of several L1s and is *not* accent-defining: every
        # profile must still score it as an error. This is the guarantee that
        # stops a profile from becoming an easier exam.
        expected = ["TH", "IH", "N"]
        actual = ["T", "IH", "N"]
        for code in ACCENT_PROFILES:
            with self.subTest(accent=code):
                result = self._score(code, expected, actual)
                self.assertLess(result["score"], 100.0)
                self.assertTrue(result["errors"])

    def test_non_rhotic_is_not_a_free_pass_on_r_before_a_vowel(self):
        # "road" with the /r/ missing is still wrong for a British learner.
        result = self._score("en-GB", ["R", "OW", "D"], ["OW", "D"])
        self.assertLess(result["score"], 100.0)


if __name__ == "__main__":
    unittest.main()
