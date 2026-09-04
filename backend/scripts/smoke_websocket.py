#!/usr/bin/env python3
"""End-to-end smoke test through the real `/ws/voice` WebSocket.

`scripts/smoke_pipeline.py` calls the services directly. This one goes through
the protocol the browser uses, which is the only way to exercise three things:

  1. **Chunked accumulation.** `handle_audio_chunk` appends chunk by chunk under
     `TURN_AUDIO_MAX_BYTES` and drops the remainder. Calling `pcm16le_to_text`
     directly skips that code entirely, so the cap fix is only really proven
     here. We send >10 s in 8 KiB chunks and look for the final word.
  2. **The empty-transcript path.** A silent turn must come back as a
     recoverable ERROR with *no* PRONUNCIATION_RESULT. It used to substitute the
     target sentence as the transcript and score ~100%.
  3. **That practice content comes from the client.** Scripts are generated,
     band-validated and edited at session-creation time and shipped down in
     `SESSION_CONFIG`. A unit test can assert the handler honours them; only
     this check proves the *running* server has no bank of its own to fall back
     to.
  4. **Which scorer the running server actually uses.** `method` on the wire is
     the ground truth; a unit test can only assert what the registry returns in
     process.

Usage:
    uvicorn main:app --host 127.0.0.1 --port 8000     # in another terminal
    python scripts/smoke_websocket.py [ws://host:port/ws/voice]

Shares the TTS cache in /tmp with smoke_pipeline.py. Exits non-zero on failure.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.smoke_pipeline import LONG_RATE, LONG_TEXT, SAMPLE_RATE, _synthesize

DEFAULT_URL = "ws://127.0.0.1:8000/ws/voice"
CHUNK_BYTES = 8192

# Substitutions a learner actually makes, keyed by the word they apply to. Used
# to build a deliberately mispronounced take on the practice step we supply. TH
# is the useful case: it is exactly the error the old text-proxy scorer could
# never see, because ASR normalises it away.
CORRUPTIONS = {
    "this": "zis",      # ð -> z
    "that": "zat",      # ð -> z
    "think": "sink",    # θ -> s
    "three": "sree",    # θ -> s
    "thoughtful": "soughtful",
}
# How the scorer may report the phone we broke, in either notation.
TH_PHONES = ("ð", "DH", "θ", "TH")

# A three-step script standing in for a segmented speech: mid-sentence cuts,
# a continuation note, and neighbouring lines to check the context strip.
SCRIPT_STEPS = [
    {
        "index": 0,
        "text": "We stopped measuring how busy people looked,",
        "note": "continues in the next step",
    },
    {"index": 1, "text": "and started measuring what actually shipped."},
    {"index": 2, "text": "It sounds obvious. It was not."},
]

# The easy tier's pass threshold, stated here rather than imported from
# app.services.practice_content on purpose: this script checks a running server,
# which may not be the source tree in front of us. An independent literal
# catches a band change that a shared import would silently agree with. It also
# pins the number that used to be a hardcoded 95 for every learner alike.
EASY_THRESHOLD = 80.0

# A step whose TH we can deliberately break. Supplied explicitly rather than
# fished out of the fallback bank, which is offline-degradation content the user
# should never normally see -- a smoke check must not depend on its wording.
MISPRO_STEPS = [{"index": 0, "text": "I think this approach is thoughtful."}]

# Noise between the messages we care about.
IGNORED = {"PING", "LLM_TEXT_CHUNK", "TTS_CHUNK", "AI_RESPONSE", "PARTIAL_TRANSCRIPT"}


async def recv_until(ws, wanted: set[str], timeout: float = 180.0) -> dict:
    """Next message whose type is in `wanted`, skipping streaming noise."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while True:
        remaining = deadline - loop.time()
        if remaining <= 0:
            raise TimeoutError(f"none of {sorted(wanted)} arrived within {timeout:.0f}s")
        raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
        if isinstance(raw, bytes):
            continue
        msg = json.loads(raw)
        kind = msg.get("type")
        if kind == "PING":
            await ws.send(json.dumps({"type": "PONG"}))
            continue
        if kind in wanted:
            return msg
        if kind not in IGNORED:
            print(f"    (saw {kind})")


async def send_turn(ws, turn_id: str, pcm: bytes) -> None:
    """One full turn, audio delivered the way the browser delivers it."""
    # `timestamp` is required by ControlMessage, and the server's outer handler
    # turns a validation error into a closed connection -- so send it.
    await ws.send(json.dumps({
        "type": "START_TURN", "turn_id": turn_id, "timestamp": 0.0,
    }))
    for off in range(0, len(pcm), CHUNK_BYTES):
        await ws.send(pcm[off : off + CHUNK_BYTES])
    await ws.send(json.dumps({
        "type": "END_TURN", "turn_id": turn_id, "timestamp": 0.0,
    }))


async def check_long_turn(ws) -> bool:
    """>10 s of audio, chunked, must arrive at the ASR intact."""
    print("=" * 72)
    print("1. Long turn survives chunked accumulation and the cap")
    print("=" * 72)

    pcm = _synthesize(LONG_TEXT, LONG_RATE, "long")
    seconds = len(pcm) / 2 / SAMPLE_RATE
    chunks = (len(pcm) + CHUNK_BYTES - 1) // CHUNK_BYTES
    print(f"  sending          : {seconds:.1f}s as {chunks} x {CHUNK_BYTES}B chunks")

    await send_turn(ws, "turn-long", pcm)
    msg = await recv_until(ws, {"FINAL_TRANSCRIPT", "ERROR"})
    if msg["type"] == "ERROR":
        print(f"  -> FAIL: server returned ERROR: {msg.get('message')!r}")
        return False

    transcript = msg["text"]
    print(f"  FINAL_TRANSCRIPT : {transcript!r}")

    # The tail word only survives if every chunk was kept. Under the old 5 s cap
    # the last two sentences never reached the model.
    if "afternoon" not in transcript.lower():
        print("  -> FAIL: tail word 'afternoon' missing -- audio truncated in transit")
        return False
    print("  -> PASS: tail word present; all chunks reached the ASR")

    # heard_text on the result message must carry the same full transcript.
    result = await recv_until(ws, {"PRONUNCIATION_RESULT", "ERROR"})
    if result["type"] == "ERROR":
        print(f"  -> FAIL: no result message: {result.get('message')!r}")
        return False
    print(f"  heard_text       : {result['heard_text']!r}")
    print(f"  method           : {result['method']}")
    print(f"  per_phoneme      : {len(result.get('per_phoneme') or [])} entries")

    ok = True
    if "afternoon" not in result["heard_text"].lower():
        print("  -> FAIL: heard_text is not the full transcript")
        ok = False
    if result["method"] != "acoustic":
        print(f"  -> FAIL: live server scored via {result['method']}, not acoustic")
        ok = False
    else:
        print("  -> PASS: the running server is on the acoustic path")
    return ok


async def check_silent_turn(ws) -> bool:
    """Silence must be a recoverable error, not a score."""
    print("\n" + "=" * 72)
    print("2. Silent turn returns ERROR and no score")
    print("=" * 72)

    await send_turn(ws, "turn-silent", b"\x00\x00" * (SAMPLE_RATE * 3))
    msg = await recv_until(ws, {"ERROR", "FINAL_TRANSCRIPT", "PRONUNCIATION_RESULT"})
    print(f"  first reply      : {msg['type']}")

    if msg["type"] == "PRONUNCIATION_RESULT":
        print(f"  -> FAIL: silence scored {msg['score']} -- the fake-transcript "
              "fallback is back")
        return False
    if msg["type"] == "FINAL_TRANSCRIPT":
        print(f"  -> FAIL: silence produced a transcript: {msg['text']!r}")
        return False

    print(f"  message          : {msg.get('message')!r}")
    print(f"  recoverable      : {msg.get('recoverable')}")
    if not msg.get("recoverable"):
        print("  -> FAIL: error is not marked recoverable; the UI will treat it as fatal")
        return False
    print("  -> PASS: recoverable error, no score emitted")
    return True


async def check_script_execution(ws) -> bool:
    """The server practises the client's steps, and nothing else."""
    print("\n" + "=" * 72)
    print("3. SESSION_CONFIG steps are what the server practises")
    print("=" * 72)

    await ws.send(json.dumps({
        "type": "SESSION_CONFIG",
        "session_id": "smoke-script",
        "coach_name": "Coach",
        "difficulty": "easy",
        "source": "custom",
        "steps": SCRIPT_STEPS,
    }))
    msg = await recv_until(ws, {"PRACTICE_TARGET"})
    print(f"  target_text      : {msg['target_text']!r}")
    print(f"  step_index       : {msg.get('step_index')}")
    print(f"  pass_threshold   : {msg.get('pass_threshold')}")
    print(f"  progress         : {msg.get('progress')}")
    print(f"  note             : {msg.get('note')!r}")

    ok = True
    if msg["target_text"] != SCRIPT_STEPS[0]["text"]:
        print("  -> FAIL: the server chose its own sentence -- content is still "
              "being selected server-side")
        ok = False
    else:
        print("  -> PASS: target is steps[0], verbatim")

    if msg.get("step_index") != 0:
        print(f"  -> FAIL: step_index is {msg.get('step_index')}, expected 0")
        ok = False

    if msg.get("pass_threshold") != EASY_THRESHOLD:
        print(f"  -> FAIL: pass_threshold is {msg.get('pass_threshold')}, expected "
              f"{EASY_THRESHOLD} for the easy tier")
        ok = False
    else:
        print("  -> PASS: threshold is the easy tier's, not a global constant")

    expected_progress = {"current": 1, "total": len(SCRIPT_STEPS)}
    if msg.get("progress") != expected_progress:
        print(f"  -> FAIL: progress {msg.get('progress')} does not describe a "
              f"{len(SCRIPT_STEPS)}-step script")
        ok = False

    if msg.get("note") != SCRIPT_STEPS[0]["note"]:
        print(f"  -> FAIL: step note not relayed (got {msg.get('note')!r})")
        ok = False

    # Walking forward must expose the surrounding lines, which is what makes
    # practising a pasted speech line-by-line comprehensible.
    await ws.send(json.dumps({"type": "NEXT_SENTENCE"}))
    second = await recv_until(ws, {"PRACTICE_TARGET", "SESSION_COMPLETE"})
    if second["type"] != "PRACTICE_TARGET":
        print("  -> FAIL: NEXT_SENTENCE ended a three-step session after one step")
        return False

    print(f"  step 2 target    : {second['target_text']!r}")
    print(f"  context_before   : {second.get('context_before')!r}")
    print(f"  context_after    : {second.get('context_after')!r}")
    if second["target_text"] != SCRIPT_STEPS[1]["text"]:
        print("  -> FAIL: NEXT_SENTENCE did not advance to steps[1]")
        ok = False
    if (second.get("context_before") != SCRIPT_STEPS[0]["text"]
            or second.get("context_after") != SCRIPT_STEPS[2]["text"]):
        print("  -> FAIL: a custom-source step arrived without its neighbours")
        ok = False
    else:
        print("  -> PASS: neighbouring lines travel with the step")

    # An explicit threshold -- an edited script, or a per-coach override -- has
    # to win over the tier default.
    await ws.send(json.dumps({
        "type": "SESSION_CONFIG",
        "session_id": "smoke-script",
        "coach_name": "Coach",
        "difficulty": "easy",
        "pass_threshold": 91.5,
        "steps": SCRIPT_STEPS,
    }))
    override = await recv_until(ws, {"PRACTICE_TARGET"})
    if override.get("pass_threshold") != 91.5:
        print(f"  -> FAIL: explicit pass_threshold ignored (got "
              f"{override.get('pass_threshold')})")
        ok = False
    else:
        print("  -> PASS: explicit pass_threshold overrides the tier default")
    return ok


async def check_mispronunciation(ws) -> bool:
    """Speak a supplied step wrong and expect TH flagged."""
    print("\n" + "=" * 72)
    print("4. A TH substitution is flagged on a real practice step")
    print("=" * 72)

    await ws.send(json.dumps({
        "type": "SESSION_CONFIG",
        "session_id": "smoke-mispro",
        "coach_name": "Coach",
        "difficulty": "medium",
        "steps": MISPRO_STEPS,
    }))
    msg = await recv_until(ws, {"PRACTICE_TARGET"})
    target = msg["target_text"]
    if target != MISPRO_STEPS[0]["text"]:
        print(f"  -> FAIL: server is practising {target!r}, not the step we sent")
        return False

    words = target.split()
    hit = next(
        (i for i, w in enumerate(words) if w.strip(".,!?").lower() in CORRUPTIONS),
        None,
    )
    if hit is None:
        print("  -> FAIL: MISPRO_STEPS no longer contains a corruptible word")
        return False
    spoken = " ".join(
        CORRUPTIONS[w.strip(".,!?").lower()] if i == hit else w
        for i, w in enumerate(words)
    )

    print(f"  target           : {target!r}")
    print(f"  speaking instead : {spoken!r}")

    pcm = _synthesize(spoken, 1.0, "ws_" + spoken.split()[0].lower())
    await send_turn(ws, "turn-mispro", pcm)

    msg = await recv_until(ws, {"PRONUNCIATION_RESULT", "ERROR"})
    if msg["type"] == "ERROR":
        print(f"  -> FAIL: {msg.get('message')!r}")
        return False

    print(f"  heard_text       : {msg['heard_text']!r}")
    print(f"  method           : {msg['method']}")
    print(f"  score            : {msg['score']}")
    for err in msg.get("errors") or []:
        print(f"    error          : {err}")
    for line in msg.get("feedback") or []:
        print(f"    feedback       : {line}")

    ok = True
    if msg["method"] != "acoustic":
        print(f"  -> FAIL: fell back to {msg['method']}")
        ok = False
    if any(str(e.get("expected", "")) in TH_PHONES for e in msg.get("errors") or []):
        print("  -> PASS: TH flagged over the wire")
    else:
        print("  -> FAIL: TH not flagged. Note the ASR normalises the *word* back to "
              "the target, so a text-only comparison cannot see this error at all -- "
              "only the acoustic path can.")
        ok = False
    return ok


async def run(url: str) -> int:
    import websockets

    print(f"connecting to {url}\n")
    async with websockets.connect(url, max_size=None, ping_interval=None) as ws:
        results = [
            await check_long_turn(ws),
            await check_silent_turn(ws),
            await check_script_execution(ws),
            await check_mispronunciation(ws),
        ]

    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} checks passed")
    return 1 if failed else 0


def main(argv: list[str]) -> int:
    url = argv[0] if argv else DEFAULT_URL
    try:
        return asyncio.run(run(url))
    except (OSError, TimeoutError) as exc:
        print(f"\nFAILED: {type(exc).__name__}: {exc}")
        print(f"Is the backend running on {url}?")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
