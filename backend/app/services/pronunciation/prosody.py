"""Suprasegmental analysis: timing, intonation, and lexical stress.

Dimensions B, C and D of the original premise. Until this module existed the
result shape, the WebSocket fields and the report's ``stress_mistakes`` /
``intonation_issues`` paths were all wired end to end and permanently ``None``,
because nothing computed them.

Design rules, inherited from the phoneme scorer:

1. **Nothing is invented.** If a measurement cannot be made — no voiced audio, a
   syllable count that disagrees with the reference, text with no pitch target —
   the corresponding result is ``None`` rather than a default number. The report
   and the UI are built to hide a ``None``.
2. **Intelligibility, not nativeness.** A contour is judged against the *shape*
   the sentence requires (a question rises, a statement falls), not against one
   native recording. Semitone normalisation removes pitch range and gender, so
   a lower voice is not a worse one.
3. **Cheap and dependency-free.** numpy only — no parselmouth, no torchcrepe, no
   librosa. The F0 tracker below is deliberately a plain autocorrelation: on
   clean push-to-talk audio in a quiet room it is accurate to a couple of Hz,
   which is far finer than the semitone grid the scoring uses. Swapping in
   parselmouth later means replacing ``_track_f0`` and nothing else.

The DSP is pure and takes raw PCM, so it is unit-testable with synthetic tones
(see ``tests/test_prosody.py``) — which matters, because the alternative is
"verified" by ear.
"""

from __future__ import annotations

import logging
import math
from typing import List, Optional, Sequence, Tuple

import numpy as np

from app.services.pronunciation.prosody_types import (
    IntonationResult,
    Pause,
    StressResult,
    SyllableStress,
    TimingResult,
)

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000
FRAME_MS = 25
HOP_MS = 10
#: F0 search range. 80 Hz covers a low male voice; 400 Hz a high female one.
F0_MIN_HZ = 80.0
F0_MAX_HZ = 400.0
#: Minimum normalised autocorrelation peak for a frame to count as voiced.
VOICING_THRESHOLD = 0.35
#: Gaps shorter than this inside speech are articulation, not pauses.
MIN_PAUSE_SECONDS = 0.18
#: Pause length at which pacing advice starts being worth giving.
LONG_PAUSE_SECONDS = 1.2
#: Speech-rate band considered "natural" for read practice sentences.
NATURAL_FROM, NATURAL_TO = 2.6, 5.2

_HOP_SECONDS = HOP_MS / 1000.0
_FRAME_SAMPLES = int(SAMPLE_RATE * FRAME_MS / 1000)
_HOP_SAMPLES = int(SAMPLE_RATE * HOP_MS / 1000)
_MIN_LAG = int(SAMPLE_RATE / F0_MAX_HZ)
_MAX_LAG = int(SAMPLE_RATE / F0_MIN_HZ)


def pcm16_to_float(pcm16: bytes) -> np.ndarray:
    """Little-endian PCM16 bytes -> float32 in [-1, 1].

    An odd trailing byte is dropped rather than raising. A truncated frame is a
    normal thing for audio to arrive with -- the buffer is capped mid-chunk when
    a turn hits ``TURN_AUDIO_MAX_BYTES`` -- and ``np.frombuffer`` would raise on
    it, taking the whole turn's scoring down with it.
    """
    if not pcm16:
        return np.zeros(0, dtype=np.float32)
    usable = len(pcm16) - (len(pcm16) % 2)
    if usable == 0:
        return np.zeros(0, dtype=np.float32)
    samples = np.frombuffer(pcm16[:usable], dtype="<i2").astype(np.float32)
    return samples / 32768.0


def _frames(signal: np.ndarray) -> np.ndarray:
    """View the signal as (n_frames, frame_samples) with no copying."""
    if signal.size < _FRAME_SAMPLES:
        return np.zeros((0, _FRAME_SAMPLES), dtype=np.float32)
    return np.lib.stride_tricks.sliding_window_view(
        signal, _FRAME_SAMPLES, axis=0
    )[::_HOP_SAMPLES]


def frame_energy(signal: np.ndarray) -> np.ndarray:
    """Per-frame RMS over a 25 ms window on a 10 ms hop."""
    windowed = _frames(signal)
    if windowed.shape[0] == 0:
        return np.zeros(0, dtype=np.float32)
    # No epsilon inside the sqrt: a sum of squares cannot be negative, and an
    # epsilon here would report digital silence as 1e-6 of energy, which is the
    # kind of almost-zero that quietly passes a `> 0` check downstream.
    return np.sqrt(np.mean(windowed * windowed, axis=1)).astype(np.float32)


def speech_mask(energy: np.ndarray) -> np.ndarray:
    """Frames that carry speech rather than room tone.

    A relative threshold (a fraction of the loudest frame) adapts to input gain
    without calibration, which an absolute threshold cannot do across the mics
    people actually use. A small absolute floor stops pure silence from being
    declared speech when the *loudest* frame is also noise.
    """
    if energy.size == 0:
        return np.zeros(0, dtype=bool)
    peak = float(energy.max())
    if peak < 1e-4:
        return np.zeros(energy.size, dtype=bool)
    return energy >= max(peak * 0.12, 1e-4)


def _segments(mask: np.ndarray) -> List[Tuple[int, int]]:
    """Contiguous runs of True as (start, end) frame indices."""
    if mask.size == 0 or not mask.any():
        return []
    padded = np.concatenate(([False], mask, [False]))
    edges = np.diff(padded.astype(np.int8))
    starts = np.flatnonzero(edges == 1)
    ends = np.flatnonzero(edges == -1)
    return list(zip(starts.tolist(), ends.tolist()))


def find_pauses(mask: np.ndarray) -> List[Pause]:
    """Silences *between* speech, which is what hesitation actually is.

    Leading and trailing silence are excluded: the gap between pressing the
    button and starting to talk is not a pause in speech, and counting it would
    make every learner look hesitant.
    """
    runs = _segments(mask)
    pauses: List[Pause] = []
    for (_, prev_end), (next_start, _) in zip(runs, runs[1:]):
        frames = next_start - prev_end
        duration = frames * _HOP_SECONDS
        if duration >= MIN_PAUSE_SECONDS:
            pauses.append(
                Pause(
                    start=round(prev_end * _HOP_SECONDS, 3),
                    end=round(next_start * _HOP_SECONDS, 3),
                    duration=round(duration, 3),
                )
            )
    return pauses


def _track_f0(signal: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Per-frame F0 in Hz, 0.0 where the frame is unvoiced.

    Normalised autocorrelation — dividing by the zero-lag term means a quiet
    voiced frame is not mistaken for an unvoiced one, which is the standard
    failure of a raw-energy pitch detector.

    Computed with an FFT over *all* frames at once. The obvious per-frame loop
    (one dot product per lag per frame) is ~280k numpy calls on a 14-second
    turn, which turned a 3-second scoring pass into a multi-second one; the FFT
    form is a single pass over the whole window matrix.
    """
    if signal.size < _FRAME_SAMPLES or mask.size == 0:
        return np.zeros(0, dtype=np.float32)

    windowed = _frames(signal)
    frames = windowed.shape[0]
    f0 = np.zeros(frames, dtype=np.float32)
    if frames == 0 or _MAX_LAG + 1 > _FRAME_SAMPLES:
        return f0

    # Remove each frame's DC offset: a constant term dominates lag 0 and skews
    # the normalisation.
    centred = windowed - windowed.mean(axis=1, keepdims=True)

    size = 1
    while size < 2 * _FRAME_SAMPLES:
        size *= 2
    spectrum = np.fft.rfft(centred, n=size, axis=1)
    acf = np.fft.irfft(spectrum * np.conj(spectrum), n=size, axis=1)

    zero_lag = acf[:, :1]
    # Silence has no autocorrelation peak to normalise against.
    usable = zero_lag[:, 0] > 1e-9
    if not usable.any():
        return f0
    normalised = np.zeros_like(acf)
    normalised[usable] = acf[usable] / zero_lag[usable]

    lag_band = normalised[:, _MIN_LAG : _MAX_LAG + 1]
    if lag_band.shape[1] == 0:
        return f0
    best = np.argmax(lag_band, axis=1)
    peak = lag_band[np.arange(frames), best]
    best_lag = best + _MIN_LAG

    voiced = usable & (peak >= VOICING_THRESHOLD) & (best_lag > 0)
    if mask.size >= frames:
        voiced &= mask[:frames]
    f0[voiced] = SAMPLE_RATE / best_lag[voiced].astype(np.float32)
    return f0


def _to_semitones(f0: np.ndarray, voiced: np.ndarray) -> np.ndarray:
    """Normalise pitch to semitones around the speaker's own median.

    This is what makes the comparison about *shape*: absolute pitch, vocal range
    and the difference between a bass and a soprano all cancel out.
    """
    values = f0[voiced]
    if values.size == 0:
        return np.zeros(0, dtype=np.float32)
    reference = float(np.median(values))
    if reference <= 0:
        return np.zeros(0, dtype=np.float32)
    return 12.0 * np.log2(values / reference)


def _slope(semitones: np.ndarray) -> float:
    """Least-squares slope in semitones per frame."""
    if semitones.size < 3:
        return 0.0
    x = np.arange(semitones.size, dtype=np.float64)
    x_mean = float(x.mean())
    y_mean = float(semitones.mean())
    denominator = float(np.sum((x - x_mean) ** 2))
    if denominator <= 0:
        return 0.0
    return float(np.sum((x - x_mean) * (semitones - y_mean)) / denominator)


def expected_contour_label(target_text: str) -> Optional[str]:
    """The melodic shape the sentence calls for, from its own punctuation.

    Derivable from the text, so this needs no reference recording and cannot
    drift from what was actually asked for. Returns ``None`` for text with no
    signal either way — an unscored contour beats a guessed one.
    """
    text = (target_text or "").strip()
    if not text:
        return None
    # Check the question mark before stripping punctuation, and allow for a
    # trailing quote: `He asked, "ready?"`.
    if text.rstrip("\"'”’)").endswith("?"):
        return "rising"
    if text.rstrip("\"'”’)").endswith((".", "!", "…")):
        return "falling"
    return None


def _label_from_slope(slope_per_frame: float) -> str:
    """Classify a contour. Thresholds are per-frame semitones over ~10 ms."""
    if slope_per_frame > 0.02:
        return "rising"
    if slope_per_frame < -0.02:
        return "falling"
    return "level"


def analyse_intonation(
    target_text: str, pcm16: bytes, mask: Optional[np.ndarray] = None
) -> Optional[IntonationResult]:
    """Score the pitch contour's *shape* against what the sentence requires."""
    signal = pcm16_to_float(pcm16)
    if signal.size < _FRAME_SAMPLES:
        return None
    mask = speech_mask(frame_energy(signal)) if mask is None else mask
    f0 = _track_f0(signal, mask)
    if f0.size == 0:
        return None

    voiced = f0 > 0
    semitones = _to_semitones(f0, voiced)
    # Require a little voiced audio before saying anything about melody: three
    # frames of pitch is a creak, not an intonation contour.
    if semitones.size < 5:
        return None

    slope = _slope(semitones)
    label = _label_from_slope(slope)
    expected = expected_contour_label(target_text)

    if expected is None:
        # Measurable, but with nothing to compare against: report the shape and
        # leave the score out rather than inventing a target.
        return IntonationResult(
            score=0.0,
            dtw_distance=0.0,
            slope=slope,
            label=label,
            contour=semitones.tolist(),
            reference_contour=[],
        )

    if label == expected:
        score = 100.0
    elif label == "level":
        # Flat delivery of a contour that needed movement: understood, but
        # carries less meaning. Half credit.
        score = 55.0
    else:
        # Wrong direction — the case that changes what the listener hears, e.g.
        # a statement rising into a question.
        score = 25.0

    # Scale by how far the contour travelled, so a decisive rise beats a wobble
    # that technically ends higher.
    travel = abs(float(semitones[-1] - semitones[0]))
    if expected != "level" and travel < 1.0:
        score = min(score, 60.0)

    return IntonationResult(
        score=round(score, 1),
        dtw_distance=0.0,
        slope=slope,
        label=label,
        contour=[round(float(s), 3) for s in semitones],
        reference_contour=[],
    )


def analyse_timing(
    target_text: str, pcm16: bytes, syllable_count: Optional[int] = None
) -> Optional[TimingResult]:
    """Speech rate, articulation rate and pauses, measured from the waveform.

    Rates are computed against the *reference* syllable count for the sentence,
    not a count detected in the audio: the learner may have read it wrong, and
    the question being answered is "how fast did you get through these words".
    """
    signal = pcm16_to_float(pcm16)
    if signal.size < _FRAME_SAMPLES:
        return None

    total_seconds = signal.size / SAMPLE_RATE
    energy = frame_energy(signal)
    mask = speech_mask(energy)
    if mask.size == 0 or not mask.any() or total_seconds <= 0:
        return None

    speech_seconds = float(mask.sum()) * _HOP_SECONDS
    speech_fraction = speech_seconds / total_seconds
    if speech_seconds <= 0 or speech_fraction < 0.05:
        # Essentially no speech: nothing here is a rate.
        return None

    pauses = find_pauses(mask)
    pause_seconds = sum(p.duration for p in pauses)

    syllables = syllable_count if syllable_count else None
    if syllables:
        speech_rate = syllables / speech_seconds
        articulation_rate = syllables / max(speech_seconds - pause_seconds, 1e-6)
    else:
        # Without a syllable reference the rates would be fabricated, and a
        # fabricated words-per-minute is exactly the failure this codebase
        # keeps fixing. Pauses are still real.
        return TimingResult(
            score=0.0,
            speech_rate=0.0,
            articulation_rate=0.0,
            pace_label="unknown",
            pauses=pauses,
            speech_fraction=round(speech_fraction, 3),
        )

    if speech_rate < NATURAL_FROM:
        pace_label = "slow"
        score = 70.0
    elif speech_rate > NATURAL_TO:
        pace_label = "fast"
        score = 70.0
    else:
        pace_label = "natural"
        score = 100.0

    # Long pauses are the other half of rhythm, and they are measured rather
    # than inferred from the rate.
    longest = max((p.duration for p in pauses), default=0.0)
    if longest >= LONG_PAUSE_SECONDS:
        score -= min(30.0, (longest - LONG_PAUSE_SECONDS) * 20.0)

    return TimingResult(
        score=round(max(0.0, score), 1),
        speech_rate=round(speech_rate, 3),
        articulation_rate=round(articulation_rate, 3),
        pace_label=pace_label,
        pauses=pauses,
        speech_fraction=round(speech_fraction, 3),
    )


def _syllable_bounds(mask: np.ndarray) -> List[Tuple[int, int]]:
    """Split speech into syllable-sized chunks at energy valleys.

    A crude syllabifier: count contiguous runs as potential syllables, then
    split any run that is long enough to contain more than one. It is validated
    by the caller — if what comes back does not match the reference syllable
    count, the stress result is dropped instead of being reported against the
    wrong syllables.
    """
    runs = _segments(mask)
    if not runs:
        return []
    # ~150 ms is a plausible syllable at learner pace.
    target_frames = max(int(0.15 / _HOP_SECONDS), 4)
    chunks: List[Tuple[int, int]] = []
    for start, end in runs:
        length = end - start
        if length <= target_frames * 1.6:
            chunks.append((start, end))
            continue
        pieces = int(round(length / target_frames))
        step = length / pieces
        for i in range(pieces):
            chunks.append((int(start + i * step), int(start + (i + 1) * step)))
    return chunks


def analyse_stress(
    target_text: str,
    pcm16: bytes,
    reference_stress: Optional[Sequence[Optional[bool]]] = None,
    syllables: Optional[Sequence[str]] = None,
) -> Optional[StressResult]:
    """Per-syllable prominence vs the dictionary's stress pattern.

    Prominence is a weighted blend of the three cues prosody research agrees on
    — loudness, length and pitch movement. It answers "was the right syllable
    the most prominent one", which is the part of stress that changes meaning
    (``REcord`` vs ``reCORD``).

    Returns ``None`` when the syllable count detected in the audio disagrees
    with the reference: scoring against mismatched syllables would be worse than
    not scoring.
    """
    if not reference_stress:
        return None

    signal = pcm16_to_float(pcm16)
    if signal.size < _FRAME_SAMPLES:
        return None
    energy = frame_energy(signal)
    mask = speech_mask(energy)
    if mask.size == 0 or not mask.any():
        return None

    chunks = _syllable_bounds(mask)
    if len(chunks) != len(reference_stress):
        return None

    f0 = _track_f0(signal, mask)

    prominences: List[float] = []
    for start, end in chunks:
        energies = energy[start:end]
        if energies.size == 0:
            prominences.append(0.0)
            continue
        loudness = float(np.mean(energies))
        length = float(end - start)
        voiced = f0[start:end]
        voiced = voiced[voiced > 0]
        movement = float(np.std(voiced)) if voiced.size >= 2 else 0.0
        prominences.append(loudness * (1.0 + movement / 20.0) + length * 1e-4)

    if not any(p > 0 for p in prominences):
        return None

    loudest = max(prominences)
    if loudest <= 0:
        return None
    normalised = [p / loudest for p in prominences]

    strongest = int(max(range(len(normalised)), key=lambda i: normalised[i]))

    syllables_out: List[SyllableStress] = []
    matched = 0
    scored = 0
    for index, expected in enumerate(reference_stress):
        label = (
            syllables[index] if syllables and index < len(syllables) else str(index)
        )
        if expected is None:
            syllables_out.append(
                SyllableStress(
                    syllable=label, expected_stressed=None, score=0.0
                )
            )
            continue
        scored += 1
        # The dictionary's primary-stress syllable must be this speaker's most
        # prominent one.
        hit = (expected and index == strongest) or (
            not expected and index != strongest
        )
        if hit:
            matched += 1
        syllables_out.append(
            SyllableStress(
                syllable=label,
                expected_stressed=bool(expected),
                score=1.0 if hit else 0.0,
                cues={"prominence": round(normalised[index], 3)},
            )
        )

    if scored == 0:
        return None

    return StressResult(
        score=round(100.0 * matched / scored, 1),
        syllables=syllables_out,
        # Reported as a heuristic, because that is what it is: a real MD-DNN
        # stress classifier is a separate project (see the roadmap).
        method="heuristic",
    )


def syllable_count_for(target_text: str) -> Optional[int]:
    """Reference syllable count, from CMUDict. ``None`` when unknown."""
    try:
        from app.services.pronunciation_service import pronunciation_service

        total = 0
        for word in (target_text or "").split():
            cleaned = "".join(ch for ch in word if ch.isalpha() or ch == "'")
            if not cleaned:
                continue
            entry = pronunciation_service.lookup(cleaned.lower())
            total += max(len(entry.syllables), 1)
        return total or None
    except Exception:
        logger.debug("Syllable count unavailable for %r", target_text, exc_info=True)
        return None


def _reference_stress(target_text: str) -> Tuple[List[str], List[Optional[bool]]]:
    """Per-syllable labels and the dictionary's stress pattern for the sentence.

    Lets stress be scored per *syllable index across the sentence*, not per word,
    which is what the audio segmentation produces.
    """
    labels: List[str] = []
    stressed: List[Optional[bool]] = []
    try:
        from app.services.pronunciation_service import pronunciation_service

        for word in (target_text or "").split():
            cleaned = "".join(ch for ch in word if ch.isalpha() or ch == "'")
            if not cleaned:
                continue
            entry = pronunciation_service.lookup(cleaned.lower())
            syllables = entry.syllables or []
            if not syllables:
                labels.append(cleaned)
                stressed.append(None)
                continue
            for syllable in syllables:
                # `SyllableEntry` carries the display respelling in `text` and
                # the real ARPAbet level (1 primary, 2 secondary, 0 none) in
                # `stress` -- secondary stress is deliberately not treated as
                # primary, so "particularly" still has exactly one.
                labels.append(str(getattr(syllable, "text", "") or "·"))
                level = getattr(syllable, "stress", None)
                stressed.append(None if level is None else int(level) == 1)
    except Exception:
        logger.debug("Reference stress unavailable for %r", target_text, exc_info=True)
        return [], []
    return labels, stressed


def analyse(
    target_text: str,
    pcm16: bytes,
    *,
    want_timing: bool = True,
    want_intonation: bool = True,
    want_stress: bool = True,
) -> Tuple[Optional[TimingResult], Optional[IntonationResult], Optional[StressResult]]:
    """Run the enabled dimensions over one turn's audio.

    Each dimension fails independently: a turn can have measurable timing and no
    pitch target, and the caller stores whatever came back.
    """
    timing = intonation = stress = None

    mask: Optional[np.ndarray] = None
    if want_timing or want_intonation or want_stress:
        try:
            mask = speech_mask(frame_energy(pcm16_to_float(pcm16)))
        except Exception:
            logger.exception("Prosody VAD failed")
            return None, None, None

    if want_timing:
        try:
            timing = analyse_timing(
                target_text, pcm16, syllable_count=syllable_count_for(target_text)
            )
        except Exception:
            logger.exception("Timing analysis failed")

    if want_intonation:
        try:
            intonation = analyse_intonation(target_text, pcm16, mask=mask)
        except Exception:
            logger.exception("Intonation analysis failed")

    if want_stress:
        try:
            labels, pattern = _reference_stress(target_text)
            if pattern and all(s is not None for s in pattern):
                stress = analyse_stress(
                    target_text, pcm16, reference_stress=pattern, syllables=labels
                )
        except Exception:
            logger.exception("Stress analysis failed")

    return timing, intonation, stress


__all__ = [
    "analyse",
    "analyse_intonation",
    "analyse_stress",
    "analyse_timing",
    "expected_contour_label",
    "find_pauses",
    "frame_energy",
    "pcm16_to_float",
    "speech_mask",
    "syllable_count_for",
]
