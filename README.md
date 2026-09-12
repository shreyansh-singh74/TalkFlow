# TalkFlow

**An AI speaking coach that scores how clearly you actually spoke — from your voice, not your transcript.**

Most conversation apps rank you on *what* you said. TalkFlow records each turn,
runs a phoneme recogniser over the raw waveform, aligns what you produced against
what the sentence requires, and tells you which specific sound you missed and how
to fix it. Then it does it again in the next sentence, and tracks which sounds
keep failing across sessions.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle · Postgres
(Better Auth) — FastAPI · WavLM ASR · phoneme-CTC acoustic scoring · OpenRouter ·
Google Cloud TTS.

---

## Why this is not another "AI conversation partner"

There is a subtle failure that makes most pronunciation feedback worthless, and
TalkFlow exists because of it.

A word-level ASR system is trained to emit *real words*. If you say **"tink"**, it
transcribes **"think"**. So if you grade pronunciation by comparing the transcript
against the target text, the error is corrected away *before* your comparison
runs — the system confirms what you meant to say, not what you said. No choice of
ASR model fixes this; it is structural.

The proof, from the project's own smoke test over the real WebSocket:

> Target `"Let us try that phrase again."`, spoken as `"...try zat phrase..."`.
> The ASR normalises it back to `"that"` — so a text-vs-text comparison scores it
> **100%**. The acoustic path returns
> `{'op': 'replace', 'expected': 'ð', 'actual': 'z'}` with the feedback
> *"Place tongue between teeth and voice the sound."*

Scoring therefore runs on the **waveform**: a phoneme-CTC model produces phones
with per-token confidence, Needleman–Wunsch alignment against an ARPAbet
reference (from CMUDict/`g2p_en`) yields per-phone substitution/insertion/deletion
diagnosis, and a confidence-weighted GOP-style formula turns that into a score
tuned toward *intelligibility rather than nativeness*.

---

## Architecture

```
┌──────────────────── web (Next.js 15, React 19) ──────────────────────┐
│  Better Auth (email + GitHub/Google) · Drizzle ORM · Postgres        │
│  Coaches (topic + difficulty + accent) · Sessions with a saved script│
│  Call UI: push-to-talk, PCM16@16kHz capture, WebSocket, step rail    │
│  Pronounce UI: score, IPA badges, per-phone detail, syllable/stress  │
│  Progress: accuracy trend, per-phone evidence, targeted drills       │
└──────────┬───────────────────────────────────────────────────────────┘
           │ REST  /api/coaches · /api/sessions · /api/analytics · /api/drills
           │ WS    /ws/voice?token=<hmac>       (audio out, results in)
┌──────────▼─────────────────── backend (FastAPI) ─────────────────────┐
│  SESSION_CONFIG(steps) → START_TURN → AUDIO_CHUNK(PCM16) → END_TURN  │
│    ├─ WavLM-Large CTC ASR          → transcript (for display + LLM)  │
│    ├─ Acoustic phoneme scoring     → score, per-phone, feedback      │
│    │   (phoneme-CTC + GOP; text proxy only as fallback)              │
│    ├─ OpenRouter LLM               → streamed coaching reply         │
│    └─ Google Cloud TTS             → spoken reply                    │
│  POST /api/practice/script  → LLM script, band-validated per tier,   │
│                               or deterministic segmentation of your  │
│                               own pasted text (never paraphrased)    │
└──────────────────────────────────────────────────────────────────────┘
```

The backend holds no database and selects no practice content: the whole step
list arrives in `SESSION_CONFIG`, generated and validated when the session was
created, so a flaky LLM fails at a form submit rather than three seconds into a
live session.

**Difficulty is enforced, not suggested.** `easy` 4–7 words, `medium` 7–12 with a
multisyllabic word, `hard` 12–20 — validated against word counts and ARPAbet
vowel-nucleus counts (not the display respelling, which undercounts "banana"),
with pass thresholds of 80/88/93. A step that falls outside its band is
regenerated or replaced, and the score threshold genuinely gates the session:
a passing turn moves the cursor, a failing turn does not, and skipping is an
explicit, recorded action.

---

## Quickstart

### One command (Docker)

```bash
cp .env.docker.example .env.docker      # set WS_TOKEN_SECRET (openssl rand -hex 32)
docker compose up
```

Then open <http://localhost:3000>. Postgres is created, the Drizzle migration is
applied, and the schema is ready. **The first backend start downloads ~3.6 GB of
models** into a named volume — slow once, then cached across rebuilds.

Optional keys (all of them degrade gracefully rather than breaking the app):

| Missing | What still works | What you lose |
|---|---|---|
| `OPENROUTER_API_KEY` | The whole practice loop | Generated scripts fall back to a labelled offline bank; coach replies become canned lines |
| Google credentials | Everything except audio output | Spoken replies and reference-word playback (the IPA/syllable cards still render) |

### Manual

```bash
# backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
cp .env.example .env                 # set WS_TOKEN_SECRET, OPENROUTER_API_KEY
uvicorn main:app --reload --port 8000

# web
cd web && npm install
cp .env.example .env                 # same WS_TOKEN_SECRET, DATABASE_URL
npm run db:migrate && npm run dev
```

Requires Python 3.10+, Node 20+, and a Postgres database.

### Verifying it, not just running it

```bash
cd backend && python -m unittest discover -s tests   # 267 tests, no model, no network
cd web && npm run lint && npm run test && npm run build
```

Two scripts check the things unit tests cannot, because they need a real
checkpoint and real audio:

```bash
python scripts/smoke_pipeline.py    # audio cap, vocab coverage, silence, a real TH→S error
python scripts/smoke_websocket.py   # the same through /ws/voice, incl. token auth
```

---

## Measured performance

Both models are CPU fp32, loaded once at startup, and called in
`asyncio.to_thread`. Measured on a 13.8 s utterance with
`torch.set_num_threads(2)` to match a 2-vCPU box:

| ASR checkpoint | Peak RSS | ASR | Phonemes | Turn | vs realtime |
|---|---|---|---|---|---|
| `wavlm-libri-clean-100h-large` | 3607 MB | 3.21 s | 3.14 s | 6.4 s | 0.46× |
| `wavlm-libri-clean-100h-base-plus` | 2892 MB | 1.12 s | 2.81 s | 3.9 s | 0.28× |

**Memory is the deployment constraint, not latency.** 3.6 GB peak means a 512 MB–1 GB
container will OOM. On a 4 GB host use `-base-plus`: it is 2.9× faster on ASR and
leaves the **pronunciation score byte-identical** — verified over the live
WebSocket, same 89.57, same `ð → z` error, same feedback — because the score comes
from the waveform, not the transcript. Only the displayed transcript degrades.

(Runtime int8 quantization makes peak memory *worse*, not better: quantizing an
already-loaded fp32 model keeps both copies resident. See `scripts/measure_footprint.py`.)

---

## Notes on the design

**A metric that was not measured is `null`, never a stand-in.** Session reports
used to invent their output — `longest_pause` was literally
`1.1 + (100 - score) * 0.015`, `difficult_sounds` came from `if "th" in word`, and
an empty turn could score ~100%. A learner reads those numbers as evidence about
their own speech, so the report now emits `null` for anything unmeasured and the
UI hides it. The same rule governs the progress page: a week with no practice is a
gap in the line, not a zero.

**The WebSocket is authenticated.** Every turn runs two CPU models and spends LLM
and TTS credit, and the session id used to name the folder turn audio was written
to. The browser cannot attach the session cookie to a WebSocket handshake, so the
web app mints a short-lived HMAC token asserting `{userId, sessionId, expiry}`,
the backend verifies it before accepting the socket, and a client cannot
reconfigure itself onto a session it does not own.

**One scorer, not three.** The repo used to carry a second, parallel scoring stack
(penalty engine, word/syllable/sentence scoring, a WhisperX alignment provider)
reachable only through HTTP routes the UI never called — and unstartable, since
WhisperX was its default provider and was not a dependency. It is deleted;
scoring lives only in `backend/app/services/pronunciation/`.

---

## What is not built yet

Stated plainly, because a roadmap you can't trust is worse than none:

- **Prosody is scored, but not calibrated against humans.** Timing (speech and
  articulation rate, pauses measured by VAD), intonation (contour shape judged
  against what the sentence's own punctuation requires) and lexical stress
  (per-syllable prominence vs the CMUDict pattern) all run per turn now, and are
  unit-tested against synthetic signals rather than by ear. **Stress is a
  heuristic**, not a trained classifier — flagged as such in its own result
  (`method: "heuristic"`).
- **Nothing is calibrated against human ratings yet.** `CORRECT_DISTANCE_THRESHOLD`
  and the prosody bands are hand-tuned; the plan is L2-ARCTIC and speechocean762,
  with the correlation published rather than asserted. Until then the scores are
  a consistent internal signal, not a validated measurement of a learner.
- **Billing is not implemented.** The landing page's Pro tier is a design mock;
  there is no Stripe integration and no plan enforcement.
- **Accent selection reaches generation and TTS, not scoring.** A coach carries
  `accent`, but the scorer still evaluates against a single reference.
- **No L1-aware error prediction.** `L1_AWARE_ENABLED` exists in config and
  nothing reads it.
- **Streaming STT.** ASR runs once over the buffered turn, not live.

## License

MIT — see [LICENSE](LICENSE).
