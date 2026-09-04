# TalkFlow — Project Status & Roadmap

> A spoken-English pronunciation coach: an LLM conversation partner (STT + LLM + TTS) that
> scores how clearly you speak across **phonemes, stress, timing, and intonation**, and
> coaches you to be understood — with confidence — anywhere in the world.

**Last updated:** 2026-09-02
**Status:** Working MVP. **Phase 1 (real audio-based phoneme scoring) is implemented and now
ON by default** (`ENABLE_ACOUSTIC_SCORING=1`); the text proxy has been demoted to a fallback
that only runs when the audio or the model is unavailable. ASR is WavLM-Large.
**Phase 5's practice-content layer has landed** (2026-09-02): the hardcoded sentence banks are
gone, coaches carry a topic + enforced difficulty, and a user can paste their own speech and
have it segmented into steps. Next: validate scoring quality against a labeled set, then
Phase 2 (stress + timing).

---

## 1. Executive Summary

TalkFlow already has a **surprisingly complete product shell**: auth, database, an AI
conversation partner over a realtime WebSocket, TTS playback, a push-to-talk call UI, and a
rich pronunciation-feedback UI (per-word scores, IPA, syllable/stress reference cards, history
persistence). That is far more than most projects at this stage.

There **was one load-bearing flaw** that blocked the product's core promise — now fixed for
Dimension A, and worth keeping on record because it is the reason the architecture looks the
way it does:

> **Pronunciation scoring used to be text-based, not audio-based.** The backend compared
> `G2P(target text)` against `G2P(transcript text)`. Because any word-level ASR is trained to
> emit *real dictionary words*, when a learner says **"tink"** it transcribes **"think"** — the
> mispronunciation was corrected away *before* the phoneme comparison ran. So the system
> mostly confirmed what the user *meant* to say, not what they *actually pronounced*. This is
> structural, not a tuning problem: no choice of ASR model fixes it.

Fixing it means scoring the **raw audio waveform** with a phoneme recognizer + forced
alignment + prosody analysis. That is the heart of this roadmap. Dimension A now does this
(§7 Phase 1); B/C/D still do not.

**Decisions locked in (2026-06-16, ASR revisited 2026-09-01):**
- **Scoring engine:** Self-hosted open-source (phoneme-CTC + GOP + parselmouth + DTW).
- **Scope:** Both tracks, sequenced — fix real audio scoring **and** build the product/progress layer.
- **Audience:** Global learners, **multi-accent** (user-selectable target accent the scorer evaluates against).
- **Compute:** TBD — both GPU and CPU-only paths documented below.

---

## 2. What TalkFlow Is (and the naming legacy, now retired)

The codebase was scaffolded from a meetings/SaaS template, and until 2026-09-02 two table names
still lied about what they held. **The rename has been done** — recorded here because the old
names appear in commits before `6f9747f` and in any database that predates the migration:

| Template term | Renamed to | What it means |
|---|---|---|
| `agents` table | **`coaches`** | A practice coach: `name`, `topic`, `difficulty`, `accent`, `focusSounds`, plus optional `instructions` for personality. |
| `meetings` table | **`practice_sessions`** | One practice session: status lifecycle, transcript, `phonemeData`, plus `source` / `sourceText` / `script`. |
| `meetings.agent_id` | **`practice_sessions.coach_id`** | |
| `meeting_status` enum | **`practice_session_status`** | |

`practice_sessions`, not `sessions`: `session` is already a Better Auth table, and every route
handler has a local `const session = await auth.api.getSession(...)`. URLs and module folders
carry the short name (`/dashboard/sessions`, `src/modules/sessions/`); only the DB table and its
Drizzle export take the prefix.

The rename ran as hand-written `ALTER TABLE ... RENAME` SQL **before** `npm run db:push`. This
repo has no `drizzle/` migrations directory — it is push-only — and `drizzle-kit push` prompts
interactively on renames and will offer drop+create, which destroys data. Renaming out of band
means push only ever sees "add column".

User flow today: **Sign up → create a Coach (topic + difficulty) *or* paste your own text →
preview and edit the generated practice script → start a session → `/call/[sessionId]`
push-to-talk practice → live pronunciation feedback → session report saved.**

---

## 3. Architecture (Current)

```
┌─────────────────────────── web (Next.js 15, React 19) ───────────────────────────┐
│  Auth (Better Auth) · Drizzle ORM/Postgres · CRUD for coaches & practice sessions  │
│  Coach form: topic + difficulty + accent · Session form: coach or pasted text      │
│  Call UI: push-to-talk, PCM16@16kHz capture, WebSocket client, step rail           │
│  Pronunciation UI: scores, IPA, per-phone, syllable/stress cards, wrong-words bar  │
└───────────────┬───────────────────────────────────────────────────────────────────┘
                │  REST (/api/coaches, /api/sessions, /api/auth)
                │  WebSocket  ws://backend/ws/voice   (audio out, results in)
┌───────────────▼─────────────────────── backend (FastAPI) ─────────────────────────┐
│  /ws/voice   SESSION_CONFIG(steps) → START_TURN → AUDIO_CHUNK(PCM16) → END_TURN     │
│     ├─ WavLM-Large CTC ASR (buffered)  → transcript text (for the LLM + display)   │
│     ├─ Acoustic phoneme scoring        → score + per-phone + feedback  ← from AUDIO│
│     │    (phoneme-CTC + GOP; text proxy only as fallback)                          │
│     ├─ OpenRouter LLM (Gemini Flash)   → streamed reply + coach JSON               │
│     └─ Google Cloud TTS                → MP3 audio chunks                           │
│  /api/practice/script  LLM generation from topic, or deterministic text segmenting  │
│  /api/phonemes/*   analyze, analyze-word, reference/{word}, ipa/{word}, compare    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

The backend holds no database and now selects no practice content either: the full step list
arrives in `SESSION_CONFIG` and the session engine executes it.

Both models are CPU fp32, loaded once at startup, and run in `asyncio.to_thread`. Turn audio
is capped at 15 s (`TURN_AUDIO_MAX_BYTES`).

**Stack:** Next.js 15 / React 19 / TS / Tailwind / Better Auth / Drizzle / Postgres ·
FastAPI / OpenRouter / Google TTS · `g2p_en`, `pyphen`, `torch`, `transformers`,
`numpy` already installed. (`librosa`, `scipy`, `soundfile`, `nltk` are present in the venv.)

---

## 4. Current State — Completed / Partial / Missing

### 4.1 The four scoring dimensions

| Dim | Feature | Status | Reality |
|---|---|---|---|
| **A** | Phoneme accuracy | 🟢 **Audio-based, live** | Scored from the waveform: phoneme-CTC recognition → Needleman–Wunsch alignment vs the `g2p_en` reference → confidence-weighted GOP, with per-phone S/I/D diagnosis. The text proxy remains only as a fallback. Not yet calibrated against human labels. |
| **B** | Stress accuracy | 🟠 **Data only, not scored** | ARPAbet stress digits are extracted for the syllable **display** card, then **stripped** before comparison (`_normalize_phoneme`). No stress is ever scored. |
| **C** | Timing / rhythm | 🔴 **Missing** | No waveform analysis, no durations, no rate, no pause detection. |
| **D** | Intonation / pitch | 🔴 **Missing** | No F0 extraction, no contour comparison. (TTS can *set* pitch, but nothing *measures* it.) |

### 4.2 Product surface

**✅ Built and working**
- Email/password + GitHub/Google OAuth (Better Auth); Postgres schema via Drizzle.
- Coaches CRUD (topic, difficulty, accent, focus sounds); practice-sessions CRUD with status
  lifecycle, `phonemeData` JSON + `phonemeAnalysis` table, and a persisted `script`.
- **Practice content generated per user, not hardcoded** — `POST /api/practice/script` returns
  either an LLM script for the coach's topic (`script_generator.py`) or the user's own pasted
  text split into steps (`text_segmenter.py`). Difficulty is an enforced band, not a prompt
  adjective: every step is validated against word-count and syllable limits
  (`practice_content.py`) and regenerated or replaced if it falls outside them.
- Realtime WebSocket voice loop: PCM16 capture → STT → LLM (streamed) → TTS playback → interrupt.
  `SESSION_CONFIG` carries the whole step list, so the backend selects no content of its own.
- Pronunciation feedback UI: live score (0–100), target-vs-heard with misaligned words, per-word
  expand, IPA badges (green/red), suggestion cards, syllable/stress **reference card** with
  US/UK/Indian voice playback (Web Speech API), wrong-words practice bar, per-phone scores from
  `per_phoneme`.
- Call page: step rail with per-step status, the tier's real pass threshold, and — for pasted
  text — the surrounding lines of the speech above the current step.
- Session history persisted; session detail/summary view.
- HTTP phoneme API (`analyze`, `analyze-word`, `reference/{word}`, `ipa/{word}`, `compare`).
- Backend tests: coach JSON contract, health, reference syllabification, difficulty bands,
  segmenter round-trip token equality, script-generator degradation, session progression (124).

**❌ Missing / weak**
- Stress, timing, intonation scoring (B/C/D) — §5 is only satisfied for Dimension A.
- Calibration of the acoustic scorer against human labels (L2-ARCTIC / speechocean762).
- Progress analytics over time (trends, weak-phoneme tracking, mastery curves).
- Spaced repetition and minimal-pair drills targeted at the phones a user actually fails.
  The data to drive them now exists (`difficult_sounds` is aggregated from real `per_phoneme`
  observations), but nothing schedules practice from it.
- L1-aware onboarding / error prediction.
- Multi-accent **scoring** targets (accent is stored on the coach and passed to generation and
  TTS, but the scorer still evaluates against one reference).
- Streaming/partial STT (ASR runs once on END_TURN over the buffered turn, not live-streamed).
- Rate limiting and load/latency hardening. Two large CPU models now run per turn.

---

## 5. The Core Fix — Real Audio-Based Scoring

Replace the text proxy with a **PronunciationScorer** that consumes the user's audio and the
target text, and returns all four dimensions. Architecture (self-hosted, per locked decision):

```
audio (PCM16) + target text
        │
        ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ 1. G2P reference         phonemizer+espeak-ng (IPA)  ── or g2p_en (ARPAbet+stress) │
 │ 2. Phoneme recognition   phoneme-CTC (HF AutoModelForCTC) → recognized phones + logits │
 │ 3. Forced alignment      CTC alignment / MFA-offline → phone time boundaries       │
 │ 4. Scoring                                                                          │
 │    A phoneme   GOP (CTC/segmentation-free) + Needleman–Wunsch align vs reference    │
 │                 → per-phoneme accuracy + substitution/insertion/deletion diagnosis  │
 │    B stress    CMUdict ref vs predicted (per-syllable duration+energy+F0 classify)  │
 │    C timing    syllable-nuclei rate + silero-vad pauses + phone durations           │
 │    D intonation parselmouth F0 → semitone-normalize → DTW vs reference + slope      │
 └──────────────────────────────────────────────────────────────────────┘
        │
        ▼
 unified score JSON  → WebSocket → existing UI (extended)
```

### 5.1 Recommended libraries / models (2025–2026 research)

| Stage | Pick | Notes |
|---|---|---|
| G2P (reference) | `phonemizer` + espeak-ng (IPA) to match recognizer; `g2p_en` (ARPAbet) for stress digits | Keep both alphabets in sync via `phonecodes`. |
| ASR (words, for the LLM) | **`patrickvonplaten/wavlm-libri-clean-100h-large`** | WavLM-Large encoder: 94k h SSL (Libri-Light + GigaSpeech + VoxPopuli) with utterance mixing → holds up on accented, noisy mic audio. **Not** `microsoft/wavlm-*`, which have no CTC head. |
| Phoneme recognizer | **`vitouphy/wav2vec2-xls-r-300m-timit-phoneme`** | Chosen 2026-09-01 over the L2-ARCTIC model below. 8.0% CER vs 12.8%; and decisively, its vocab has **single-token diphthongs and affricates**, so it maps ~1:1 onto our ARPAbet reference. L2-ARCTIC has *no* diphthong tokens — every diphthong would become a spurious insertion. Alternatives stay env-swappable: `mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme` (trained on non-native speech), `facebook/wav2vec2-lv-60-espeak-cv-ft`. |
| Phoneme scoring | **CTC / segmentation-free GOP** computed from the recognizer's logits | No Kaldi needed (arXiv:2507.16838 / Interspeech 2024). |
| Phoneme alignment | Needleman–Wunsch with `panphon` feature distance as substitution cost | Alignment labels = the mispronunciation diagnosis; gives partial credit. |
| Pitch (F0) | **`praat-parselmouth`** | Fastest + CPU-only + phonetics-standard. `torchcrepe` only if audio is noisy/GPU. |
| Intonation compare | semitone-normalize F0 → `librosa.sequence.dtw` + `scipy.stats.linregress` slope | Score *shape*, not absolute pitch. |
| Timing/rhythm | SyllableNuclei v3 (via parselmouth) + **`silero-vad`** | Rate, articulation rate, pauses; nPVI/%V from alignment if desired. |
| Stress | CMUdict reference + per-syllable duration/energy/F0 classifier (MD-DNN style) | No turnkey lib — must be custom-built; weakest-tooling area. |
| Offline ground truth | **MFA** (Montreal Forced Aligner) | Batch tool — use offline to generate eval/training alignments, **not** per-request. |
| Benchmarks | **L2-ARCTIC**, **speechocean762** | For validating A/B against human labels. |

### 5.2 Compute paths (current: CPU-only)

Measured 2026-09-01 on a 13.8 s utterance, 15 Gi dev box, both models warm:

| | Load (first call) | Warm pass | vs realtime |
|---|---|---|---|
| WavLM-Large ASR (`WavLMForCTC`) | 197 s cold cache / **6.6 s** warm | 2.74 s | 0.20× |
| Phoneme recognizer (`Wav2Vec2ForCTC`) | 415 s cold cache / **6.7 s** warm | 2.34 s | 0.17× |
| **Per turn** | 13.3 s total startup | **5.1 s** | **0.37×** |

Cold-cache load is download, not compute — it is the *first deploy* cost, paid again on every
deploy unless the HF cache is baked into the image. Even the warm 6.6 s is mostly Hub HEAD
requests rather than disk; `HF_HUB_OFFLINE=1` with a pre-populated cache cuts it further.
The class names above come from the startup log, which is the only runtime evidence of what
`AutoModelForCTC` actually built.

Peak RSS of the running server after both models had processed a turn (`VmHWM`): **3.6 GB**.

That table is a 20-core box where torch took 14 threads. Re-measured at
`torch.set_num_threads(2)` to match the 2-vCPU Lightsail target
(`backend/scripts/measure_footprint.py`), same 13.8 s clip:

| ASR checkpoint (2 threads) | Peak RSS | ASR | Phoneme | Turn | Realtime |
|---|---|---|---|---|---|
| `...-100h-large` | 3607 MB | 3.21 s | 3.14 s | 6.4 s | 0.46× |
| `...-100h-base-plus` | **2892 MB** | **1.12 s** | 2.81 s | **3.9 s** | 0.28× |
| `large` + runtime int8 | 6218 MB | 2.79 s | 2.19 s | 5.0 s | 0.36× |

- **CPU-only path (in use).** Both models are fp32 on CPU, loaded once at startup, called via
  `asyncio.to_thread`. 0.37× realtime is workable for push-to-talk, but 5 s of processing after
  a 14 s turn is perceptible — the first lever is `torch.set_num_threads()` matched to the
  container's vCPUs. The two passes are *not* trivially parallelisable: `AcousticScorer` needs
  `heard_text` for its fallback path.
- **Memory is the deployment constraint, not latency.** 3.6 GB peak means a 512 MB–1 GB
  container **will OOM**, and so does a 4 GB one at `large`. Mitigations, cheapest first:
  `WARM_ACOUSTIC_ON_STARTUP=0` (defer the phoneme load to first use), then the `-base-plus` ASR
  checkpoint. **base-plus costs nothing in scoring accuracy** — verified over the real
  WebSocket, the pronunciation result was identical (89.57, same `ð → z` error, same feedback)
  because `AcousticScorer` reads `heard_text` only on fallback paths and otherwise scores the
  raw waveform against the target. Only the *displayed transcript* degrades.
- **int8 is not the memory lever it looks like.** Runtime dynamic quantization made peak RSS
  *worse* (6.2 GB) — the fp32 copy stays resident alongside the quantized one, so any real win
  needs a quantize-once-and-ship build step. It also needs WavLM's attention projections
  excluded: `WavLMAttention` reads `q_proj.bias` as a tensor attribute, which quantized `Linear`
  exposes as a method (`TypeError` on first forward).
- **GPU path (not needed yet):** tens of ms per forward pass; revisit if per-turn latency
  becomes the bottleneck. Alternatively offload only the phoneme recognizer to a hosted
  inference endpoint while keeping prosody local.

### 5.3 Design principle: intelligibility, not nativeness
Score **comprehensibility** and don't punish harmless accent (the Derwing/Munro/Levis consensus,
and ELSA's main credibility complaint is being too harsh). This is also a clean brand stance:
*coach to be understood, keep your voice.* Multi-accent **scoring targets** (US/UK/Indian/AU)
realize this for our global audience.

---

## 6. Competitive Landscape & Where We Win

**Market split:** pronunciation specialists (ELSA, BoldVoice, Speechace) score real phonemes but
**don't converse**; conversation tutors (Speak, Praktika, TalkPal) **converse** but give shallow,
lenient pronunciation feedback. **No mainstream app does serious suprasegmental scoring inside
free-form conversation.** That quadrant is open.

**Table stakes (must-have):** per-sound scoring, native model audio + record/compare, instant
feedback, word-stress highlighting, progress tracking, US+UK voices, free tier.

**Market gaps = our differentiators:**
1. **Prosody scored inside real conversation** — stress + intonation + rhythm on spontaneous
   speech, not just scripted drills. The defensible core; academia says current tools are
   "primarily segmental" and "none suitable for advanced prosodic analysis."
2. **L1-aware error prediction** — ask native language, preload the interference profile
   (Japanese R/L, Spanish /ɪ/–/iː/, Mandarin tones), steer the LLM toward those targets. Almost
   unbuilt (only BoldVoice is L1-aware).
3. **Explainable feedback** — every score paired with *why* (which sound/contour) and *how to fix*
   (placement cue, "your pitch rose, making this sound like a question"). LLM generates the prose.
4. **Intelligibility-first scoring** — calibrated, trustworthy, not harsh; sidesteps the
   accent-erasure critique.
5. **Multi-accent evaluation targets**, not just playback voices.
6. **Transparent billing** — the #1 complaint across *every* paid competitor (ELSA, BoldVoice,
   Speak, Pronounce…). Easy cancellation is a cheap trust win.

Our LLM+TTS+STT stack is *precisely* positioned to attack gap #1+#3, which the specialists can't
do (no conversation) and the chat tutors won't do (no real scoring).

---

## 7. Roadmap (phased, sequenced)

Each phase ships something usable. Phases 1–3 fix the core; 4–6 build the product moat.

### Phase 0 — Foundations & honest baseline (small)
- Define a single `PronunciationScorer` interface (`score(audio, target_text, accent) -> Result`)
  so the engine is swappable and testable in isolation.
- Capture & persist the **raw audio** per turn (we currently discard it) — required for any
  acoustic scoring and for later eval datasets.
- Add a backend eval harness skeleton (load a few L2-ARCTIC clips, assert it runs).
- Document compute decision (GPU vs CPU) and pick a model-hosting approach.

### Phase 1 — Real phoneme accuracy (Dimension A) — *highest impact* — ✅ LIVE
Built in `backend/app/services/pronunciation/`:
- ✅ Swappable `PronunciationScorer` interface (`base.py`) + config-driven `registry.py`.
  **`AcousticScorer` is now the default**; `TextProxyScorer` is the fallback.
- ✅ Load-once phoneme recognizer (`phoneme_recognizer.py`) with CTC frame-posterior
  **confidence** per phone; runs via `asyncio.to_thread`. Default model
  `vitouphy/wav2vec2-xls-r-300m-timit-phoneme` (see §5.1 for why).
- ✅ Needleman–Wunsch alignment (`alignment.py`) with a self-contained articulatory-feature
  distance (`phone_set.py`) — avoids the `panphon`/`phonemizer`/espeak-ng system deps; gives
  partial credit + S/I/D diagnosis.
- ✅ GOP-style, confidence-weighted, intelligibility-leaning scoring (`scoring.py`); the raw
  turn audio (already buffered) now feeds the scorer instead of being discarded.
- ✅ Wired into `_emit_pronunciation_result`; **same WebSocket message shape** plus additive
  `method` + `per_phoneme` fields. Graceful fallback to text proxy when audio/model absent.
- ✅ Unit tests covering distance, alignment, scoring, fallback, and the recognizer's IPA→ARPAbet
  vocab coverage (all model-independent).

**Three accuracy bugs fixed alongside the model swap (2026-09-01)** — worth recording because
two of them mattered more than the model choice did:
- ✅ **ASR replaced** with WavLM-Large (`asr.py`, now model-agnostic via `AutoModelForCTC`, so
  the next checkpoint change is an env var).
- ✅ **Turn audio was truncated at 5 s.** Practice sentences run 6–10 s at learner pace, so the
  back half of most sentences was never transcribed. Cap raised to 15 s.
- ✅ **Silence used to score ~100%.** When CTC decoded empty, the code substituted the *target*
  sentence as the transcript, and the text proxy then compared the target against itself.
  Removed; an empty transcript now returns a recoverable error and no score.

**Verified against real audio, not just unit tests (2026-09-01).** Two scripts, both re-runnable
after any checkpoint change: `backend/scripts/smoke_pipeline.py` (service layer) and
`backend/scripts/smoke_websocket.py` (through `/ws/voice`, so it also covers chunked
accumulation, the empty-transcript early return, that the server practises the client's `steps`
rather than any bank of its own, and the `method` the live server reports).
The single most convincing result — the one that shows why this work mattered:

> Target `"Let us try that phrase again."`, spoken as `"...try zat phrase..."`.
> The ASR **normalised it back to "that"** (`heard_text: 'let us try that phrase again'`), so a
> text-vs-text comparison scores it **100%**. The acoustic path still returned
> `{'op': 'replace', 'expected': 'ð', 'actual': 'z'}` with the feedback *"Place tongue between
> teeth and voice the sound."*

Also confirmed: a 13.8 s turn transcribed end to end through 54 chunks (**64% of it would have
been discarded under the old 5 s cap**), 147/147 recognized phone tokens mapped to ARPAbet with
no silent drops, no `[PAD]`/`[UNK]` leakage, and silence returning a recoverable ERROR with no
score. Unit suite: 38/38.

- ⏳ **Remaining:** calibrate against a labeled set (L2-ARCTIC / speechocean762) and tune
  `CORRECT_DISTANCE_THRESHOLD` for intelligibility. (`per_phoneme` is now surfaced in the web
  UI — see Phase 5.)

### Phase 2 — Prosody: stress + timing (Dimensions B, C)
- parselmouth-based per-syllable duration/energy/F0; stress classifier vs CMUdict reference.
- Timing: speech/articulation rate, pause detection (silero-vad), phone durations from alignment.
- Extend result schema + UI: stress markers scored (not just displayed), rhythm/pace meter.

### Phase 3 — Intonation (Dimension D)
- parselmouth F0 → semitone normalize → DTW vs reference contour + slope (rising/falling).
- UI: pitch-contour overlay (you vs reference), question/statement melody hints.

### Phase 4 — Explainable coaching + L1 awareness
- L1 onboarding (native language) → preloaded interference profile; LLM steers conversation
  toward predicted-weak targets.
- Feedback pairs every score with *why* + *how-to-fix* (LLM-generated from the diagnosis data).

### Phase 5 — Progress & practice product — 🟡 **content layer LIVE (2026-09-02)**

The practice-content half of this phase shipped ahead of Phases 2–4, because the scoring engine
was already better than the product wrapped around it. Three things were wrong and are now fixed:

- ✅ **Content was five hardcoded Python lists.** `practice_content.py` held `DAILY_SENTENCES`,
  `INTERVIEW_SENTENCES`, `PRONUNCIATION_SENTENCES`, `VOCABULARY_SENTENCES`, `GENERAL_SENTENCES`
  — 12 strings each — and `get_sentence_bank()` picked one by substring-matching the *agent
  name*, because the three auto-seeded agents had byte-identical `instructions`. Every user
  practised the same 60 sentences. All of it is deleted. What remains under that filename is the
  difficulty-band definition, `validate_step`, and a ~15-per-tier `FALLBACK_BANK` used **only**
  when OpenRouter is unreachable — and a script built from it is tagged
  `generated_by: "fallback"` so the UI says so instead of implying it was written for the user.
- ✅ **The user controlled nothing.** Coaches now carry `topic`, `difficulty`, `accent`, and
  `focusSounds`. Sessions carry `source`, `sourceText`, and the `script` itself, so the generated
  steps are previewable and editable **before** anyone speaks — which also means a flaky LLM
  fails at a form submit rather than three seconds into a live session.
- ✅ **Difficulty is enforced, not suggested.** `easy` 4–7 words / ≤2 syllables per word / pass
  at 80; `medium` 7–12 / ≤5 / ≥1 multisyllabic / 88; `hard` 12–20 / ≤8 / ≥3 / 93. Syllables are
  counted as ARPAbet vowel nuclei via CMUDict — *not* from the display respelling, which
  undercounts ("banana" respells to two syllables and would otherwise slip past the easy cap).
  The old hardcoded `score_threshold = 95` and the frontend's `"Goal: 95%"` are gone.

Also landed: `POST /api/practice/script`; `text_segmenter.py`, which is pure and deterministic
with **no LLM** — it only decides where to cut, never rewrites, and the test suite asserts
token-level round-trip equality, because paraphrasing a speech someone has to deliver defeats
the entire point; the call-page step rail; and an honest session report — `difficult_sounds` is
aggregated from real `per_phoneme` observations (min 3 per phone) instead of `if "th" in word`,
and unmeasurable stats are emitted as `null` and hidden in the UI rather than filled in with
arithmetic on the score (`longest_pause` was literally `1.1 + (100 - score) * 0.015`).

- ⏳ **Remaining in this phase:** analytics dashboard (accuracy trends, weak-phoneme tracking,
  mastery over time); targeted drills + spaced repetition driven by `difficult_sounds`;
  multi-accent target selection wired through the *scorer* (it reaches generation and TTS today).

### Phase 6 — Hardening & launch polish
- Streaming STT, latency/load tuning, empty/noisy-audio handling, rate limiting.
- Transparent billing/trial UX. Validate scoring correlation vs human raters (publish a number).
- `npm run lint && npm run build`; backend `python -m unittest discover -s tests` green in CI.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Latency: two large CPU models per turn | Measured 0.37× realtime warm (§5.2) — workable, but 5 s after a 14 s turn is perceptible. Load-once + `asyncio.to_thread`; score on END_TURN, not per chunk. Next lever is `torch.set_num_threads()`, then GPU/hosted. |
| Memory: **3.6 GB measured** peak RSS with both models resident | Verify the host plan before deploying; 512 MB–1 GB will OOM, and 4 GB is too tight at `large` (3.6 GB leaves <350 MB for the OS). `WARM_ACOUSTIC_ON_STARTUP=0` defers one load; `-base-plus` ASR is the fallback and costs **nothing** in scoring accuracy (§5.2). Runtime int8 makes peak *worse*, not better. |
| Phoneme recognizer over/under-strict → trust loss | Calibrate to **intelligibility**; validate on L2-ARCTIC/speechocean762; expose confidence. |
| Lexical-stress has no turnkey model | Budget custom classifier time in Phase 2; ship duration+energy heuristic first, refine later. |
| Scope creep across 6 phases | Each phase ships independently; A (Phase 1) is the must-win; B–D are incremental. |
| Audio privacy (storing raw speech) | Explicit consent, retention policy, encrypt at rest; needed for eval but treat as sensitive. |
| Loading a checkpoint that lacks the head we need | Real, and silent: `AutoModelForCTC` dispatches on `model_type`, so it will build `WavLMForCTC` from `microsoft/wavlm-large` (a feature-extraction `WavLMModel`) and **randomly initialise the missing LM head** — pure noise, no error. Gate every swap on `backend/scripts/verify_checkpoints.py`, which counts tensors needed vs present. |
| Trusting a repo *name* over its config | `speech31/wavlm-large-english-phoneme` is named for WavLM but is `model_type: wav2vec2` (417 tensors, `transformers_version: 4.11.3` — predating WavLM). Loadable and self-consistent; just not WavLM. The verify script prints `model_type` and flags name/type contradictions. |

---

## 9. Open Decisions

1. **Reference audio per accent** — synthesize with TTS, or curate native recordings, for DTW
   intonation/stress references across US/UK/Indian/AU targets.
2. **Stress classifier** — heuristic first vs train MD-DNN on speechocean762 (effort vs accuracy).
3. **Privacy/retention policy** for stored raw audio.

*Resolved:* compute/hosting for the phoneme model — CPU-only, in-process, load-once (§5.2).

---

## 10. Immediate Next Steps

Phase 0, Phase 1, and Phase 5's content layer are done (§7). Next, in order:

1. Calibrate `CORRECT_DISTANCE_THRESHOLD` against a labeled set (L2-ARCTIC / speechocean762)
   and publish the correlation number.
2. Re-measure latency and RSS under *concurrent* turns. §5.2's numbers are single-turn on an
   idle box; the models are shared singletons, so N simultaneous speakers serialise on the same
   CPU. This is the number that decides the host plan.
3. Progress analytics over sessions — the rest of Phase 5. `difficult_sounds` is now real
   per-phone data, so weak-phoneme trends and spaced-repetition drills have something to read.
4. Begin Phase 2 (stress + timing) on the same waveform the scorer already receives.

> **Appendix — key source pointers:** phoneme recognizer
> (`vitouphy/wav2vec2-xls-r-300m-timit-phoneme`; alternatives
> `mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme`,
> `facebook/wav2vec2-lv-60-espeak-cv-ft`), ASR
> (`patrickvonplaten/wavlm-libri-clean-100h-large`), WavLM paper (arXiv:2110.13900),
> segmentation-free GOP (arXiv:2507.16838),
> parselmouth (github.com/YannickJadoul/Parselmouth), silero-vad, MFA, L2-ARCTIC,
> speechocean762, Azure Pronunciation Assessment (benchmark reference). Full sourced research
> is in the planning conversation.
