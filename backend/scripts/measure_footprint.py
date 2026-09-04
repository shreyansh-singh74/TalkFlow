#!/usr/bin/env python3
"""Measure RSS + latency for one deployment config, on a chosen CPU budget.

Written to size a host, not to test correctness. The numbers in the READMEs were
taken on a 20-core dev box with torch defaulting to 14 threads; a 2-vCPU VPS is a
different machine. Run one config per process so RSS is attributable.

    python scripts/measure_footprint.py --threads 2
    python scripts/measure_footprint.py --threads 2 --int8
    python scripts/measure_footprint.py --threads 2 \
        --asr-model patrickvonplaten/wavlm-libri-clean-100h-base-plus

Reports VmRSS (steady state) and VmHWM (peak, including load-time transients),
plus the transcript so a cheaper config can be checked for accuracy loss rather
than assumed equivalent. Reads the WAV smoke_pipeline.py caches in /tmp.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import wave

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

WAV = "/tmp/talkflow_smoke/long.wav"


def mem(key: str) -> int:
    """VmRSS or VmHWM in MB."""
    with open("/proc/self/status") as fh:
        for line in fh:
            if line.startswith(key):
                return int(line.split()[1]) // 1024
    return -1


def quantize(model, skip_attention: bool = False):
    """Dynamic int8 on Linear layers -- the bulk of a transformer's weights.

    Note this runs *after* an fp32 load, so VmHWM captures both copies. A deploy
    that cared would quantize once and save the result.

    `skip_attention` is required for WavLM: `WavLMAttention` hand-rolls its
    attention to inject gated relative position bias, and reads
    `self.q_proj.bias` as a *tensor attribute*. Quantized Linear exposes `bias`
    as a method, so quantizing the projections raises
    `TypeError: expected Tensor as element 0 ... but got method` on the first
    forward. The feed-forward Linears are ~2/3 of the Linear parameters anyway.
    """
    import torch

    try:
        from torch.ao.quantization import default_dynamic_qconfig, quantize_dynamic
    except ImportError:
        from torch.quantization import default_dynamic_qconfig, quantize_dynamic

    if not skip_attention:
        return quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)

    attn = ("q_proj", "k_proj", "v_proj", "out_proj")
    spec = {
        name: default_dynamic_qconfig
        for name, mod in model.named_modules()
        if isinstance(mod, torch.nn.Linear) and not any(a in name for a in attn)
    }
    return quantize_dynamic(model, spec, dtype=torch.qint8)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--threads", type=int, default=0, help="torch threads; 0 = default")
    ap.add_argument("--asr-model", default=None, help="override ASR_MODEL_ID")
    ap.add_argument("--int8", action="store_true", help="dynamic-quantize both models")
    ap.add_argument("--skip-phoneme", action="store_true")
    ap.add_argument("--seconds", type=float, default=0.0,
                    help="truncate audio to N s; peak RSS is activation-dominated, "
                         "so this is the cap/memory trade-off dial")
    args = ap.parse_args()

    if args.asr_model:
        os.environ["ASR_MODEL_ID"] = args.asr_model

    import torch

    if args.threads:
        torch.set_num_threads(args.threads)

    from app.core.config import settings

    with wave.open(WAV, "rb") as w:
        pcm = w.readframes(w.getnframes())
        rate = w.getframerate()
    if args.seconds:
        pcm = pcm[: int(args.seconds * rate) * 2]
    seconds = len(pcm) / 2 / rate

    out = {
        "asr_model": settings.ASR_MODEL_ID,
        "threads": torch.get_num_threads(),
        "int8": args.int8,
        "audio_s": round(seconds, 1),
    }

    from app.services import asr

    t0 = time.time()
    asr._load()
    out["asr_load_s"] = round(time.time() - t0, 1)
    out["asr_class"] = type(asr._model).__name__
    if args.int8:
        t0 = time.time()
        # WavLM cannot take quantized attention projections; see quantize().
        asr._model = quantize(asr._model, skip_attention="wavlm" in out["asr_class"].lower())
        out["asr_quantize_s"] = round(time.time() - t0, 1)
    out["rss_after_asr_mb"] = mem("VmRSS")

    asr.pcm16le_to_text(pcm)  # warm: first pass allocates workspace buffers
    t0 = time.time()
    out["transcript"] = asr.pcm16le_to_text(pcm)
    out["asr_ms"] = int((time.time() - t0) * 1000)

    if not args.skip_phoneme:
        from app.services.pronunciation import phoneme_recognizer as pr

        t0 = time.time()
        pr._load()
        out["phoneme_load_s"] = round(time.time() - t0, 1)
        if args.int8:
            pr._model = quantize(pr._model)
        pr.recognize_phones(pcm)
        t0 = time.time()
        out["phones"] = len(pr.recognize_phones(pcm))
        out["phoneme_ms"] = int((time.time() - t0) * 1000)

    out["turn_s"] = round((out["asr_ms"] + out.get("phoneme_ms", 0)) / 1000, 1)
    out["realtime_factor"] = round(out["turn_s"] / seconds, 2)
    out["rss_steady_mb"] = mem("VmRSS")
    out["rss_peak_mb"] = mem("VmHWM")

    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
