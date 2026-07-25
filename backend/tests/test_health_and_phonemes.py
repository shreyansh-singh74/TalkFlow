import unittest

import httpx

from main import app


async def get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


class HealthSmokeTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_endpoint(self):
        response = await get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")
        self.assertEqual(response.json()["transcription_service"], "wav2vec2")


if __name__ == "__main__":
    unittest.main()
