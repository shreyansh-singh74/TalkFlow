"""The tier threshold has to actually gate something.

The engine always knew how to advance on a pass (``_advance_practice`` was
covered by tests), but production never called it: ``handle_end_turn`` hardcoded
``"advanced": False`` and the only way forward was the client's "Next Level"
button, which advanced unconditionally. The pass threshold on every step was
therefore decoration -- a learner could click through a twelve-step script with
a 40% average and be told they completed it.

These tests pin the behaviour that makes the threshold real:

  * a passing turn moves the cursor by itself,
  * a failing turn leaves it alone and says why,
  * skipping is the explicit, recorded override,
  * and a session that ends early still produces the report it earned.

They also cover the two guards added at the same time: the per-connection turn
rate limit and the scoring timeout (a hung forward pass used to hang the socket
and leave the client on "Evaluating pronunciation..." forever).
"""

import asyncio
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.routes import voice_websocket as vw
from app.api.routes.voice_websocket import TurnScoringTimeout, VoiceSession
from app.core.config import settings
from app.schemas.websocket_messages import SessionConfigMessage
from app.services.pronunciation.base import PronunciationResult

SCRIPT = [
    "The first step of the script.",
    "The second step of the script.",
    "The third step of the script.",
]


def run(coro):
    return asyncio.run(coro)


def result(score: float, heard: str = "the first step of the script") -> PronunciationResult:
    return PronunciationResult(
        expected_phonemes=["DH", "AH"],
        actual_phonemes=["DH", "AH"],
        errors=[],
        score=score,
        feedback=["Nice."],
        method="acoustic",
        per_phoneme=[
            {"expected": "ð", "actual": "ð", "is_correct": True, "accuracy": score}
        ],
    )


class FakeScorer:
    """Stands in for the acoustic scorer; the score is set per-test."""

    name = "acoustic"

    def __init__(self, score: float):
        self.score_value = score

    def score(self, target_text, heard_text, audio_pcm16=None, accent=None):
        # `accent` is part of the scorer interface: the session's accent is
        # passed through so the result reports which reference it used.
        return result(self.score_value, heard_text)


async def _no_llm_stream(*_args, **_kwargs):
    """An empty LLM stream. Nothing here may touch the network."""
    for chunk in ():  # pragma: no cover - never yields
        yield chunk


async def _fallback_coach_line(*_args, fallback: str = "", **_kwargs) -> str:
    """Stand in for the contextual coach lines: return the outage fallback."""
    return fallback


def make_session(**config) -> VoiceSession:
    ws = MagicMock()
    ws.send_text = AsyncMock()
    ws.send_bytes = AsyncMock()
    session = VoiceSession(ws, session_id="gating_test")
    payload = {
        "type": "SESSION_CONFIG",
        "session_id": "gating_test",
        "coach_name": "Test Coach",
        "steps": [{"index": i, "text": t} for i, t in enumerate(SCRIPT)],
    }
    payload.update(config)
    run(session.handle_session_config(SessionConfigMessage(**payload)))
    ws.send_text.reset_mock()
    return session


def sent_messages(session: VoiceSession):
    return [json.loads(c.args[0]) for c in session.websocket.send_text.call_args_list]


def score_turn(session: VoiceSession, score: float, heard: str = "the first step"):
    """Run one scored turn through the real handler with a stubbed scorer.

    Audio is supplied (and ASR stubbed) because `handle_end_turn` treats an
    empty buffer as a silent turn and returns before scoring -- which is its own
    tested behaviour, and not what these cases are about.
    """
    session.turn_audio = bytearray(b"\x00\x01" * 4000)
    # A local .env can hold real OpenRouter and Google credentials. Patching
    # both keeps this suite offline, fast, and free.
    silent_tts = MagicMock()
    silent_tts.text_to_speech = MagicMock(return_value=b"")
    with (
        patch.object(vw, "get_scorer", lambda: FakeScorer(score)),
        patch.object(vw, "pcm16le_to_text", lambda _pcm: heard),
        patch.object(vw, "tts_service", silent_tts),
        patch.object(vw, "stream_llm_response", _no_llm_stream),
        patch.object(vw, "generate_coach_line", AsyncMock(side_effect=_fallback_coach_line)),
    ):
        return run(
            session.handle_end_turn(
                vw.ControlMessage(type="END_TURN", turn_id="t1", timestamp=0.0)
            )
        )


class AdvancementTests(unittest.TestCase):
    def test_a_passing_turn_advances_the_cursor_without_being_asked(self):
        session = make_session(difficulty="medium")
        score_turn(session, 95.0)

        self.assertEqual(session.current_sentence_index, 1)
        target = sent_messages(session)[-1]
        self.assertEqual(target["type"], "PRACTICE_TARGET")
        self.assertEqual(target["target_text"], SCRIPT[1])
        # The flag the client uses to keep the earned feedback on screen.
        self.assertTrue(target["advanced_from_pass"])

    def test_a_failing_turn_stays_on_the_same_step(self):
        session = make_session(difficulty="medium")
        score_turn(session, 40.0)

        self.assertEqual(session.current_sentence_index, 0)
        self.assertTrue(
            all(m["type"] != "PRACTICE_TARGET" for m in sent_messages(session)),
            "a failed step must not re-emit a target -- the step did not change",
        )

    def test_the_score_message_reports_what_happened_to_the_cursor(self):
        session = make_session(difficulty="medium")
        score_turn(session, 95.0)
        update = next(
            m["practice_update"]
            for m in sent_messages(session)
            if m["type"] == "PRONUNCIATION_RESULT"
        )
        self.assertTrue(update["advanced"])
        self.assertFalse(update["session_complete"])

    def test_the_tier_threshold_decides_the_same_score(self):
        easy = make_session(difficulty="easy")
        score_turn(easy, 85.0)
        self.assertEqual(easy.current_sentence_index, 1)

        medium = make_session(difficulty="medium")
        score_turn(medium, 85.0)
        self.assertEqual(medium.current_sentence_index, 0)

    def test_passing_the_last_step_completes_and_reports(self):
        session = make_session(difficulty="medium")
        for _ in range(len(SCRIPT)):
            score_turn(session, 95.0)

        kinds = [m["type"] for m in sent_messages(session)]
        self.assertIn("SESSION_COMPLETE", kinds)
        self.assertTrue(session.report_generated)
        self.assertEqual(len(session.completed_sentences), len(SCRIPT))

    def test_a_best_score_from_an_earlier_attempt_is_remembered(self):
        session = make_session(difficulty="medium")
        score_turn(session, 50.0)
        self.assertFalse(session.step_best_score.get(0, 0) >= session.score_threshold)
        score_turn(session, 96.0)
        self.assertGreaterEqual(session.step_best_score[0], session.score_threshold)


class SkipTests(unittest.TestCase):
    def test_skipping_moves_on_and_is_recorded(self):
        session = make_session(difficulty="medium")
        run(session.handle_skip_sentence())

        self.assertEqual(session.current_sentence_index, 1)
        self.assertEqual(session.skipped_steps, {0})
        target = sent_messages(session)[-1]
        self.assertEqual(target["target_text"], SCRIPT[1])
        self.assertFalse(target["advanced_from_pass"])

    def test_a_skipped_step_is_counted_in_the_report(self):
        session = make_session(difficulty="medium")
        score_turn(session, 95.0)
        run(session.handle_skip_sentence())

        with patch.object(vw, "generate_coach_summary", AsyncMock(return_value="ok")):
            report = run(session.generate_session_report())
        self.assertEqual(report["steps_skipped"], 1)
        self.assertEqual(report["skipped_step_indexes"], [1])


class FinalizeTests(unittest.TestCase):
    """Leaving early must still answer with a report, not silence."""

    def test_leaving_with_attempts_returns_a_report(self):
        session = make_session(difficulty="medium")
        score_turn(session, 60.0)  # did not pass, but was measured

        with patch.object(vw, "generate_coach_summary", AsyncMock(return_value="ok")):
            run(session.handle_finalize_session())

        complete = [
            m for m in sent_messages(session) if m["type"] == "SESSION_COMPLETE"
        ]
        self.assertEqual(len(complete), 1)
        self.assertEqual(complete[0]["report"]["overall_score"], 60.0)

    def test_leaving_with_nothing_scored_errors_instead_of_inventing_a_report(self):
        session = make_session(difficulty="medium")
        with patch.object(vw, "generate_coach_line", AsyncMock(side_effect=_fallback_coach_line)):
            run(session.handle_finalize_session())

        messages = sent_messages(session)
        self.assertNotIn("SESSION_COMPLETE", [m["type"] for m in messages])
        error = next(m for m in messages if m["type"] == "ERROR")
        self.assertTrue(error["recoverable"])
        self.assertIn("Nothing was scored", error["message"])

    def test_finalizing_twice_does_not_emit_two_reports(self):
        session = make_session(difficulty="medium")
        score_turn(session, 60.0)

        with patch.object(vw, "generate_coach_summary", AsyncMock(return_value="ok")):
            run(session.handle_finalize_session())
            run(session.handle_finalize_session())

        complete = [
            m for m in sent_messages(session) if m["type"] == "SESSION_COMPLETE"
        ]
        self.assertEqual(len(complete), 1)

    def test_skipping_past_the_last_step_with_nothing_scored_errors(self):
        session = make_session(difficulty="medium")
        with patch.object(vw, "generate_coach_line", AsyncMock(side_effect=_fallback_coach_line)):
            for _ in range(len(SCRIPT)):
                run(session.handle_skip_sentence())

        messages = sent_messages(session)
        self.assertNotIn("SESSION_COMPLETE", [m["type"] for m in messages])
        self.assertTrue(any(m["type"] == "ERROR" for m in messages))


class RateLimitTests(unittest.TestCase):
    def test_turns_beyond_the_limit_are_refused(self):
        session = make_session(difficulty="medium")
        session.turn_start_times = []

        with patch.object(settings, "MAX_TURNS_PER_MINUTE", 2):
            with patch.object(vw, "generate_coach_line", AsyncMock(side_effect=_fallback_coach_line)):
                for i in range(2):
                    run(
                        session.handle_start_turn(
                            vw.ControlMessage(
                                type="START_TURN", turn_id=f"t{i}", timestamp=0.0
                            )
                        )
                    )
                self.assertIs(session.turn_rejected, False)

                run(
                    session.handle_start_turn(
                        vw.ControlMessage(type="START_TURN", turn_id="t3", timestamp=0.0)
                    )
                )

        self.assertTrue(session.turn_rejected)
        error = next(m for m in sent_messages(session) if m["type"] == "ERROR")
        self.assertTrue(error["recoverable"])

    def test_a_refused_turn_discards_its_audio(self):
        session = make_session(difficulty="medium")
        session.turn_rejected = True
        session.turn_audio.clear()

        run(session.handle_audio_chunk(b"\x00\x01" * 500))
        self.assertEqual(len(session.turn_audio), 0)

        run(
            session.handle_end_turn(
                vw.ControlMessage(type="END_TURN", turn_id="t", timestamp=0.0)
            )
        )
        self.assertFalse(session.turn_rejected)
        self.assertEqual(session.total_turns, 0)

    def test_the_window_slides(self):
        session = make_session(difficulty="medium")
        session.turn_start_times = [0.0]  # an hour ago, in wall-clock terms

        with patch.object(settings, "MAX_TURNS_PER_MINUTE", 1):
            run(
                session.handle_start_turn(
                    vw.ControlMessage(type="START_TURN", turn_id="t", timestamp=0.0)
                )
            )
        self.assertFalse(session.turn_rejected)


class ScoringTimeoutTests(unittest.TestCase):
    def test_a_timeout_sends_a_recoverable_error_and_no_score(self):
        session = make_session(difficulty="medium")

        async def hang(*_args, **_kwargs):
            raise vw.TurnScoringTimeout("boom")

        session.turn_audio = bytearray(b"\x00\x01" * 4000)
        with (
            patch.object(session, "_emit_pronunciation_result", hang),
            patch.object(vw, "pcm16le_to_text", lambda _pcm: "the first step"),
        ):
            run(
                session.handle_end_turn(
                    vw.ControlMessage(type="END_TURN", turn_id="t1", timestamp=0.0)
                )
            )

        messages = sent_messages(session)
        self.assertNotIn("PRONUNCIATION_RESULT", [m["type"] for m in messages])
        error = next(m for m in messages if m["type"] == "ERROR")
        self.assertIn("not scored", error["message"])
        self.assertTrue(error["recoverable"])
        # Nothing was measured, so the step must not move.
        self.assertEqual(session.current_sentence_index, 0)


class AuthBindingTests(unittest.TestCase):
    def test_a_session_config_for_another_session_is_refused(self):
        from app.core.ws_auth import WSClaims

        ws = MagicMock()
        ws.send_text = AsyncMock()
        session = VoiceSession(
            ws,
            claims=WSClaims(user_id="u1", session_id="mine", exp=2**31),
        )
        run(
            session.handle_session_config(
                SessionConfigMessage(
                    type="SESSION_CONFIG", session_id="someone-elses", steps=[]
                )
            )
        )

        self.assertEqual(session.session_sentences, [])
        error = next(m for m in sent_messages(session) if m["type"] == "ERROR")
        self.assertFalse(error["recoverable"])

    def test_the_token_supplies_the_practice_session_id(self):
        from app.core.ws_auth import WSClaims

        ws = MagicMock()
        ws.send_text = AsyncMock()
        session = VoiceSession(
            ws, claims=WSClaims(user_id="u1", session_id="mine", exp=2**31)
        )
        self.assertEqual(session.practice_session_id, "mine")


if __name__ == "__main__":
    unittest.main()
