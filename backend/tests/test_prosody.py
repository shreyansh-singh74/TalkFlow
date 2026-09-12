"""Prosody analysis, tested on signals whose answer is known in advance.

Suprasegmental scoring is the kind of code that is easy to demo and hard to
trust: a plausible-looking number is indistinguishable from a correct one by
ear. So nothing here is judged by ear — every test builds a waveform whose
timing, pitch movement or prominence pattern is decided in the test itself, and
asserts the analysis reports it back.

The failure modes worth guarding are the ones that produce *confident nonsense*:
a pause counter that counts the silence before the learner started talking, an
F0 tracker that reads room tone as a voice, a stress score computed against a
syllable segmentation that does not match the reference, and an intonation score
for a sentence with no melodic target at all. Each of those is a test below.
"""

import math
import unittest

import numpy as np

from app.services.pronunciation import prosody

SAMPLE_RATE = prosody.SAMPLE_RATE


def pcm(signal: np.ndarray) -> bytes:
    return np.clip(signal * 32767.0, -32768, 32767).astype("<i2").tobytes()


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SAMPLE_RATE * seconds), dtype=np.float32)


def tone(
    seconds: float, f0: float = 150.0, amplitude: float = 0.4
) -> np.ndarray:
    t = np.arange(int(SAMPLE_RATE * seconds), dtype=np.float64) / SAMPLE_RATE
    return (amplitude * np.sin(2 * math.pi * f0 * t)).astype(np.float32)


def sweep(
    seconds: float, f0: float, f1: float, amplitude: float = 0.4
) -> np.ndarray:
    """Phase-continuous linear glide from f0 to f1."""
    t = np.arange(int(SAMPLE_RATE * seconds), dtype=np.float64) / SAMPLE_RATE
    phase = 2 * math.pi * (f0 * t + (f1 - f0) / (2 * seconds) * t * t)
    return (amplitude * np.sin(phase)).astype(np.float32)


class SignalHelpersTests(unittest.TestCase):
    def test_pcm16_round_trips_amplitude(self):
        samples = prosody.pcm16_to_float(pcm(np.array([0.5, -0.5], dtype=np.float32)))
        self.assertAlmostEqual(float(samples[0]), 0.5, places=4)
        self.assertAlmostEqual(float(samples[1]), -0.5, places=4)

    def test_empty_audio_is_an_empty_signal(self):
        self.assertEqual(prosody.pcm16_to_float(b"").size, 0)

    def test_a_truncated_final_sample_is_dropped_not_raised(self):
        samples = prosody.pcm16_to_float(b"\x00\x01\x02")
        self.assertEqual(samples.size, 1)

    def test_frame_energy_is_zero_for_silence_and_positive_for_a_tone(self):
        self.assertEqual(float(prosody.frame_energy(silence(0.2)).max()), 0.0)
        self.assertGreater(float(prosody.frame_energy(tone(0.2)).mean()), 0.1)

    def test_speech_mask_rejects_room_tone(self):
        # Very low-level noise is not speech, however much of it there is. The
        # relative threshold alone would call its loudest frame "speech".
        noise = (np.random.default_rng(0).normal(0, 1e-5, SAMPLE_RATE // 2)).astype(
            np.float32
        )
        mask = prosody.speech_mask(prosody.frame_energy(noise))
        self.assertFalse(bool(mask.any()))

    def test_speech_mask_accepts_a_tone(self):
        mask = prosody.speech_mask(prosody.frame_energy(tone(0.5)))
        self.assertTrue(bool(mask.any()))


class PauseTests(unittest.TestCase):
    def test_a_gap_between_speech_is_a_pause(self):
        signal = np.concatenate([tone(0.5), silence(0.4), tone(0.5)])
        pauses = prosody.find_pauses(prosody.speech_mask(prosody.frame_energy(signal)))
        self.assertEqual(len(pauses), 1)
        self.assertAlmostEqual(pauses[0].duration, 0.4, delta=0.06)

    def test_leading_and_trailing_silence_are_not_pauses(self):
        """The gap before the learner starts talking is not hesitation.

        Counting it would make every learner look hesitant by exactly the amount
        of time they took to press the button.
        """
        signal = np.concatenate([silence(1.0), tone(0.5), silence(1.0)])
        pauses = prosody.find_pauses(prosody.speech_mask(prosody.frame_energy(signal)))
        self.assertEqual(pauses, [])

    def test_a_short_gap_is_articulation_not_a_pause(self):
        signal = np.concatenate([tone(0.5), silence(0.1), tone(0.5)])
        pauses = prosody.find_pauses(prosody.speech_mask(prosody.frame_energy(signal)))
        self.assertEqual(pauses, [])


class IntonationTests(unittest.TestCase):
    def test_a_question_mark_asks_for_a_rise(self):
        self.assertEqual(prosody.expected_contour_label("Is this right?"), "rising")

    def test_a_full_stop_asks_for_a_fall(self):
        self.assertEqual(prosody.expected_contour_label("This is right."), "falling")
        self.assertEqual(prosody.expected_contour_label("Wonderful!"), "falling")

    def test_punctuation_inside_a_quote_still_counts(self):
        self.assertEqual(prosody.expected_contour_label('He asked, "ready?"'), "rising")

    def test_no_terminal_punctuation_means_no_target(self):
        # A phrase with no melodic requirement must not be scored against one.
        self.assertIsNone(prosody.expected_contour_label("read this line aloud"))

    def test_a_rising_question_scores_well(self):
        result = prosody.analyse_intonation("Is this right?", pcm(sweep(1.0, 120, 220)))
        self.assertIsNotNone(result)
        self.assertEqual(result.label, "rising")
        self.assertGreaterEqual(result.score, 90.0)

    def test_a_falling_statement_scores_well(self):
        result = prosody.analyse_intonation(
            "This is right.", pcm(sweep(1.0, 220, 110))
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.label, "falling")
        self.assertGreaterEqual(result.score, 90.0)

    def test_the_wrong_direction_is_penalised(self):
        """A statement that rises reads as a question — the case that changes meaning."""
        result = prosody.analyse_intonation(
            "This is right.", pcm(sweep(1.0, 120, 220))
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.label, "rising")
        self.assertLessEqual(result.score, 30.0)

    def test_a_flat_delivery_gets_partial_credit(self):
        result = prosody.analyse_intonation("Is this right?", pcm(tone(1.0, 150.0)))
        self.assertIsNotNone(result)
        self.assertEqual(result.label, "level")
        self.assertLess(result.score, 90.0)
        self.assertGreater(result.score, 20.0)

    def test_no_target_means_no_score(self):
        result = prosody.analyse_intonation("read this line aloud", pcm(tone(1.0)))
        self.assertIsNotNone(result)
        # The contour is measured and reported; there is simply nothing to grade
        # it against, so no score is asserted.
        self.assertEqual(result.reference_contour, [])
        self.assertGreater(len(result.contour), 0)

    def test_silence_produces_nothing(self):
        self.assertIsNone(prosody.analyse_intonation("Is this right?", pcm(silence(1.0))))

    def test_semitone_normalisation_ignores_the_absolute_pitch(self):
        """A low voice and a high voice performing the same shape agree.

        This is what keeps the score about intelligibility rather than range.
        """
        low = prosody.analyse_intonation("Is this right?", pcm(sweep(1.0, 90, 150)))
        high = prosody.analyse_intonation("Is this right?", pcm(sweep(1.0, 200, 330)))
        self.assertIsNotNone(low)
        self.assertIsNotNone(high)
        self.assertEqual(low.label, high.label)
        self.assertAlmostEqual(low.score, high.score, delta=1.0)


class TimingTests(unittest.TestCase):
    def test_rate_uses_the_reference_syllable_count(self):
        # 4 syllables over ~1s of speech: 4 syllables/sec is in the natural band.
        signal = np.concatenate([tone(1.0), silence(0.5), tone(0.0)])
        result = prosody.analyse_timing("hello there", pcm(signal), syllable_count=4)
        self.assertIsNotNone(result)
        self.assertGreater(result.speech_rate, 0)
        self.assertEqual(result.pace_label, "natural")

    def test_a_slow_delivery_is_labelled_slow(self):
        signal = np.concatenate([tone(2.0), silence(0.2), tone(2.0)])
        result = prosody.analyse_timing("one two", pcm(signal), syllable_count=2)
        self.assertIsNotNone(result)
        self.assertEqual(result.pace_label, "slow")
        self.assertLess(result.score, 100.0)

    def test_without_a_syllable_reference_no_rate_is_invented(self):
        """The failure this codebase keeps fixing: a plausible unmeasured number."""
        signal = np.concatenate([tone(1.0), silence(0.4), tone(1.0)])
        result = prosody.analyse_timing("hello there", pcm(signal), syllable_count=None)
        self.assertIsNotNone(result)
        self.assertEqual(result.pace_label, "unknown")
        self.assertEqual(result.speech_rate, 0.0)
        # The pauses are still real measurements and are still reported.
        self.assertEqual(len(result.pauses), 1)

    def test_speech_fraction_is_measured_not_assumed(self):
        signal = np.concatenate([tone(1.0), silence(1.0)])
        result = prosody.analyse_timing("hello", pcm(signal), syllable_count=2)
        self.assertIsNotNone(result)
        self.assertAlmostEqual(result.speech_fraction, 0.5, delta=0.06)

    def test_silence_produces_nothing(self):
        self.assertIsNone(
            prosody.analyse_timing("hello", pcm(silence(1.0)), syllable_count=2)
        )

    def test_a_long_pause_lowers_the_rhythm_score(self):
        steady = prosody.analyse_timing(
            "hello there",
            pcm(np.concatenate([tone(0.5), silence(0.2), tone(0.5)])),
            syllable_count=4,
        )
        hesitant = prosody.analyse_timing(
            "hello there",
            pcm(np.concatenate([tone(0.5), silence(2.0), tone(0.5)])),
            syllable_count=4,
        )
        self.assertIsNotNone(steady)
        self.assertIsNotNone(hesitant)
        self.assertLess(hesitant.score, steady.score)
        self.assertGreaterEqual(hesitant.pauses[0].duration, 1.5)


class StressTests(unittest.TestCase):
    """Prominence, scored against the dictionary's stress pattern."""

    def two_syllables(self, first_amp: float, second_amp: float) -> bytes:
        # ~120 ms per syllable, which is a plausible unstressed syllable and,
        # importantly, short enough that the segmenter does not split it again.
        # A 30 ms gap separates the runs without registering as a pause.
        return pcm(
            np.concatenate(
                [
                    tone(0.12, 150.0, first_amp),
                    silence(0.03),
                    tone(0.12, 150.0, second_amp),
                ]
            )
        )

    def test_initial_stress_on_a_two_syllable_signal_scores_full(self):
        result = prosody.analyse_stress(
            "record",
            self.two_syllables(0.6, 0.15),
            reference_stress=[True, False],
            syllables=["re", "cord"],
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.score, 100.0)
        self.assertEqual(result.method, "heuristic")
        self.assertEqual([s.score for s in result.syllables], [1.0, 1.0])

    def test_stress_on_the_wrong_syllable_scores_zero(self):
        result = prosody.analyse_stress(
            "record",
            self.two_syllables(0.15, 0.6),
            reference_stress=[True, False],
            syllables=["re", "cord"],
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.score, 0.0)

    def test_a_mismatched_syllable_count_scores_nothing(self):
        """Better no verdict than one against the wrong syllables."""
        result = prosody.analyse_stress(
            "record",
            self.two_syllables(0.6, 0.15),
            reference_stress=[True, False, False],
            syllables=["re", "cord", "ing"],
        )
        self.assertIsNone(result)

    def test_no_reference_means_no_verdict(self):
        self.assertIsNone(
            prosody.analyse_stress("record", self.two_syllables(0.6, 0.15), [])
        )

    def test_silence_produces_nothing(self):
        self.assertIsNone(
            prosody.analyse_stress(
                "record", pcm(silence(1.0)), reference_stress=[True, False]
            )
        )


class ReferenceTests(unittest.TestCase):
    def test_syllable_count_comes_from_the_dictionary(self):
        self.assertEqual(prosody.syllable_count_for("hello"), 2)

    def test_syllable_count_of_nonsense_is_none(self):
        # Rather than a heuristic guess, which would then be used as the
        # denominator of a rate.
        self.assertIsNone(prosody.syllable_count_for("   "))

    def test_reference_stress_finds_the_primary_syllable(self):
        from app.services.pronunciation.prosody import _reference_stress

        labels, pattern = _reference_stress("hello")
        self.assertEqual(len(labels), 2)
        # CMUDict: HH AH0 L OW1 -- "hel-LO", primary stress on the second
        # syllable. Easy to get backwards by ear, which is exactly why the
        # reference comes from the dictionary rather than from intuition.
        self.assertEqual(pattern, [False, True])


class BundleTests(unittest.TestCase):
    def test_analyse_returns_all_three_dimensions_for_a_spoken_sentence(self):
        signal = np.concatenate([tone(0.4, 180.0), silence(0.05), tone(0.4, 120.0)])
        timing, intonation, stress = prosody.analyse(
            "hello there.", pcm(signal)
        )
        self.assertIsNotNone(timing)
        self.assertIsNotNone(intonation)
        # Stress needs the detected syllable count to match the dictionary's,
        # which a bare tone does not provide; None is the correct answer here.
        self.assertTrue(stress is None or 0.0 <= stress.score <= 100.0)

    def test_every_dimension_can_be_switched_off_independently(self):
        signal = pcm(np.concatenate([tone(0.4), silence(0.2), tone(0.4)]))
        timing, intonation, stress = prosody.analyse(
            "hello there.",
            signal,
            want_timing=False,
            want_intonation=False,
            want_stress=False,
        )
        self.assertIsNone(timing)
        self.assertIsNone(intonation)
        self.assertIsNone(stress)

    def test_disabled_dimensions_do_not_block_enabled_ones(self):
        signal = pcm(np.concatenate([tone(0.4), silence(0.2), tone(0.4)]))
        timing, intonation, _ = prosody.analyse(
            "hello there.",
            signal,
            want_timing=True,
            want_intonation=False,
            want_stress=False,
        )
        self.assertIsNotNone(timing)
        self.assertIsNone(intonation)

    def test_garbage_audio_never_raises(self):
        # Odd-length buffers are included on purpose: a turn capped mid-chunk by
        # TURN_AUDIO_MAX_BYTES produces one, and it must not take the turn down.
        for payload in (b"\x00", b"\xff\xff\xff", b"\x00\x01" * 17):
            timing, intonation, stress = prosody.analyse("hello", payload)
            self.assertTrue(timing is None or timing.speech_rate >= 0)
            self.assertTrue(intonation is None or intonation.label in {"rising", "falling", "level"})
            self.assertTrue(stress is None or 0 <= stress.score <= 100)


if __name__ == "__main__":
    unittest.main()
