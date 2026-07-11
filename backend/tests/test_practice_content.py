import unittest

from app.services.practice_content import (
    get_initial_sentence,
    get_next_sentence,
    split_practice_words,
)


class PracticeContentTests(unittest.TestCase):
    def test_selects_interview_bank_from_agent_name(self):
        self.assertEqual(
            get_initial_sentence("Interview English Coach", ""),
            "I worked on a challenging project recently.",
        )

    def test_selects_pronunciation_bank_from_instructions(self):
        self.assertEqual(
            get_initial_sentence("", "Focus on pronunciation drills."),
            "The circumstances were unexpected.",
        )

    def test_next_sentence_skips_previous_sentences(self):
        first = get_initial_sentence("Daily Conversation Coach", "")
        second = get_next_sentence("Daily Conversation Coach", "", [first])
        self.assertNotEqual(first, second)

    def test_split_practice_words_removes_punctuation(self):
        self.assertEqual(
            split_practice_words("Could you help me with this?"),
            ["Could", "you", "help", "me", "with", "this"],
        )


if __name__ == "__main__":
    unittest.main()
