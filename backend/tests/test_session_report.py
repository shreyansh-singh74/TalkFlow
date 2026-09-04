"""The session report may only contain numbers that were measured.

This file exists because the previous version of ``generate_session_report``
invented most of its output. ``longest_pause`` was ``1.1 + (100 - score) * 0.015``.
``wpm`` fell back to a literal ``110.0``. ``difficult_sounds`` came from spelling
(``if "th" in word``), so it reported /θ/ for "the" and "with" whether or not
the speaker had any trouble with them. ``clarity_score`` was ``overall_score + 2``.

A learner reads these numbers as evidence about their own speech and decides what
to practise next, so a plausible-looking fabrication is worse than a blank. The
tests below are therefore mostly *negative*: given no measurement, the field must
come back ``None``.

``generate_coach_summary`` is patched throughout; nothing here touches the network.
"""

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.api.routes import voice_websocket as vw
from app.api.routes.voice_websocket import MIN_PHONE_OBSERVATIONS, VoiceSession
from app.schemas.websocket_messages import SessionConfigMessage
from app.services import llm_response

SCRIPT = ["Read this line aloud.", "Then read the next one."]


def run(coro):
    return asyncio.run(coro)


def phone(expected: str, correct: bool, accuracy: float | None = None) -> dict:
    return {
        "expected": expected,
        "is_correct": correct,
        "accuracy": accuracy if accuracy is not None else (95.0 if correct else 30.0),
    }


def attempt(
    score: float = 90.0,
    per_phoneme: list | None = None,
    heard: str = "read this line aloud",
    duration: float = 3.0,
    **extra,
) -> dict:
    """One entry shaped like the ones `_emit_pronunciation_result` appends."""
    base = {
        "sentence": SCRIPT[0],
        "heard": heard,
        "score": score,
        "errors": [],
        "feedback": [],
        "misaligned_words": [],
        "method": "acoustic",
        "per_phoneme": per_phoneme if per_phoneme is not None else [],
        "stress": None,
        "timing": None,
        "intonation": None,
        "duration": duration,
        "timestamp": 0.0,
    }
    base.update(extra)
    return base


class ReportTestCase(unittest.TestCase):
    """Base: a configured session plus a patched coach-summary call."""

    def make_session(self, attempts: list | None = None, **config) -> VoiceSession:
        ws = MagicMock()
        ws.send_text = AsyncMock()
        session = VoiceSession(ws, session_id="report_test")
        payload = {
            "type": "SESSION_CONFIG",
            "coach_name": "Test Coach",
            "steps": [{"index": i, "text": t} for i, t in enumerate(SCRIPT)],
        }
        payload.update(config)
        run(session.handle_session_config(SessionConfigMessage(**payload)))
        session.all_attempts = list(attempts or [])
        return session

    def report(self, session: VoiceSession) -> dict:
        with patch.object(
            vw, "generate_coach_summary", AsyncMock(return_value="Nice work.")
        ):
            return run(session.generate_session_report())


class EmptySessionTests(ReportTestCase):
    """A session where nobody spoke must report nothing, not zeroes."""

    NUMERIC_FIELDS = (
        "overall_score",
        "accuracy_score",
        "fluency_score",
        "wpm",
        "avg_pause_duration",
        "longest_pause",
        "total_speaking_time",
    )

    def test_every_measured_number_is_none(self):
        report = self.report(self.make_session())
        for field in self.NUMERIC_FIELDS:
            self.assertIsNone(report[field], field)

    def test_no_number_is_the_old_hardcoded_default(self):
        # The literals the old implementation reached for when it had no data.
        report = self.report(self.make_session())
        self.assertNotEqual(report["wpm"], 110.0)
        self.assertNotEqual(report["total_speaking_time"], 45.0)

    def test_lists_are_empty_rather_than_populated_with_guesses(self):
        report = self.report(self.make_session())
        self.assertEqual(report["difficult_sounds"], [])
        self.assertEqual(report["phone_breakdown"], [])
        self.assertEqual(report["mispronounced_words"], [])
        self.assertEqual(report["words_spoken"], 0)

    def test_the_script_is_still_described(self):
        # Step counts and the threshold are facts about the session, not
        # measurements of the speaker, so they survive an empty session.
        report = self.report(self.make_session(difficulty="easy"))
        self.assertEqual(report["sentences_total"], len(SCRIPT))
        self.assertEqual(report["sentences_completed"], 0)
        self.assertEqual(report["difficulty"], "easy")
        self.assertEqual(report["pass_threshold"], 80.0)
        self.assertIsNone(report["scoring_method"])


class DifficultSoundsTests(ReportTestCase):
    def test_ranked_by_error_rate_from_real_observations(self):
        # θ wrong 3/4, ð wrong 1/4, s never wrong.
        per_phoneme = (
            [phone("θ", False)] * 3
            + [phone("θ", True)]
            + [phone("ð", False)]
            + [phone("ð", True)] * 3
            + [phone("s", True)] * 4
        )
        report = self.report(self.make_session([attempt(per_phoneme=per_phoneme)]))

        self.assertEqual(report["difficult_sounds"], ["/θ/", "/ð/"])
        worst = report["phone_breakdown"][0]
        self.assertEqual(worst["phone"], "θ")
        self.assertEqual(worst["observations"], 4)
        self.assertEqual(worst["error_rate"], 0.75)

    def test_a_phone_never_missed_is_not_listed_as_difficult(self):
        report = self.report(
            self.make_session([attempt(per_phoneme=[phone("s", True)] * 6)])
        )
        self.assertEqual(report["difficult_sounds"], [])

    def test_a_thinly_observed_phone_is_not_promoted_to_a_verdict(self):
        """One bad token is noise, and telling someone to drill it is wrong."""
        thin = [phone("ʒ", False)] * (MIN_PHONE_OBSERVATIONS - 1)
        report = self.report(self.make_session([attempt(per_phoneme=thin)]))
        self.assertEqual(report["difficult_sounds"], [])

    def test_spelling_no_longer_drives_the_result(self):
        # The old heuristic keyed off "th" in the *text*. Here every TH word is
        # pronounced correctly and only /r/ is actually wrong.
        report = self.report(
            self.make_session([
                attempt(
                    heard="think that this thing through",
                    per_phoneme=[phone("θ", True)] * 4 + [phone("r", False)] * 4,
                )
            ])
        )
        self.assertEqual(report["difficult_sounds"], ["/r/"])

    def test_observations_accumulate_across_attempts(self):
        attempts = [attempt(per_phoneme=[phone("θ", False)]) for _ in range(3)]
        report = self.report(self.make_session(attempts))
        self.assertEqual(report["phone_breakdown"][0]["observations"], 3)

    def test_only_the_top_three_are_reported(self):
        per_phoneme = [
            phone(sym, False) for sym in "θðrlv" for _ in range(MIN_PHONE_OBSERVATIONS)
        ]
        report = self.report(self.make_session([attempt(per_phoneme=per_phoneme)]))
        self.assertEqual(len(report["difficult_sounds"]), 3)

    def test_strong_sounds_appear_as_a_strength(self):
        report = self.report(
            self.make_session([attempt(per_phoneme=[phone("s", True)] * 5)])
        )
        self.assertTrue(any("/s/" in s for s in report["strengths"]))


class ProsodyTests(ReportTestCase):
    """Stress, pause and intonation fields exist only when their scorers ran."""

    def test_pauses_are_none_without_vad_timing(self):
        report = self.report(self.make_session([attempt(score=40.0)]))
        self.assertIsNone(report["avg_pause_duration"])
        self.assertIsNone(report["longest_pause"])

    def test_a_low_score_does_not_manufacture_a_pause(self):
        """The old formula made a bad score *look* like hesitation."""
        low = self.report(self.make_session([attempt(score=10.0)]))
        high = self.report(self.make_session([attempt(score=99.0)]))
        self.assertIsNone(low["longest_pause"])
        self.assertIsNone(high["longest_pause"])

    def test_pauses_are_reported_when_vad_measured_them(self):
        timing = {"pauses": [{"duration": 0.4}, {"duration": 1.8}]}
        report = self.report(self.make_session([attempt(timing=timing)]))
        self.assertEqual(report["longest_pause"], 1.8)
        self.assertEqual(report["avg_pause_duration"], 1.1)
        self.assertTrue(
            any("1.8" in a for a in report["areas_to_improve"]),
            "a measured long pause should reach the advice list",
        )

    def test_stress_and_intonation_are_none_without_those_scorers(self):
        report = self.report(self.make_session([attempt()]))
        self.assertIsNone(report["stress_mistakes"])
        self.assertIsNone(report["syllable_mistakes"])
        self.assertIsNone(report["intonation_issues"])

    def test_stress_mistakes_separate_missed_from_misplaced(self):
        stress = {
            "syllables": [
                {"syllable": "ba", "expected_stressed": True, "score": 0.1},
                {"syllable": "na", "expected_stressed": False, "score": 0.2},
                {"syllable": "nuh", "expected_stressed": False, "score": 0.9},
            ]
        }
        report = self.report(self.make_session([attempt(stress=stress)]))
        self.assertEqual(report["stress_mistakes"], ["ba"])
        self.assertEqual(report["syllable_mistakes"], ["na"])

    def test_intonation_issues_only_list_low_scoring_contours(self):
        attempts = [
            attempt(intonation={"label": "falling", "score": 40.0}),
            attempt(intonation={"label": "rising", "score": 95.0}),
        ]
        report = self.report(self.make_session(attempts))
        self.assertEqual(len(report["intonation_issues"]), 1)
        self.assertIn("falling", report["intonation_issues"][0])


class SpeakingRateTests(ReportTestCase):
    def test_wpm_uses_vad_speech_time_when_available(self):
        # 4 words in 6s of clip, of which half was actual speech -> 80 wpm.
        report = self.report(
            self.make_session([
                attempt(
                    heard="one two three four",
                    duration=6.0,
                    timing={"speech_fraction": 0.5},
                )
            ])
        )
        self.assertEqual(report["total_speaking_time"], 3.0)
        self.assertEqual(report["wpm"], 80.0)

    def test_wpm_falls_back_to_clip_duration_without_vad(self):
        report = self.report(
            self.make_session([attempt(heard="one two three four", duration=6.0)])
        )
        self.assertEqual(report["total_speaking_time"], 6.0)
        self.assertEqual(report["wpm"], 40.0)

    def test_wpm_is_none_when_nothing_was_transcribed(self):
        report = self.report(self.make_session([attempt(heard="", duration=4.0)]))
        self.assertEqual(report["words_spoken"], 0)
        self.assertIsNone(report["wpm"])

    def test_wpm_is_none_when_no_time_elapsed(self):
        report = self.report(self.make_session([attempt(heard="one two", duration=0.0)]))
        self.assertIsNone(report["wpm"])


class DerivedScoreTests(ReportTestCase):
    def test_accuracy_comes_from_phone_scores_not_the_turn_score(self):
        report = self.report(
            self.make_session([
                attempt(score=100.0, per_phoneme=[phone("s", True, 60.0)] * 4)
            ])
        )
        self.assertEqual(report["overall_score"], 100.0)
        self.assertEqual(report["accuracy_score"], 60.0)

    def test_accuracy_is_none_under_the_text_proxy(self):
        # The text proxy emits no per_phoneme, so there is nothing to average.
        report = self.report(
            self.make_session([attempt(method="text_proxy", per_phoneme=[])])
        )
        self.assertIsNone(report["accuracy_score"])
        self.assertIsNone(report["fluency_score"])
        self.assertEqual(report["scoring_method"], "text_proxy")

    def test_fluency_rewards_consistency_over_a_high_mean(self):
        steady = self.report(
            self.make_session([attempt(per_phoneme=[phone("s", True, 70.0)] * 8)])
        )
        swinging = self.report(
            self.make_session([
                attempt(
                    per_phoneme=[phone("s", True, 100.0)] * 4
                    + [phone("s", True, 40.0)] * 4
                )
            ])
        )
        # Same mean, different spread.
        self.assertEqual(steady["accuracy_score"], swinging["accuracy_score"])
        self.assertEqual(steady["fluency_score"], 100.0)
        self.assertLess(swinging["fluency_score"], steady["fluency_score"])

    def test_overall_score_averages_the_attempts(self):
        report = self.report(
            self.make_session([attempt(score=80.0), attempt(score=90.0)])
        )
        self.assertEqual(report["overall_score"], 85.0)

    def test_the_invented_scores_are_gone(self):
        """`clarity_score` was overall+2 and `confidence_score` a pause formula."""
        report = self.report(self.make_session([attempt()]))
        self.assertNotIn("clarity_score", report)
        self.assertNotIn("confidence_score", report)


class WordAlignmentTests(ReportTestCase):
    def test_misaligned_words_are_bucketed_by_what_went_wrong(self):
        misaligned = [
            {"expected": "thorough", "heard": "torough"},  # mispronounced
            {"expected": "quickly", "heard": ""},          # skipped
            {"expected": "", "heard": "um"},               # inserted
        ]
        report = self.report(self.make_session([attempt(misaligned_words=misaligned)]))
        self.assertEqual(report["mispronounced_words"], ["thorough"])
        self.assertEqual(report["words_skipped"], ["quickly"])
        self.assertEqual(report["extra_inserted_words"], ["um"])

    def test_reading_everything_is_credited_as_a_strength(self):
        report = self.report(self.make_session([attempt()]))
        self.assertTrue(any("nothing dropped" in s for s in report["strengths"]))

    def test_skipped_words_produce_concrete_advice(self):
        report = self.report(
            self.make_session([
                attempt(misaligned_words=[{"expected": "quickly", "heard": ""}])
            ])
        )
        self.assertTrue(any("quickly" in a for a in report["areas_to_improve"]))


class CoachSummaryTests(ReportTestCase):
    def _capture(self, attempts: list) -> tuple[dict, dict]:
        captured = {}

        async def fake(**kwargs):
            captured.update(kwargs)
            return "Summary."

        session = self.make_session(attempts)
        with patch.object(vw, "generate_coach_summary", fake):
            return run(session.generate_session_report()), captured

    def test_measured_values_reach_the_summary(self):
        report, captured = self._capture(
            [attempt(score=91.0, per_phoneme=[phone("θ", False)] * 4)]
        )
        self.assertEqual(report["coach_feedback"], "Summary.")
        self.assertEqual(captured["overall"], 91.0)
        self.assertEqual(captured["difficult_sounds"], ["/θ/"])
        self.assertEqual(captured["wpm"], report["wpm"])

    def test_unmeasured_values_reach_the_summary_as_none(self):
        """None, not a stand-in figure -- the prompt then says "not measured"."""
        _, captured = self._capture([attempt(heard="", per_phoneme=[])])
        for field in ("wpm", "accuracy", "fluency"):
            self.assertIsNone(captured[field], field)

    def test_an_unmeasured_metric_is_labelled_as_such_in_the_prompt(self):
        """The LLM is told "not measured", so it cannot narrate a number.

        This is the last line of defence: the report itself is honest, but the
        coaching paragraph is free text, and a prompt that silently omitted a
        missing metric would invite the model to fill the gap.
        """
        prompt = llm_response._fmt_metric("Speaking rate", None, " words per minute")
        self.assertIn("not measured", prompt.lower())
        self.assertNotIn("0", prompt)

    def test_the_offline_summary_still_names_the_real_problem_sounds(self):
        # generate_coach_summary handles its own failures and returns a canned
        # paragraph; that paragraph must still be about this session.
        with patch.object(llm_response.settings, "OPENROUTER_API_KEY", ""):
            text = run(
                llm_response.generate_coach_summary(
                    coach_name="Coach",
                    coach_instructions="",
                    overall=88.0,
                    accuracy=None,
                    fluency=None,
                    wpm=None,
                    mispronounced_words=[],
                    difficult_sounds=["/θ/", "/r/"],
                )
            )
        self.assertIn("/θ/", text)
        # No key, so nothing was fetched -- and no number is asserted that the
        # offline path could not have known.
        self.assertNotIn("88", text)


if __name__ == "__main__":
    unittest.main()
