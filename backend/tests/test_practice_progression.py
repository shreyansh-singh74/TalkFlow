import unittest
from unittest.mock import MagicMock
from app.api.routes.voice_websocket import VoiceSession
from app.services.practice_content import (
    DAILY_SENTENCES,
    INTERVIEW_SENTENCES,
    PRONUNCIATION_SENTENCES,
    VOCABULARY_SENTENCES,
    get_sentence_bank,
)

class TestPracticeProgression(unittest.TestCase):
    def setUp(self):
        self.mock_ws = MagicMock()
        self.session = VoiceSession(self.mock_ws, meeting_id="test_meeting")
        self.session.agent_name = "Daily Conversation Coach"
        self.session.agent_instructions = ""
        
        # Redesign: Initialize with 10 sentences
        bank = get_sentence_bank(self.session.agent_name, self.session.agent_instructions)
        self.session.session_sentences = bank[:10]
        self.session.current_sentence_index = 0
        self.session.current_sentence = self.session.session_sentences[0]
        self.session.target_text = self.session.current_sentence
        self.session.practice_mode = "sentence"
        self.session.score_threshold = 95

    def test_initial_state(self):
        self.assertEqual(self.session.practice_mode, "sentence")
        self.assertEqual(self.session.score_threshold, 95)
        self.assertEqual(self.session.current_sentence_index, 0)
        self.assertEqual(self.session.current_sentence, DAILY_SENTENCES[0])
        self.assertEqual(self.session.target_text, DAILY_SENTENCES[0])

    def test_score_below_threshold_repeats_sentence(self):
        # Score is 90 (below threshold 95)
        res = self.session._advance_practice(90)
        self.assertFalse(res["advanced"])
        self.assertFalse(res["completed_sentence"])
        self.assertFalse(res["session_complete"])
        self.assertEqual(self.session.current_sentence_index, 0)
        self.assertEqual(self.session.target_text, DAILY_SENTENCES[0])

    def test_score_above_threshold_advances_sentence(self):
        # Score is 97 (above threshold 95)
        res = self.session._advance_practice(97)
        self.assertTrue(res["advanced"])
        self.assertTrue(res["completed_sentence"])
        self.assertFalse(res["session_complete"])
        self.assertEqual(self.session.current_sentence_index, 1)
        self.assertEqual(self.session.target_text, DAILY_SENTENCES[1])

    def test_advancing_all_sentences_completes_session(self):
        # Advance through first 9 sentences
        for i in range(9):
            res = self.session._advance_practice(98)
            self.assertTrue(res["advanced"])
            self.assertEqual(self.session.current_sentence_index, i + 1)
        
        # Now we are on the 10th sentence (index 9)
        self.assertEqual(self.session.current_sentence_index, 9)
        
        # Advance the last sentence
        res = self.session._advance_practice(98)
        self.assertTrue(res["advanced"])
        self.assertTrue(res["completed_sentence"])
        self.assertTrue(res["session_complete"])

    def test_category_selection_from_agent_name_and_instructions(self):
        # Interview bank
        bank_interview = get_sentence_bank("Interview English Coach", "")
        self.assertEqual(bank_interview[0], INTERVIEW_SENTENCES[0])
        
        # Pronunciation bank
        bank_pron = get_sentence_bank("Daily Coach", "Focus on pronunciation drills")
        self.assertEqual(bank_pron[0], PRONUNCIATION_SENTENCES[0])
        
        # Vocabulary bank
        bank_vocab = get_sentence_bank("Vocabulary Builder", "")
        self.assertEqual(bank_vocab[0], VOCABULARY_SENTENCES[0])
        
        # Daily bank
        bank_daily = get_sentence_bank("Daily Conversation Coach", "")
        self.assertEqual(bank_daily[0], DAILY_SENTENCES[0])

if __name__ == "__main__":
    unittest.main()
