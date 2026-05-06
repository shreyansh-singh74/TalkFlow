import unittest
from unittest.mock import patch

import httpx

from main import app


async def get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


class HealthAndPhonemeSmokeTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_endpoint(self):
        response = await get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    @patch(
        "app.api.routes.phoneme_routes.phoneme_analyzer.raw_arpabet_tokens_for_word",
        return_value=["HH", "AH0", "L", "OW1"],
    )
    async def test_pronunciation_reference_endpoint(self, _mock_tokens):
        response = await get("/api/phonemes/reference/hello")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["word"], "hello")
        self.assertIsInstance(body["arpabet_syllables"], list)


if __name__ == "__main__":
    unittest.main()
