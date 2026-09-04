"""Difficulty bands are only meaningful if they are enforced.

These tests used to assert exact hardcoded sentences ("Interview English Coach"
must produce "I worked on a challenging project recently."). That content is
gone -- what matters now is that ``validate_step`` actually rejects out-of-band
text, and that the offline bank we degrade to satisfies its own tier.
"""

import unittest

from app.services.practice_content import (
    DEFAULT_DIFFICULTY,
    DIFFICULTY_BANDS,
    FALLBACK_BANK,
    fallback_steps,
    get_band,
    pass_threshold_for,
    split_practice_words,
    syllable_count,
    validate_step,
)


class DifficultyBandTests(unittest.TestCase):
    def test_bands_are_ordered_and_non_overlapping_at_the_top(self):
        easy, medium, hard = (DIFFICULTY_BANDS[k] for k in ("easy", "medium", "hard"))
        # Thresholds must rise with difficulty, otherwise "hard" is easier to pass.
        self.assertLess(easy.pass_threshold, medium.pass_threshold)
        self.assertLess(medium.pass_threshold, hard.pass_threshold)
        # Word ceilings must rise too.
        self.assertLess(easy.max_words, medium.max_words)
        self.assertLess(medium.max_words, hard.max_words)
        for band in (easy, medium, hard):
            self.assertLess(band.min_words, band.max_words)
            self.assertLessEqual(band.min_words, band.target_words)
            self.assertLessEqual(band.target_words, band.max_words)

    def test_unknown_difficulty_falls_back_to_default(self):
        self.assertEqual(get_band("expert").name, DEFAULT_DIFFICULTY)
        self.assertEqual(get_band("").name, DEFAULT_DIFFICULTY)
        self.assertEqual(get_band(None).name, DEFAULT_DIFFICULTY)  # type: ignore[arg-type]

    def test_difficulty_lookup_is_case_and_space_insensitive(self):
        self.assertEqual(get_band("  Hard ").name, "hard")

    def test_pass_threshold_for_matches_the_band(self):
        for name, band in DIFFICULTY_BANDS.items():
            self.assertEqual(pass_threshold_for(name), band.pass_threshold)


class ValidateStepTests(unittest.TestCase):
    def test_rejects_empty_text(self):
        ok, reason = validate_step("", "easy")
        self.assertFalse(ok)
        self.assertIn("no words", reason)

        ok, _ = validate_step("...!?", "easy")
        self.assertFalse(ok)

    def test_easy_accepts_a_short_plain_sentence(self):
        ok, reason = validate_step("I want to speak clearly.", "easy")
        self.assertTrue(ok, reason)

    def test_easy_rejects_too_few_words(self):
        ok, reason = validate_step("Speak up.", "easy")
        self.assertFalse(ok)
        self.assertIn("too short", reason)

    def test_easy_rejects_too_many_words(self):
        ok, reason = validate_step(
            "I really want to learn how to speak this language clearly and well.",
            "easy",
        )
        self.assertFalse(ok)
        self.assertIn("too long", reason)

    def test_easy_rejects_a_long_word_even_at_the_right_length(self):
        # Word count is in band (5), but "pronunciation" blows the syllable cap.
        ok, reason = validate_step("My pronunciation needs some work.", "easy")
        self.assertFalse(ok)
        self.assertIn("syllable", reason)

    def test_medium_requires_a_multisyllabic_word(self):
        # Nine words, all one or two syllables: in band on length, too flat.
        ok, reason = validate_step(
            "I went to the shop and bought some bread.", "medium"
        )
        self.assertFalse(ok)
        self.assertIn("multi-syllable", reason)

        ok, reason = validate_step(
            "I visited the local bakery and bought fresh bread.", "medium"
        )
        self.assertTrue(ok, reason)

    def test_a_step_valid_for_one_tier_is_rejected_by_the_others(self):
        """The bands have to actually discriminate, or difficulty is cosmetic."""
        easy_step = "I want to speak clearly."
        self.assertTrue(validate_step(easy_step, "easy")[0])
        self.assertFalse(validate_step(easy_step, "medium")[0])
        self.assertFalse(validate_step(easy_step, "hard")[0])

        hard_step = FALLBACK_BANK["hard"][0]
        self.assertTrue(validate_step(hard_step, "hard")[0])
        self.assertFalse(validate_step(hard_step, "easy")[0])

    def test_unknown_difficulty_validates_against_the_default_band(self):
        step = FALLBACK_BANK[DEFAULT_DIFFICULTY][0]
        self.assertTrue(validate_step(step, "nonsense")[0])


class FallbackBankTests(unittest.TestCase):
    def test_every_tier_has_a_bank(self):
        self.assertEqual(set(FALLBACK_BANK), set(DIFFICULTY_BANDS))

    def test_every_fallback_entry_satisfies_its_own_band(self):
        """The offline path must not hand back content it would itself reject."""
        for difficulty, bank in FALLBACK_BANK.items():
            self.assertGreaterEqual(len(bank), 15, difficulty)
            self.assertEqual(len(set(bank)), len(bank), f"{difficulty} has duplicates")
            for sentence in bank:
                ok, reason = validate_step(sentence, difficulty)
                self.assertTrue(ok, f"[{difficulty}] {sentence!r}: {reason}")

    def test_fallback_steps_returns_exactly_what_was_asked_for(self):
        steps = fallback_steps("easy", 5)
        self.assertEqual(len(steps), 5)
        self.assertEqual(len(set(steps)), 5)

    def test_fallback_steps_honours_exclusions(self):
        first = fallback_steps("medium", 3)
        second = fallback_steps("medium", 3, exclude=first)
        self.assertFalse(set(first) & set(second))

    def test_fallback_steps_cycles_rather_than_returning_a_short_script(self):
        wanted = len(FALLBACK_BANK["easy"]) + 4
        steps = fallback_steps("easy", wanted)
        self.assertEqual(len(steps), wanted)

    def test_fallback_steps_uses_the_default_tier_for_an_unknown_name(self):
        steps = fallback_steps("expert", 3)
        self.assertTrue(set(steps) <= set(FALLBACK_BANK[DEFAULT_DIFFICULTY]))


class SyllableCountTests(unittest.TestCase):
    def test_known_words(self):
        for word, expected in [
            ("cat", 1),
            ("make", 1),
            ("water", 2),
            ("banana", 3),
            ("pronunciation", 5),
        ]:
            self.assertEqual(syllable_count(word), expected, word)

    def test_degenerate_input_never_returns_zero(self):
        for word in ("", "   ", "123", "!!!"):
            self.assertGreaterEqual(syllable_count(word), 1)


class SplitPracticeWordsTests(unittest.TestCase):
    def test_removes_punctuation(self):
        self.assertEqual(
            split_practice_words("Could you help me with this?"),
            ["Could", "you", "help", "me", "with", "this"],
        )

    def test_keeps_digits_and_apostrophes(self):
        # Pasted speech routinely contains figures; dropping them would
        # desynchronise the on-screen chips from what has to be spoken.
        self.assertEqual(
            split_practice_words("We don't have 3 options."),
            ["We", "don't", "have", "3", "options"],
        )

    def test_falls_back_to_the_raw_string_when_nothing_tokenizes(self):
        self.assertEqual(split_practice_words("---"), ["---"])
        self.assertEqual(split_practice_words("   "), [])


if __name__ == "__main__":
    unittest.main()
