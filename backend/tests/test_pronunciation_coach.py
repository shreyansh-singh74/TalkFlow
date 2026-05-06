import json
import unittest
from unittest.mock import patch, MagicMock

import app.services.llm_response as llm_response

from app.services.pronunciation_coach import (
    build_pronunciation_coach_for_llm,
    misaligned_word_pairs,
)
from app.services.llm_response import _call_openrouter


class PronunciationCoachTests(unittest.TestCase):
    def setUp(self):
        self._prev_key = llm_response.settings.OPENROUTER_API_KEY
        llm_response.settings.OPENROUTER_API_KEY = "test-key"

    def tearDown(self):
        llm_response.settings.OPENROUTER_API_KEY = self._prev_key

    def test_misaligned_word_pairs_replace(self):
        pairs = misaligned_word_pairs("circumstances", "circumstance", max_pairs=5)
        self.assertTrue(len(pairs) >= 1)
        self.assertTrue(
            any(
                p["expected"] == "circumstances" and p["heard"] == "circumstance"
                for p in pairs
            )
        )

    def test_coach_has_no_phoneme_keys(self):
        coach = build_pronunciation_coach_for_llm(
            "hello world",
            "hello word",
            80.0,
            ["line one", "line two", "line three", "line four"],
        )
        self.assertNotIn("expected_phonemes", coach)
        self.assertNotIn("actual_phonemes", coach)
        self.assertNotIn("errors", coach)
        self.assertEqual(len(coach["feedback"]), 3)
        self.assertEqual(coach["score"], 80.0)

    @patch("app.services.llm_response.requests.post")
    def test_openrouter_user_message_no_phoneme_arrays(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "ok"}}]
        }
        mock_post.return_value = mock_resp

        coach = build_pronunciation_coach_for_llm("a", "b", 50.0, ["f1"])
        _call_openrouter("User: hi", pronunciation_coach=coach)
        self.assertTrue(mock_post.called)
        kwargs = mock_post.call_args[1]
        payload = kwargs["json"]
        user_text = payload["messages"][1]["content"]
        self.assertNotIn("expected_phonemes", user_text)
        self.assertIn("PRONUNCIATION_ASSESSMENT", user_text)
        j = user_text.split("PRONUNCIATION_ASSESSMENT:\n", 1)[1]
        self.assertEqual(json.loads(j), coach)
        self.assertEqual(payload["max_tokens"], 256)


if __name__ == "__main__":
    unittest.main()
