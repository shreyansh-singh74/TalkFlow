"""``generate_from_topic`` must never raise and never return a short script.

Session creation is a form submit. If a flaky OpenRouter call could block it,
the user would be told their session failed for a reason that has nothing to do
with anything they did. Every test here checks the degradation ladder holds:

    LLM output -> band validation -> one bounded retry -> FALLBACK_BANK top-up

``_call_openrouter`` is patched throughout; nothing here touches the network.
"""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

from app.services import script_generator
from app.services.practice_content import (
    FALLBACK_BANK,
    get_band,
    validate_step,
)


def run(coro):
    return asyncio.run(coro)


def valid_batch(difficulty: str, count: int) -> str:
    """A JSON array of `count` sentences that genuinely pass the band."""
    bank = FALLBACK_BANK[difficulty]
    return json.dumps([bank[i % len(bank)] for i in range(count)])


class ParseSentencesTests(unittest.TestCase):
    def test_bare_json_array(self):
        self.assertEqual(
            script_generator._parse_sentences('["One two three.", "Four five six."]'),
            ["One two three.", "Four five six."],
        )

    def test_strips_markdown_fences(self):
        raw = '```json\n["One two three.", "Four five six."]\n```'
        self.assertEqual(len(script_generator._parse_sentences(raw)), 2)

    def test_recovers_an_array_wrapped_in_commentary(self):
        raw = 'Sure! Here you go:\n["One two three.", "Four five six."]\nHope that helps.'
        self.assertEqual(len(script_generator._parse_sentences(raw)), 2)

    def test_falls_back_to_line_parsing_for_a_numbered_list(self):
        raw = "1. The first practice sentence.\n2. The second practice sentence."
        self.assertEqual(
            script_generator._parse_sentences(raw),
            ["The first practice sentence.", "The second practice sentence."],
        )

    def test_falls_back_to_line_parsing_for_bullets(self):
        raw = "- The first practice sentence.\n* The second practice sentence."
        self.assertEqual(len(script_generator._parse_sentences(raw)), 2)

    def test_collapses_internal_whitespace(self):
        self.assertEqual(
            script_generator._parse_sentences('["One   two\\n  three."]'),
            ["One two three."],
        )

    def test_empty_and_junk_input(self):
        for raw in ("", "   ", None, "{}", "no"):
            self.assertEqual(script_generator._parse_sentences(raw), [])  # type: ignore[arg-type]

    def test_ignores_non_string_array_members(self):
        raw = '[{"text": "nope"}, "A perfectly fine sentence here.", null]'
        self.assertEqual(
            script_generator._parse_sentences(raw),
            ["A perfectly fine sentence here."],
        )


class GenerateFromTopicTests(unittest.TestCase):
    def _assert_full_and_in_band(self, script, difficulty: str, count: int):
        self.assertEqual(len(script.steps), count)
        self.assertEqual([s.index for s in script.steps], list(range(count)))
        self.assertEqual(script.difficulty, difficulty)
        self.assertEqual(script.pass_threshold, get_band(difficulty).pass_threshold)
        for step in script.steps:
            ok, reason = validate_step(step.text, difficulty)
            self.assertTrue(ok, f"{step.text!r}: {reason}")
            self.assertGreater(step.word_count, 0)

    def test_happy_path_is_tagged_llm(self):
        mock = AsyncMock(return_value=valid_batch("medium", 14))
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(
                script_generator.generate_from_topic("Job interviews", "medium", 10)
            )
        self._assert_full_and_in_band(script, "medium", 10)
        self.assertEqual(script.generated_by, "llm")
        self.assertIn("Job interviews", script.source_label)
        self.assertIn(get_band("medium").label, script.source_label)
        self.assertEqual(mock.await_count, 1)

    def test_malformed_json_still_yields_a_full_fallback_script(self):
        mock = AsyncMock(return_value="I am afraid I cannot help with that.")
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Cooking", "easy", 6))
        self._assert_full_and_in_band(script, "easy", 6)
        self.assertEqual(script.generated_by, "fallback")

    def test_a_raising_client_is_swallowed(self):
        mock = AsyncMock(side_effect=RuntimeError("402 payment required"))
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Travel", "hard", 5))
        self._assert_full_and_in_band(script, "hard", 5)
        self.assertEqual(script.generated_by, "fallback")
        # The exception must abort the retry loop, not be retried blindly.
        self.assertEqual(mock.await_count, 1)

    def test_out_of_band_output_is_discarded_not_shipped(self):
        # Every sentence is far too long for the easy tier.
        too_long = json.dumps([FALLBACK_BANK["hard"][i] for i in range(8)])
        mock = AsyncMock(return_value=too_long)
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Anything", "easy", 5))
        self._assert_full_and_in_band(script, "easy", 5)
        self.assertEqual(script.generated_by, "fallback")
        # Two attempts: the first was fully rejected, so a retry is warranted.
        self.assertEqual(mock.await_count, 2)

    def test_short_output_is_topped_up_from_the_bank(self):
        mock = AsyncMock(return_value=valid_batch("medium", 3))
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Meetings", "medium", 10))
        self._assert_full_and_in_band(script, "medium", 10)
        # A topped-up script is not an LLM script, and the UI says so.
        self.assertEqual(script.generated_by, "fallback")

    def test_a_successful_retry_still_counts_as_llm(self):
        mock = AsyncMock(
            side_effect=["not json at all", valid_batch("easy", 12)]
        )
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Cafes", "easy", 8))
        self._assert_full_and_in_band(script, "easy", 8)
        self.assertEqual(script.generated_by, "llm")
        self.assertEqual(mock.await_count, 2)

    def test_retries_at_most_once(self):
        mock = AsyncMock(return_value="still not json")
        with patch.object(script_generator, "_call_openrouter", mock):
            run(script_generator.generate_from_topic("Anything", "medium", 10))
        self.assertEqual(mock.await_count, 2)

    def test_steps_are_deduplicated(self):
        same = FALLBACK_BANK["medium"][0]
        mock = AsyncMock(return_value=json.dumps([same] * 12))
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Repeats", "medium", 6))
        texts = [s.text for s in script.steps]
        self.assertEqual(len(set(texts)), len(texts))

    def test_no_topic_skips_the_llm_entirely(self):
        mock = AsyncMock(return_value=valid_batch("medium", 12))
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(
                script_generator.generate_from_topic(
                    "  ", "medium", 4, coach_name="Practice Coach"
                )
            )
        self.assertEqual(mock.await_count, 0)
        self._assert_full_and_in_band(script, "medium", 4)
        self.assertEqual(script.generated_by, "fallback")
        self.assertIn("Practice Coach", script.source_label)

    def test_unknown_difficulty_resolves_to_the_default_band(self):
        mock = AsyncMock(side_effect=RuntimeError("down"))
        with patch.object(script_generator, "_call_openrouter", mock):
            script = run(script_generator.generate_from_topic("Anything", "expert", 3))
        self._assert_full_and_in_band(script, "medium", 3)

    def test_step_count_is_clamped(self):
        mock = AsyncMock(side_effect=RuntimeError("down"))
        with patch.object(script_generator, "_call_openrouter", mock):
            self.assertEqual(
                len(run(script_generator.generate_from_topic("A", "easy", 0)).steps), 1
            )
            self.assertEqual(
                len(run(script_generator.generate_from_topic("A", "easy", 999)).steps), 40
            )


class PromptTests(unittest.TestCase):
    def test_prompt_states_the_band_numerically(self):
        band = get_band("hard")
        prompt = script_generator._build_prompt(
            "Public speaking", band, 5, "en-GB", ["θ", "ð"]
        )
        self.assertIn(str(band.min_words), prompt)
        self.assertIn(str(band.max_words), prompt)
        self.assertIn(str(band.max_syllables_per_word), prompt)
        self.assertIn("Public speaking", prompt)
        self.assertIn("en-GB", prompt)
        self.assertIn("θ", prompt)

    def test_avoid_list_is_included_on_retry(self):
        prompt = script_generator._build_prompt(
            "Topic", get_band("easy"), 5, "en-US", [], avoid=["Already used this."]
        )
        self.assertIn("Already used this.", prompt)

    def test_generation_uses_its_own_system_prompt(self):
        """The live-coaching prompt caps replies at three sentences, which would
        silently truncate every script."""
        captured = {}

        async def fake(prompt, **kwargs):
            captured.update(kwargs)
            return valid_batch("easy", 10)

        with patch.object(script_generator, "_call_openrouter", fake):
            run(script_generator.generate_from_topic("Cafes", "easy", 5))

        self.assertEqual(captured["system_override"], script_generator._SYSTEM_PROMPT)
        self.assertGreater(captured["max_tokens_override"], 0)


if __name__ == "__main__":
    unittest.main()
