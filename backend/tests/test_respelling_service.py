import unittest
from app.services.phoneme_respelling_service import phoneme_respelling_service


class RespellingServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_predefined_words_indian_english(self):
        # Naturally
        res_nat = await phoneme_respelling_service.get_dialect_respelling("naturally", "en-IN")
        self.assertTrue(len(res_nat) > 0)
        self.assertTrue(res_nat[0]["display"])

        # English
        res_eng = await phoneme_respelling_service.get_dialect_respelling("english", "en-IN")
        self.assertTrue(len(res_eng) > 0)
        self.assertTrue(res_eng[0]["display"])

    async def test_predefined_words_american_english(self):
        # Hello (cached)
        res_hello = await phoneme_respelling_service.get_dialect_respelling("hello", "en-US")
        self.assertEqual(len(res_hello), 2)
        self.assertEqual(res_hello[0]["display"], "huh")
        self.assertFalse(res_hello[0]["stressed"])

    async def test_predefined_words_british_english(self):
        # Practice
        res_prac = await phoneme_respelling_service.get_dialect_respelling("practice", "en-GB")
        self.assertTrue(len(res_prac) > 0)
        self.assertTrue(res_prac[0]["display"])

    async def test_unknown_word_fallback(self):
        # Fallback uses local G2P + pyphen analyzer
        res = await phoneme_respelling_service.get_dialect_respelling("welcome", "en-US")
        self.assertTrue(len(res) > 0)
        self.assertTrue(any(s["display"] for s in res))


if __name__ == "__main__":
    unittest.main()


