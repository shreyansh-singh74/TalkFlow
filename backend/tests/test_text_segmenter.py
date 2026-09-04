"""The segmenter's contract: cut the user's text, never rewrite it.

This is the speech-preparation path -- someone pastes the talk they have to
give. Paraphrasing their content would defeat the whole purpose, so the
round-trip invariant (every token, in order, exactly once) is the test that
matters most here. Everything else is about *where* the cuts land.
"""

import unittest

from app.services.practice_content import get_band
from app.services.text_segmenter import (
    MAX_STEPS,
    normalize_text,
    segment,
)
from app.utils.text import tokenize_words


def joined(script) -> str:
    return " ".join(step.text for step in script.steps)


class NormalizeTextTests(unittest.TestCase):
    def test_folds_smart_punctuation(self):
        out = normalize_text("“Don’t stop” — she said…")
        self.assertNotIn("’", out)
        self.assertNotIn("“", out)
        self.assertNotIn("—", out)
        self.assertIn("Don't", out)

    def test_curly_apostrophe_keeps_contractions_as_one_token(self):
        # WORD_RE is [a-zA-Z']+, so an unfolded curly apostrophe would split
        # "don't" into two tokens and silently break the round-trip invariant.
        self.assertEqual(tokenize_words(normalize_text("I don’t know")), ["i", "don't", "know"])

    def test_collapses_spaces_but_keeps_paragraph_breaks(self):
        out = normalize_text("One    two\n\n\n\nThree")
        self.assertEqual(out, "One two\n\nThree")

    def test_handles_windows_line_endings(self):
        self.assertEqual(normalize_text("A\r\n\r\nB"), "A\n\nB")

    def test_empty_input(self):
        self.assertEqual(normalize_text(""), "")
        self.assertEqual(normalize_text(None), "")  # type: ignore[arg-type]


class RoundTripTests(unittest.TestCase):
    SPEECH = (
        "Good evening everyone, and thank you for coming. Tonight I want to "
        "talk about three things that changed how our team works. The first is "
        "trust, because without it every process becomes theatre. The second "
        "is feedback, delivered quickly and delivered kindly.\n\n"
        "The third one is harder to explain, but I will try. We stopped "
        "measuring how busy people looked and started measuring what actually "
        "shipped, which sounds obvious and was not."
    )

    def test_tokens_are_preserved_exactly_at_every_tier(self):
        source_tokens = tokenize_words(normalize_text(self.SPEECH))
        for difficulty in ("easy", "medium", "hard"):
            script = segment(self.SPEECH, difficulty)
            self.assertEqual(
                tokenize_words(joined(script)),
                source_tokens,
                f"{difficulty} tier lost or reordered tokens",
            )

    def test_word_counts_match_the_step_text(self):
        script = segment(self.SPEECH, "medium")
        for step in script.steps:
            self.assertEqual(step.word_count, len(tokenize_words(step.text)))

    def test_step_indexes_are_dense_and_ordered(self):
        script = segment(self.SPEECH, "medium")
        self.assertEqual([s.index for s in script.steps], list(range(len(script.steps))))

    def test_harder_tiers_produce_fewer_larger_steps(self):
        easy = segment(self.SPEECH, "easy")
        hard = segment(self.SPEECH, "hard")
        self.assertGreater(len(easy.steps), len(hard.steps))

    def test_prose_stays_within_the_band_ceiling(self):
        # The only sanctioned way past the ceiling is _merge_short's escape
        # hatch for one- and two-word fragments, and this passage has none.
        for difficulty in ("easy", "medium", "hard"):
            band = get_band(difficulty)
            for step in segment(self.SPEECH, difficulty).steps:
                self.assertLessEqual(
                    step.word_count, band.max_words, f"{difficulty}: {step.text!r}"
                )

    def test_script_metadata(self):
        script = segment(self.SPEECH, "easy")
        self.assertEqual(script.generated_by, "segmenter")
        self.assertEqual(script.difficulty, "easy")
        self.assertEqual(script.pass_threshold, get_band("easy").pass_threshold)
        self.assertIn("Your text", script.source_label)
        self.assertFalse(script.truncated)


class AbbreviationGuardTests(unittest.TestCase):
    def test_titles_do_not_end_a_sentence(self):
        script = segment("Dr. Smith reviewed the results with our whole team today.", "medium")
        self.assertEqual(len(script.steps), 1)
        self.assertIn("Dr. Smith", script.steps[0].text)

    def test_dotted_abbreviations_do_not_end_a_sentence(self):
        script = segment("We opened an office in the U.S. last summer and hired quickly.", "hard")
        self.assertEqual(len(script.steps), 1)

    def test_decimals_do_not_end_a_sentence(self):
        script = segment("Revenue grew 12.5 percent across the region last year.", "medium")
        self.assertEqual(len(script.steps), 1)

    def test_initials_do_not_end_a_sentence(self):
        script = segment("The book by J. R. R. Tolkien remains widely popular today.", "hard")
        self.assertEqual(len(script.steps), 1)

    def test_a_real_terminator_still_splits(self):
        script = segment(
            "Dr. Smith reviewed the results. Everyone agreed with the conclusion.",
            "easy",
        )
        self.assertGreaterEqual(len(script.steps), 2)
        self.assertTrue(script.steps[0].text.endswith("."))


class LongSentenceSplitTests(unittest.TestCase):
    LONG = (
        "We rebuilt the entire onboarding flow from scratch, because the old "
        "one confused almost everybody who tried it, and we could not keep "
        "apologising for a screen that nobody understood."
    )

    def test_no_step_exceeds_the_band_ceiling(self):
        for difficulty in ("easy", "medium", "hard"):
            band = get_band(difficulty)
            script = segment(self.LONG, difficulty)
            for step in script.steps:
                self.assertLessEqual(
                    step.word_count,
                    band.max_words,
                    f"{difficulty}: {step.text!r}",
                )

    def test_prefers_a_clause_boundary(self):
        script = segment(self.LONG, "medium")
        self.assertGreater(len(script.steps), 1)
        # A cut at a comma or a conjunction leaves the previous step ending in
        # punctuation, or the next one starting with a connective.
        connectives = {"because", "and", "which", "but", "so", "that"}
        cut_well = sum(
            1
            for i, step in enumerate(script.steps[:-1])
            if step.text.rstrip().endswith((",", ";", ":", "-"))
            or script.steps[i + 1].text.split()[0].lower().strip(",") in connectives
        )
        self.assertGreater(cut_well, 0)

    def test_mid_sentence_steps_carry_a_continuation_note(self):
        script = segment(self.LONG, "easy")
        self.assertTrue(any(step.note for step in script.steps[:-1]))
        # The final step ends the sentence, so it must not claim to continue.
        self.assertIsNone(script.steps[-1].note)


class MergeShortTests(unittest.TestCase):
    def test_short_sentences_merge(self):
        script = segment("I tried. It failed. I tried again and it finally worked.", "medium")
        # Three fragments, none of which is a viable medium step on its own.
        self.assertLess(len(script.steps), 3)

    def test_no_merge_across_a_paragraph_break(self):
        script = segment("I tried.\n\nIt failed.", "hard")
        self.assertEqual([s.text for s in script.steps], ["I tried.", "It failed."])

    def test_a_tiny_fragment_is_never_left_standing_alone(self):
        # "Yes." would be a one-word step; merging it is better practice than
        # asking someone to score a single syllable.
        script = segment("Yes. We shipped the redesign on Friday afternoon.", "medium")
        self.assertEqual(len(script.steps), 1)


class CapAndDegenerateInputTests(unittest.TestCase):
    def test_step_cap_is_enforced_and_reported(self):
        source = " ".join(f"This is practice sentence number {i} today." for i in range(60))
        script = segment(source, "easy")
        self.assertEqual(len(script.steps), MAX_STEPS)
        # Truncation must be surfaced, not silently swallowed -- the user needs
        # to know part of their speech is not in the session.
        self.assertTrue(script.truncated)

    def test_empty_text_yields_an_empty_script(self):
        for source in ("", "   ", "\n\n"):
            script = segment(source, "medium")
            self.assertEqual(script.steps, [])
            self.assertFalse(script.truncated)

    def test_text_without_terminators_still_segments(self):
        script = segment("no punctuation at all in this pasted line of text", "easy")
        self.assertGreaterEqual(len(script.steps), 1)
        self.assertEqual(
            tokenize_words(joined(script)),
            tokenize_words("no punctuation at all in this pasted line of text"),
        )

    def test_unknown_difficulty_uses_the_default_band(self):
        a = segment(RoundTripTests.SPEECH, "expert")
        b = segment(RoundTripTests.SPEECH, "medium")
        self.assertEqual([s.text for s in a.steps], [s.text for s in b.steps])


if __name__ == "__main__":
    unittest.main()
