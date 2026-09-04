#!/usr/bin/env python3
"""End-to-end smoke test for the ASR + acoustic-scoring pipeline.

Run this after any change to ASR_MODEL_ID or ACOUSTIC_PHONEME_MODEL_ID. It
checks the things a unit test can't, because they only fail once real audio and
a real checkpoint are involved:

  1. **The audio cap.** Transcribes a >10 s utterance and shows whether the tail
     of the sentence survives. Under the old 5 s cap the back half of every
     practice sentence was silently dropped before the model ever saw it.
  2. **Vocab coverage.** Prints the recognizer's raw tokens next to their
     ARPAbet mapping, and fails on any phone token that maps to nothing.
     `ipa_to_arpabet` drops unknown symbols silently, which surfaces to the user
     as a phantom deletion rather than as an error.
  3. **Special-token leakage.** Fails if `[PAD]`/`[UNK]`-style tokens reach the
     mapper, where they would be interpreted as if they were IPA.
  4. **Silence is not a perfect score.** An empty transcript must not score
     ~100%. It used to: the code substituted the target sentence as the
     transcript, and the text proxy then compared the target against itself.
  5. **A real substitution is flagged.** Scores "I sink so" against the target
     "I think so" and looks for TH→S specifically. This is the one check the old
     text-proxy pipeline could never pass -- the ASR normalises "sink" back to
     "think" before any text comparison runs.

Reference audio is synthesised with the project's own Google TTS, so this
exercises the *pipeline*, not accent robustness: TTS is clean read speech.
Judging accuracy on accented, non-native, real-microphone audio needs recorded
learner speech (see the L2-ARCTIC calibration item in the roadmap).

Usage:
    python scripts/smoke_pipeline.py

Requires Google TTS credentials (same ones the app uses) and ffmpeg on PATH.
WAVs are cached under /tmp so reruns skip synthesis. Exits non-zero on failure.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import wave

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CACHE_DIR = "/tmp/talkflow_smoke"
SAMPLE_RATE = 16_000

# Long enough to exceed the *old* 5 s cap by a wide margin, which is the
# regression this guards. All four halves are real practice sentences, and
# between them they cover TH, CH, JH, and several diphthongs -- the tokens most
# likely to be mis-mapped by a new checkpoint.
LONG_TEXT = (
    "Three thoughtful students solved the problem. "
    "I worked on a challenging project recently. "
    "Please pronounce every syllable clearly. "
    "The weather changed throughout the afternoon."
)
# Slow enough to sit past 10 s, which is roughly learner pace.
LONG_RATE = 0.75
# The cap this replaced. Audio must exceed it, or the test proves nothing.
OLD_CAP_BYTES = SAMPLE_RATE * 2 * 5

TARGET_SHORT = "I think so"
MISPRONOUNCED_SHORT = "I sink so"


def _synthesize(text: str, rate: float, name: str) -> bytes:
    """TTS -> 16 kHz mono PCM16, cached on disk. Returns raw PCM (no header)."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    wav_path = os.path.join(CACHE_DIR, f"{name}.wav")

    if not os.path.exists(wav_path):
        from app.services.tts_service import tts_service

        if tts_service.client is None:
            raise SystemExit(
                "TTS client failed to initialise -- check Google credentials. "
                f"(Or drop a 16 kHz mono WAV at {wav_path} and rerun.)"
            )
        mp3 = tts_service.text_to_speech(text, lang="en-US", rate=rate)
        if not mp3:
            raise SystemExit(f"TTS returned no audio for {text!r}")

        mp3_path = os.path.join(CACHE_DIR, f"{name}.mp3")
        with open(mp3_path, "wb") as fh:
            fh.write(mp3)
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", mp3_path,
             "-ac", "1", "-ar", str(SAMPLE_RATE), "-sample_fmt", "s16", wav_path],
            check=True,
        )

    with wave.open(wav_path, "rb") as w:
        assert w.getnchannels() == 1, f"{wav_path}: expected mono"
        assert w.getframerate() == SAMPLE_RATE, f"{wav_path}: expected 16 kHz"
        assert w.getsampwidth() == 2, f"{wav_path}: expected 16-bit"
        return w.readframes(w.getnframes())


def _raw_tokens(pcm: bytes):
    """The recognizer's decode, but stopping short of ipa_to_arpabet.

    Deliberately mirrors ``recognize_phones`` rather than calling it: the point
    is to see the tokens *before* mapping, which is where silent drops happen.
    """
    import torch

    from app.services.pronunciation import phoneme_recognizer as pr

    x = pr._pcm16le_to_float(pcm)
    processor, model = pr._load()
    inputs = processor(x, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = model(**inputs).logits[0]
        max_probs, ids = torch.softmax(logits, dim=-1).max(dim=-1)

    blank_id = getattr(processor.tokenizer, "pad_token_id", None)
    blank_id = 0 if blank_id is None else int(blank_id)
    collapsed = pr._ctc_collapse(ids.cpu().numpy(), max_probs.cpu().numpy(), blank_id)
    return [
        (processor.tokenizer.convert_ids_to_tokens(int(i)), c) for i, c in collapsed
    ]


def check_long_utterance() -> bool:
    from app.core.config import settings
    from app.services.asr import pcm16le_to_text
    from app.services.pronunciation.phone_set import ipa_to_arpabet
    from app.services.pronunciation.phoneme_recognizer import _NON_PHONE_TOKENS

    print("=" * 72)
    print("1-3. Long utterance: cap, vocab coverage, token leakage")
    print("=" * 72)

    pcm = _synthesize(LONG_TEXT, LONG_RATE, "long")
    seconds = len(pcm) / 2 / SAMPLE_RATE
    cap_seconds = settings.TURN_AUDIO_MAX_BYTES / 2 / SAMPLE_RATE
    print(f"  audio            : {seconds:.1f}s ({len(pcm)} bytes)")
    print(f"  current cap      : {cap_seconds:.1f}s ({settings.TURN_AUDIO_MAX_BYTES} bytes)")
    print(f"  old cap          : {OLD_CAP_BYTES / 2 / SAMPLE_RATE:.1f}s ({OLD_CAP_BYTES} bytes)")
    print(f"  target text      : {LONG_TEXT}")

    ok = True
    if len(pcm) <= OLD_CAP_BYTES:
        print("  !! this audio fits inside the OLD cap, so it cannot demonstrate "
              "the fix -- lengthen LONG_TEXT or lower LONG_RATE")
        ok = False
    else:
        cut = (1 - OLD_CAP_BYTES / len(pcm)) * 100
        print(f"  under the old cap: {cut:.0f}% of this audio would have been discarded")
    if len(pcm) > settings.TURN_AUDIO_MAX_BYTES:
        print("  -> FAIL: this audio would be truncated by the current cap")
        ok = False

    # Time a second pass, not the first: the first call pays the model load, and
    # in production the model is warmed at startup.
    pcm16le_to_text(pcm)
    t0 = time.time()
    transcript = pcm16le_to_text(pcm)
    asr_ms = (time.time() - t0) * 1000
    print(f"\n  transcript       : {transcript!r}")
    print(f"  ASR pass (warm)  : {asr_ms:.0f}ms ({asr_ms / 1000 / seconds:.2f}x realtime)")

    # The tail is the tell: the old cap would cut this well before the last word.
    tail = "afternoon"
    if tail in transcript.lower():
        print(f"  tail word {tail!r}: present -- the whole utterance was transcribed")
    else:
        print(f"  -> FAIL: tail word {tail!r} missing; audio is being truncated")
        ok = False

    _raw_tokens(pcm)
    t0 = time.time()
    tokens = _raw_tokens(pcm)
    phon_ms = (time.time() - t0) * 1000
    print(f"  phoneme (warm)   : {phon_ms:.0f}ms ({phon_ms / 1000 / seconds:.2f}x realtime)")
    print(f"  turn total       : {(asr_ms + phon_ms) / 1000:.1f}s for {seconds:.1f}s of audio")

    print(f"\n  {len(tokens)} raw tokens -> ARPAbet:")
    leaked, dropped = [], []
    rendered = []
    for token, conf in tokens:
        if token in _NON_PHONE_TOKENS:
            if token not in ("|", " "):
                leaked.append(token)
            continue
        mapped = ipa_to_arpabet(token)
        if not mapped:
            dropped.append(token)
        rendered.append(f"{token}->{'/'.join(mapped) or '∅'}({conf:.2f})")
    print("    " + "  ".join(rendered))

    if leaked:
        print(f"\n  -> FAIL: special tokens reached the mapper: {sorted(set(leaked))}")
        ok = False
    else:
        print("\n  special tokens   : none leaked past the filter")

    if dropped:
        print(f"  -> FAIL: {len(dropped)} token(s) map to nothing and vanish "
              f"silently: {sorted(set(dropped))}")
        print("     Add them to _IPA_TO_ARPABET_RAW in phone_set.py.")
        ok = False
    else:
        print("  vocab coverage   : every phone token mapped")

    return ok


def check_silence() -> bool:
    from app.services.asr import pcm16le_to_text
    from app.services.pronunciation.registry import get_scorer

    print("\n" + "=" * 72)
    print("4. Silence must not score ~100%")
    print("=" * 72)

    silence = b"\x00\x00" * (SAMPLE_RATE * 3)
    transcript = pcm16le_to_text(silence)
    print(f"  transcript       : {transcript!r}")

    scorer = get_scorer()
    result = scorer.score(TARGET_SHORT, transcript, audio_pcm16=silence)
    print(f"  scorer           : {scorer.name} (method={result.method})")
    print(f"  score            : {result.score}")

    # The websocket handler returns early on an empty transcript, so this score
    # is never emitted in production. Assert it anyway: if it comes back high,
    # the fake-transcript substitution has crept back in somewhere.
    if transcript.strip():
        print("  !! silence produced a non-empty transcript -- unexpected, but not fatal")
    if result.score > 50:
        print(f"  -> FAIL: silence scored {result.score}")
        return False
    print("  -> PASS: silence scores low")
    return True


def check_substitution() -> bool:
    from app.services.asr import pcm16le_to_text
    from app.services.pronunciation.registry import get_scorer

    print("\n" + "=" * 72)
    print("5. A real TH->S substitution must be flagged")
    print("=" * 72)

    pcm = _synthesize(MISPRONOUNCED_SHORT, 1.0, "mispronounced")
    transcript = pcm16le_to_text(pcm)
    print(f"  target           : {TARGET_SHORT!r}")
    print(f"  spoken           : {MISPRONOUNCED_SHORT!r}")
    print(f"  ASR heard        : {transcript!r}")

    scorer = get_scorer()
    result = scorer.score(TARGET_SHORT, transcript, audio_pcm16=pcm)
    print(f"  scorer           : {scorer.name} (method={result.method})")
    print(f"  score            : {result.score}")
    for err in result.errors:
        print(f"    error          : {err}")
    for line in result.feedback:
        print(f"    feedback       : {line}")

    ok = True
    if result.method != "acoustic":
        print(f"  -> FAIL: fell back to {result.method}; the acoustic path did not run")
        ok = False

    # θ is how the scorer reports TH; accept either notation.
    flagged = any(
        str(err.get("expected", "")) in ("θ", "TH") for err in result.errors
    )
    if flagged:
        print("  -> PASS: TH flagged as an error")
    else:
        print("  -> FAIL: TH was not flagged. Either the recognizer heard θ where "
              "an /s/ was spoken, or the alignment is not reporting it.")
        ok = False
    return ok


def main() -> int:
    from app.core.config import settings

    print(f"ASR model     : {settings.ASR_MODEL_ID}")
    print(f"Phoneme model : {settings.ACOUSTIC_PHONEME_MODEL_ID}")
    print(f"Acoustic on   : {settings.ENABLE_ACOUSTIC_SCORING}\n")

    results = [check_long_utterance(), check_silence(), check_substitution()]

    rss_kb = int(
        open(f"/proc/{os.getpid()}/status").read().split("VmRSS:")[1].split()[0]
    )
    print(f"\nPeak-ish RSS after both models ran: {rss_kb // 1024} MB")

    failed = results.count(False)
    print(f"{len(results) - failed}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
