"""The session engine executes the script it is given -- it picks nothing.

The old version of this file imported ``DAILY_SENTENCES`` / ``get_sentence_bank``
and asserted that a coach called "Daily Conversation Coach" produced a
particular hardcoded string. Content selection has moved out of the engine
entirely: the client sends a script that was generated, band-validated and
possibly hand-edited at session-creation time, and the engine's only jobs are to
execute it in order and to apply the tier's pass threshold.

So the tests are: does it run the steps it was handed, does it apply the right
threshold, and does it degrade sanely when a client sends no script at all.
"""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock

from app.api.routes.voice_websocket import EMPTY_SESSION_TEXT, VoiceSession
from app.schemas.websocket_messages import PracticeStepMessage, SessionConfigMessage
from app.services.practice_content import (
    DIFFICULTY_BANDS,
    FALLBACK_BANK,
    pass_threshold_for,
)

SCRIPT = [
    "The first step of the script.",
    "The second step of the script.",
    "The third step of the script.",
]


def run(coro):
    return asyncio.run(coro)


def make_session(**config) -> VoiceSession:
    """A configured session with a stubbed socket, via the real config handler."""
    ws = MagicMock()
    ws.send_text = AsyncMock()
    session = VoiceSession(ws, session_id="test_session")
    payload = {
        "type": "SESSION_CONFIG",
        "session_id": "test_session",
        "coach_name": "Test Coach",
        "steps": [{"index": i, "text": t} for i, t in enumerate(SCRIPT)],
    }
    payload.update(config)
    run(session.handle_session_config(SessionConfigMessage(**payload)))
    return session


def sent_messages(session: VoiceSession):
    return [json.loads(c.args[0]) for c in session.websocket.send_text.call_args_list]


class ConfigTests(unittest.TestCase):
    def test_engine_runs_the_supplied_script_verbatim(self):
        session = make_session()
        self.assertEqual(session.session_sentences, SCRIPT)
        self.assertEqual(session.current_sentence_index, 0)
        self.assertEqual(session.target_text, SCRIPT[0])
        self.assertEqual(session.current_sentence, SCRIPT[0])
        self.assertEqual(session.practice_mode, "sentence")

    def test_steps_are_sorted_by_index_not_by_arrival_order(self):
        session = make_session(
            steps=[
                {"index": 2, "text": SCRIPT[2]},
                {"index": 0, "text": SCRIPT[0]},
                {"index": 1, "text": SCRIPT[1]},
            ]
        )
        self.assertEqual(session.session_sentences, SCRIPT)

    def test_blank_steps_are_dropped(self):
        session = make_session(
            steps=[
                {"index": 0, "text": SCRIPT[0]},
                {"index": 1, "text": "   "},
                {"index": 2, "text": SCRIPT[2]},
            ]
        )
        self.assertEqual(session.session_sentences, [SCRIPT[0], SCRIPT[2]])

    def test_config_emits_the_first_practice_target(self):
        session = make_session(difficulty="easy")
        messages = sent_messages(session)
        self.assertEqual(len(messages), 1)
        target = messages[0]
        self.assertEqual(target["type"], "PRACTICE_TARGET")
        self.assertEqual(target["target_text"], SCRIPT[0])
        self.assertEqual(target["step_index"], 0)
        self.assertEqual(target["pass_threshold"], pass_threshold_for("easy"))
        self.assertEqual(target["progress"], {"current": 1, "total": 3})

    def test_reconfiguring_resets_progress(self):
        session = make_session()
        session._advance_practice(100)
        session.all_attempts.append({"score": 90})
        run(
            session.handle_session_config(
                SessionConfigMessage(
                    type="SESSION_CONFIG",
                    steps=[PracticeStepMessage(index=0, text="A brand new script step.")],
                )
            )
        )
        self.assertEqual(session.current_sentence_index, 0)
        self.assertEqual(session.completed_sentences, [])
        self.assertEqual(session.all_attempts, [])
        self.assertEqual(session.session_sentences, ["A brand new script step."])


class ThresholdTests(unittest.TestCase):
    def test_each_tier_takes_its_own_threshold(self):
        for name, band in DIFFICULTY_BANDS.items():
            session = make_session(difficulty=name)
            self.assertEqual(session.score_threshold, band.pass_threshold)

    def test_an_explicit_threshold_overrides_the_tier_default(self):
        session = make_session(difficulty="easy", pass_threshold=91.5)
        self.assertEqual(session.score_threshold, 91.5)

    def test_unknown_difficulty_is_rejected_by_the_wire_schema(self):
        # Difficulty is a Literal on SessionConfigMessage, so a typo can never
        # silently become "whatever the default band happens to be".
        with self.assertRaises(Exception):
            SessionConfigMessage(type="SESSION_CONFIG", difficulty="expert")

    def test_the_same_score_passes_easy_and_fails_medium(self):
        """The tiers have to actually behave differently, or they are cosmetic."""
        easy = make_session(difficulty="easy")
        self.assertTrue(easy._advance_practice(85)["advanced"])

        medium = make_session(difficulty="medium")
        self.assertFalse(medium._advance_practice(85)["advanced"])

    def test_a_score_at_the_threshold_passes(self):
        for name, band in DIFFICULTY_BANDS.items():
            session = make_session(difficulty=name)
            self.assertTrue(
                session._advance_practice(band.pass_threshold)["advanced"], name
            )

    def test_a_score_just_below_the_threshold_fails(self):
        for name, band in DIFFICULTY_BANDS.items():
            session = make_session(difficulty=name)
            self.assertFalse(
                session._advance_practice(band.pass_threshold - 0.01)["advanced"], name
            )


class ProgressionTests(unittest.TestCase):
    def test_a_failing_score_repeats_the_same_step(self):
        session = make_session(difficulty="medium")
        result = session._advance_practice(50)
        self.assertFalse(result["advanced"])
        self.assertFalse(result["completed_sentence"])
        self.assertFalse(result["session_complete"])
        self.assertEqual(session.current_sentence_index, 0)
        self.assertEqual(session.target_text, SCRIPT[0])
        self.assertEqual(session.completed_sentences, [])

    def test_a_passing_score_advances_and_resyncs_the_derived_fields(self):
        session = make_session(difficulty="medium")
        result = session._advance_practice(95)
        self.assertTrue(result["advanced"])
        self.assertTrue(result["completed_sentence"])
        self.assertFalse(result["session_complete"])
        self.assertEqual(session.current_sentence_index, 1)
        self.assertEqual(session.target_text, SCRIPT[1])
        self.assertEqual(session.current_sentence, SCRIPT[1])
        self.assertEqual(session.current_word_index, 0)
        self.assertEqual(session.current_words[0], "The")
        self.assertEqual(session.completed_sentences, [SCRIPT[0]])

    def test_the_last_step_completes_the_session(self):
        session = make_session(difficulty="medium")
        for i in range(len(SCRIPT) - 1):
            result = session._advance_practice(95)
            self.assertTrue(result["advanced"])
            self.assertFalse(result["session_complete"])
            self.assertEqual(session.current_sentence_index, i + 1)

        result = session._advance_practice(95)
        self.assertTrue(result["session_complete"])
        self.assertEqual(len(session.completed_sentences), len(SCRIPT))
        self.assertIn(str(len(SCRIPT)), result["message"])

    def test_next_and_prev_move_the_cursor_and_re_emit_the_target(self):
        session = make_session()
        session.websocket.send_text.reset_mock()

        run(session.handle_next_sentence())
        self.assertEqual(session.current_sentence_index, 1)
        self.assertEqual(sent_messages(session)[-1]["target_text"], SCRIPT[1])

        run(session.handle_prev_sentence())
        self.assertEqual(session.current_sentence_index, 0)
        self.assertEqual(sent_messages(session)[-1]["target_text"], SCRIPT[0])

    def test_prev_at_the_first_step_is_a_no_op(self):
        session = make_session()
        session.websocket.send_text.reset_mock()
        run(session.handle_prev_sentence())
        self.assertEqual(session.current_sentence_index, 0)
        self.assertEqual(sent_messages(session), [])

    def test_go_to_step_clamps_out_of_range_indexes(self):
        session = make_session()
        session._go_to_step(99)
        self.assertEqual(session.current_sentence_index, len(SCRIPT) - 1)
        session._go_to_step(-5)
        self.assertEqual(session.current_sentence_index, 0)


class ContextAndNotesTests(unittest.TestCase):
    STEPS = [
        {"index": 0, "text": SCRIPT[0], "note": "continues in the next step"},
        {"index": 1, "text": SCRIPT[1]},
        {"index": 2, "text": SCRIPT[2]},
    ]

    def test_custom_sessions_carry_the_surrounding_lines(self):
        session = make_session(source="custom", steps=self.STEPS)
        session.websocket.send_text.reset_mock()
        run(session.handle_next_sentence())
        target = sent_messages(session)[-1]
        self.assertEqual(target["context_before"], SCRIPT[0])
        self.assertEqual(target["context_after"], SCRIPT[2])

    def test_the_ends_of_a_custom_script_have_one_sided_context(self):
        session = make_session(source="custom", steps=self.STEPS)
        first = sent_messages(session)[-1]
        self.assertIsNone(first["context_before"])
        self.assertEqual(first["context_after"], SCRIPT[1])

    def test_coach_sessions_get_no_context(self):
        # Coach-generated steps are independent sentences, so neighbouring lines
        # would be noise rather than help.
        session = make_session(source="coach", steps=self.STEPS)
        target = sent_messages(session)[-1]
        self.assertIsNone(target["context_before"])
        self.assertIsNone(target["context_after"])

    def test_step_notes_are_relayed(self):
        session = make_session(source="custom", steps=self.STEPS)
        self.assertEqual(
            sent_messages(session)[-1]["note"], "continues in the next step"
        )
        session.websocket.send_text.reset_mock()
        run(session.handle_next_sentence())
        self.assertIsNone(sent_messages(session)[-1]["note"])


class DegradationTests(unittest.TestCase):
    def test_a_client_that_sends_no_steps_gets_the_tiered_bank(self):
        session = make_session(difficulty="hard", steps=[])
        self.assertEqual(len(session.session_sentences), 10)
        self.assertTrue(set(session.session_sentences) <= set(FALLBACK_BANK["hard"]))
        self.assertEqual(session.score_threshold, pass_threshold_for("hard"))

    def test_an_unconfigured_session_has_no_script_and_a_placeholder_target(self):
        ws = MagicMock()
        ws.send_text = AsyncMock()
        session = VoiceSession(ws)
        self.assertEqual(session.session_sentences, [])
        self.assertEqual(session.target_text, EMPTY_SESSION_TEXT)
        # `total` must never be zero -- the progress bar divides by it.
        self.assertEqual(session._practice_progress(), {"current": 1, "total": 1})

    def test_advance_on_an_unconfigured_session_reports_completion_not_a_crash(self):
        ws = MagicMock()
        ws.send_text = AsyncMock()
        session = VoiceSession(ws)
        result = session._advance_practice(100)
        self.assertTrue(result["session_complete"])


if __name__ == "__main__":
    unittest.main()
