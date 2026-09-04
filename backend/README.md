# TalkFlow Backend

FastAPI service for realtime voice practice and pronunciation analysis.

## Runtime

- `/ws/voice`: WebSocket voice session. Receives PCM16 audio chunks, uses WavLM CTC for transcription, OpenRouter for LLM responses, Google Cloud TTS for audio replies, and emits pronunciation feedback.
- `/api/phonemes/*`: HTTP pronunciation utilities for sentence analysis, word analysis, IPA lookup, comparison, and reference syllables.
- `/health`: service health check.

The old multipart `/transcribe` and `/clear-conversation` HTTP flow has been removed.

## Environment

```env
FRONTEND_URL=http://localhost:3000
OPENROUTER_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
# or GOOGLE_CREDENTIALS_JSON=<base64-json>
ENABLE_ASR=1
WARM_ASR_ON_STARTUP=1
ASR_MODEL_ID=patrickvonplaten/wavlm-libri-clean-100h-large
TURN_AUDIO_MAX_BYTES=480000
ENABLE_ACOUSTIC_SCORING=1
WARM_ACOUSTIC_ON_STARTUP=1
ACOUSTIC_PHONEME_MODEL_ID=vitouphy/wav2vec2-xls-r-300m-timit-phoneme
```

## Models

| Role | Default checkpoint | Why |
|---|---|---|
| ASR (words) | `patrickvonplaten/wavlm-libri-clean-100h-large` | WavLM-Large: 94k h of SSL pretraining (Libri-Light + GigaSpeech + VoxPopuli) with utterance mixing. Chosen for robustness on accented, noisy, real-microphone audio rather than clean read-speech WER. |
| Phonemes (scoring) | `vitouphy/wav2vec2-xls-r-300m-timit-phoneme` | 8.0% CER; its 42-token vocab maps ~1:1 onto the ARPAbet reference from `g2p_en` (diphthongs and affricates are single tokens). |

Both load via `AutoProcessor`/`AutoModelForCTC`, so swapping checkpoints is an
env-var change. Two constraints on any replacement:

1. **It must have a CTC head.** `microsoft/wavlm-*` are `WavLMModel`
   (feature-extraction only) — loading one into a CTC class yields a randomly
   initialised LM head and pure noise, despite what the HF docs example shows.
   Verify with the tensor-count check below.
2. **Its phone inventory must map onto ARPAbet.** Add any unmapped IPA symbols to
   `_IPA_TO_ARPABET_RAW` in `app/services/pronunciation/phone_set.py`, or
   `ipa_to_arpabet` drops them silently and the user sees phantom deletions.
   `tests/test_pronunciation_scoring.py` pins the default vocab for this reason.

Verify that a checkpoint's weights match the class `AutoModelForCTC` will build
from them (it dispatches on `model_type`, ignoring `architectures`):

```bash
python scripts/verify_checkpoints.py
```

With no arguments it checks the two configured models. Pass repo ids to check
others. `microsoft/wavlm-large` fails it with 2 tensors missing — the CTC head.

Then check the pipeline against real audio — the cap, vocab coverage, token
leakage, silence handling, and whether a TH→S substitution is actually flagged:

```bash
python scripts/smoke_pipeline.py
```

And the same properties through the real WebSocket, which additionally covers
chunked accumulation in `handle_audio_chunk`, the empty-transcript early return,
and which scorer the running server reports on the wire:

```bash
python scripts/smoke_websocket.py
```

Both need Google TTS credentials and ffmpeg, and share a WAV cache under `/tmp`;
`smoke_websocket.py` needs the server already running. Unit tests can't cover
these — they only fail once a real checkpoint and real audio are involved.
Measured 2026-09-01 on a 13.8 s utterance, both models warm: ASR 2.7 s,
phonemes 2.3 s, **3.6 GB peak RSS**.

## Deploying on a small VPS

The figures in `## Models` were taken on a 20-core dev box where torch used 14
threads. A 2-vCPU VPS is a different machine. Measured on the same 13.8 s clip
with `torch.set_num_threads(2)` (`scripts/measure_footprint.py`):

| ASR checkpoint | Peak RSS (server) | ASR | Phoneme | Turn | Transcript |
|---|---|---|---|---|---|
| `...-100h-large` (default) | 3653 MB | 3.21 s | 3.14 s | 6.4 s | clean |
| `...-100h-base-plus` | **2752 MB** | **1.12 s** | 2.81 s | **3.9 s** | 3 minor slips |

**On a 4 GB host, use `base-plus`.** `large` leaves under 350 MB for the OS and
will OOM. base-plus is also 2.9× faster on ASR, which matters more on 2 vCPUs
than the transcript difference does — because **the pronunciation score does not
come from the transcript.** `AcousticScorer` reads `heard_text` only on its
fallback paths; the score is computed from the raw waveform against the target's
phoneme reference. Verified: switching to base-plus left the scored result
byte-identical (89.57, same `ð → z` error, same feedback) while the displayed
transcript degraded from `"solved the problem"` to `"solve the problem"`.

```env
ASR_MODEL_ID=patrickvonplaten/wavlm-libri-clean-100h-base-plus
```

Also worth doing on a CPU-only host:

- **Install CPU-only torch.** `pip install torch --index-url
  https://download.pytorch.org/whl/cpu`. The default wheel here is `+cu130` —
  1.2 GB of CUDA libraries that never run.
- **Pin threads** to the vCPU count (`OMP_NUM_THREADS=2` plus
  `torch.set_num_threads(2)`) so torch and uvicorn don't oversubscribe.
- **Add swap** as an OOM backstop, not as working memory — paging a live
  forward pass is far slower than the request timeout.
- **Watch CPU burst capacity.** Lightsail general-purpose instances are
  burstable: they run in a "sustainable zone" indefinitely but a sustained
  burst eventually throttles to baseline. A turn pegs both vCPUs for ~4 s, so
  concurrent users are what will push you into the burstable zone. AWS does not
  publish per-plan baselines — monitor `BurstCapacityPercentage`.

**int8 dynamic quantization is not a shortcut here.** Two findings: (1) it
raises peak RSS to 6.2 GB, because quantizing an already-loaded fp32 model keeps
both copies resident — you'd have to quantize once and ship the artifact; and
(2) it needs `skip_attention` on WavLM, whose hand-rolled attention reads
`q_proj.bias` as a tensor attribute that quantized Linear exposes as a method.
See `quantize()` in `scripts/measure_footprint.py`.

## Install

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Test

```bash
python -m unittest discover -s tests
```

## API Smoke Checks

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/phonemes/reference/hello
```

The frontend should connect to `NEXT_PUBLIC_BACKEND_URL/ws/voice`.
