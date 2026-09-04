"""Contract tests for the data the mouth-shape animation consumes.

Two things are pinned here.

**The animation's per-phone timing must not live in the backend.** The renderer
needs a duration for every phone, and ``PhonemeEntry.expected_duration_ms`` is
the obvious place to put one — but that field is reserved for real forced
alignment feeding learner-facing rhythm scoring. A nominal table written there
would be indistinguishable, downstream, from a measurement, which is exactly the
failure mode ``test_session_report.py`` exists to prevent for the other report
fields. The nominal table therefore lives in ``web/src/lib/viseme-timing.ts``,
and this module asserts the backend never fills the field.

**The two views of a word must agree.** ``/reference`` returns both a flat
``phonemes`` list and a per-syllable ``arpabet_syllables`` list. They are built
from one partition, and a regression that reintroduced independent filtering
would let them disagree silently — which is how the previous respelling bug
stayed invisible.
"""

import re
import unittest
from pathlib import Path

import httpx

from app.schemas.pronunciation import PhonemeEntry
from app.services.pronunciation_service import pronunciation_service
from app.utils.arpabet_tables import VISEME_ID_MAP
from main import app

BACKEND_ROOT = Path(__file__).resolve().parents[1]

WORDS = [
    "circumstances",
    "naturally",
    "particularly",
    "comfortable",
    "hello",
    "strengths",
    "think",
    "she",
]


async def get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get(path)


class ExpectedDurationStaysUnmeasuredTests(unittest.IsolatedAsyncioTestCase):
    def test_schema_default_is_none(self):
        entry = PhonemeEntry(symbol="AE", stress=1, viseme_id=5)
        self.assertIsNone(entry.expected_duration_ms)
        self.assertIsNone(entry.confidence)

    def test_service_never_fills_it(self):
        for word in WORDS:
            with self.subTest(word=word):
                for phoneme in pronunciation_service.lookup(word).phonemes:
                    self.assertIsNone(phoneme.expected_duration_ms)

    async def test_info_endpoint_never_fills_it(self):
        response = await get("/api/phonemes/info/circumstances")
        self.assertEqual(response.status_code, 200)
        phonemes = response.json()["phonemes"]
        self.assertTrue(phonemes)
        for phoneme in phonemes:
            self.assertIsNone(phoneme["expected_duration_ms"])

    async def test_reference_endpoint_never_fills_it(self):
        response = await get("/api/phonemes/reference/circumstances")
        self.assertEqual(response.status_code, 200)
        phonemes = response.json()["phonemes"]
        self.assertTrue(phonemes)
        for phoneme in phonemes:
            self.assertIsNone(phoneme["expected_duration_ms"])

    def test_no_source_assigns_a_literal_duration(self):
        """Structural guard: nothing in ``app/`` writes a value into the field.

        A future contributor reaching for the obvious place to park animation
        constants trips this before the number can reach a session report.
        """
        assignment = re.compile(r"expected_duration_ms\s*=\s*(?!None\b)")
        offenders = []
        for path in (BACKEND_ROOT / "app").rglob("*.py"):
            for lineno, line in enumerate(
                path.read_text(encoding="utf-8").splitlines(), start=1
            ):
                stripped = line.strip()
                # Skip the schema's own field declaration and prose.
                if stripped.startswith("#") or "Optional[float]" in stripped:
                    continue
                if assignment.search(stripped):
                    offenders.append(f"{path.relative_to(BACKEND_ROOT)}:{lineno}")
        self.assertEqual(offenders, [], msg=f"non-None assignment(s): {offenders}")


class VisemePayloadTests(unittest.IsolatedAsyncioTestCase):
    """The animation needs a pose for every phone and a syllable for every pose."""

    def test_every_phoneme_carries_a_known_viseme_id(self):
        valid = set(VISEME_ID_MAP.values())
        for word in WORDS:
            with self.subTest(word=word):
                for phoneme in pronunciation_service.lookup(word).phonemes:
                    self.assertIn(phoneme.viseme_id, valid)

    def test_symbols_are_stress_stripped(self):
        """The renderer keys poses off the bare symbol; ``AE1`` would miss."""
        for word in WORDS:
            with self.subTest(word=word):
                for phoneme in pronunciation_service.lookup(word).phonemes:
                    self.assertFalse(
                        phoneme.symbol[-1:].isdigit(),
                        msg=f"{word}: {phoneme.symbol}",
                    )

    def test_syllable_index_is_in_range_and_non_decreasing(self):
        """Phones arrive in articulation order, so syllable indices must too."""
        for word in WORDS:
            with self.subTest(word=word):
                entry = pronunciation_service.lookup(word)
                indices = [p.syllable_index for p in entry.phonemes]
                self.assertTrue(all(0 <= i < len(entry.syllables) for i in indices))
                self.assertEqual(indices, sorted(indices))

    def test_every_syllable_owns_at_least_one_phoneme(self):
        """An empty syllable would render a highlight over nothing."""
        for word in WORDS:
            with self.subTest(word=word):
                entry = pronunciation_service.lookup(word)
                owned = {p.syllable_index for p in entry.phonemes}
                self.assertEqual(owned, set(range(len(entry.syllables))))

    async def test_reference_syllable_phones_match_the_flat_list(self):
        """The two views are one partition, rendered twice."""
        for word in WORDS:
            with self.subTest(word=word):
                response = await get(f"/api/phonemes/reference/{word}")
                self.assertEqual(response.status_code, 200)
                body = response.json()
                regrouped = " ".join(
                    s["phones"] for s in body["arpabet_syllables"] if s["phones"]
                )
                flat = " ".join(p["symbol"] for p in body["phonemes"])
                self.assertEqual(regrouped, flat)

    async def test_reference_marks_exactly_one_primary_stress(self):
        for word in WORDS:
            with self.subTest(word=word):
                response = await get(f"/api/phonemes/reference/{word}")
                syllables = response.json()["arpabet_syllables"]
                self.assertLessEqual(sum(s["stressed"] for s in syllables), 1)
                self.assertLessEqual(
                    sum(1 for s in syllables if s["stress_level"] == 1), 1
                )

    async def test_reference_syllables_all_have_display_text(self):
        """A blank chip is the visible symptom of a vowel-less syllable."""
        for word in WORDS:
            with self.subTest(word=word):
                response = await get(f"/api/phonemes/reference/{word}")
                for syllable in response.json()["arpabet_syllables"]:
                    self.assertTrue(syllable["display"].strip())
                    self.assertTrue(syllable["phones"].strip())


if __name__ == "__main__":
    unittest.main()
