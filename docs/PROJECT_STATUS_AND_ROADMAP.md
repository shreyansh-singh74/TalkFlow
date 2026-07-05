# TalkFlow — Project Status & Roadmap

> A spoken-English pronunciation coach: an LLM conversation partner (STT + LLM + TTS) that
> scores how clearly you speak across **phonemes, stress, timing, and intonation**, and
> coaches you to be understood — with confidence — anywhere in the world.

**Last updated:** 2026-06-16
**Status:** Working MVP. **Phase 1 (real audio-based phoneme scoring) is now implemented**
behind a feature flag (`ENABLE_ACOUSTIC_SCORING`); the text-proxy remains the safe default.
Next: enable + validate the acoustic model end-to-end, then Phase 2 (stress + timing).

---

## 1. Executive Summary

TalkFlow already has a **surprisingly complete product shell**: auth, database, an AI
conversation partner over a realtime WebSocket, TTS playback, a push-to-talk call UI, and a
rich pronunciation-feedback UI (per-word scores, IPA, syllable/stress reference cards, history
persistence). That is far more than most projects at this stage.

There is **one load-bearing flaw** that blocks the product's core promise:

> **Pronunciation scoring is text-based, not audio-based.** The backend compares
> `G2P(target text)` against `G2P(Deepgram transcript text)`. Because Deepgram is trained to
> emit *real dictionary words*, when a learner says **"tink"** it transcribes **"think"** — the
> mispronunciation is corrected away *before* the phoneme comparison runs. So the system
> mostly confirms what the user *meant* to say, not what they *actually pronounced*.

Fixing this means scoring the **raw audio waveform** with a phoneme recognizer + forced
alignment + prosody analysis. That is the heart of this roadmap.

**Decisions locked in (2026-06-16):**
- **Scoring engine:** Self-hosted open-source (wav2vec2 phoneme + GOP + parselmouth + DTW).
- **Scope:** Both tracks, sequenced — fix real audio scoring **and** build the product/progress layer.
- **Audience:** Global learners, **multi-accent** (user-selectable target accent the scorer evaluates against).
- **Compute:** TBD — both GPU and CPU-only paths documented below.

---

## 2. What TalkFlow Is (and the naming legacy)

The codebase was scaffolded from a meetings/SaaS template, so two table names are misleading:

| Template term | In TalkFlow it means |
|---|---|
| **Agent** | An AI conversation partner / tutor persona (has `name` + `instructions`). |
| **Meeting** | A pronunciation **practice session** (status, transcript, summary, `phonemeData`). |

User flow today: **Sign up → pick/create an Agent → start a Meeting → `/call/[meetingId]`
push-to-talk conversation → live pronunciation feedback → session saved.**

---

## 3. Architecture (Current)

```
┌─────────────────────────── web (Next.js 15, React 19) ───────────────────────────┐
│  Auth (Better Auth) · Drizzle ORM/Postgres · CRUD for agents & meetings           │
│  Call UI: push-to-talk, PCM16@16kHz capture, WebSocket client                     │
│  Pronunciation UI: scores, IPA, syllable/stress cards, wrong-words bar, history   │
└───────────────┬───────────────────────────────────────────────────────────────────┘
                │  REST (/api/agents, /api/meetings, /api/auth)
                │  WebSocket  ws://backend/ws/voice   (audio out, results in)
┌───────────────▼─────────────────────── backend (FastAPI) ─────────────────────────┐
│  /ws/voice   START_TURN → AUDIO_CHUNK(PCM16) → END_TURN                            │
│     ├─ Deepgram STT (buffered)         → transcript text                           │
│     ├─ Phoneme analysis (TEXT-BASED)   → score + segments + feedback   ⚠ core gap  │
│     ├─ OpenRouter LLM (Gemini Flash)   → streamed reply + coach JSON               │
│     └─ Google Cloud TTS                → MP3 audio chunks                           │
│  /api/phonemes/*   analyze, analyze-word, reference/{word}, ipa/{word}, compare    │
│  Optional: wav2vec2 ASR (text only, off by default)                               │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Stack:** Next.js 15 / React 19 / TS / Tailwind / Better Auth / Drizzle / Postgres ·
FastAPI / Deepgram / OpenRouter / Google TTS · `g2p_en`, `pyphen`, `torch`, `transformers`,
`numpy` already installed. (`librosa`, `scipy`, `soundfile`, `nltk` are present in the venv.)

---

## 4. Current State — Completed / Partial / Missing

### 4.1 The four scoring dimensions

| Dim | Feature | Status | Reality |
|---|---|---|---|
| **A** | Phoneme accuracy | 🟡 **Partial / unreliable** | Pipeline exists (G2P + `difflib` LCS alignment + per-phoneme scores + tips for ~14 IPA sounds), but it compares **transcript text**, so it can't see real mispronunciations Deepgram auto-corrects. |
| **B** | Stress accuracy | 🟠 **Data only, not scored** | ARPAbet stress digits are extracted for the syllable **display** card, then **stripped** before comparison (`_normalize_phoneme`). No stress is ever scored. |
| **C** | Timing / rhythm | 🔴 **Missing** | No waveform analysis, no durations, no rate, no pause detection. |
| **D** | Intonation / pitch | 🔴 **Missing** | No F0 extraction, no contour comparison. (TTS can *set* pitch, but nothing *measures* it.) |

### 4.2 Product surface

**✅ Built and working**
- Email/password + GitHub/Google OAuth (Better Auth); Postgres schema via Drizzle.
- Agents CRUD; Meetings CRUD with status lifecycle and `phonemeData` JSON + `phonemeAnalysis` table.
- Realtime WebSocket voice loop: PCM16 capture → STT → LLM (streamed) → TTS playback → interrupt.
- Pronunciation feedback UI: live score (0–100), target-vs-heard with misaligned words, per-word
  expand, IPA badges (green/red), suggestion cards, syllable/stress **reference card** with
  US/UK/Indian voice playback (Web Speech API), wrong-words practice bar.
- Session history persisted; meeting detail/summary view.
- HTTP phoneme API (`analyze`, `analyze-word`, `reference/{word}`, `ipa/{word}`, `compare`).
- Backend tests for the coach JSON contract, health, and reference syllabification.

**❌ Missing / weak**
- **Real acoustic scoring** (the whole of §5).
- Stress, timing, intonation scoring (B/C/D).
- Progress analytics over time (trends, weak-phoneme tracking, mastery curves).
- Structured practice: drills, lessons, spaced repetition for weak sounds.
- L1-aware onboarding / error prediction.
- Multi-accent **scoring** targets (only playback voices today).
- Streaming/partial STT (Deepgram is buffered, not live-streamed).
- Robust error/empty-audio handling, rate limiting, and load/latency hardening.

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
 │ 2. Phoneme recognition   wav2vec2 phoneme CTC (HF)   → recognized phones + logits  │
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
| Phoneme recognizer | **`mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme`** | Fine-tuned on **non-native** English — trained on learner errors. Fallback: `facebook/wav2vec2-lv-60-espeak-cv-ft`. |
| Phoneme scoring | **CTC / segmentation-free GOP** computed from wav2vec2 logits | No Kaldi needed (arXiv:2507.16838 / Interspeech 2024). |
| Phoneme alignment | Needleman–Wunsch with `panphon` feature distance as substitution cost | Alignment labels = the mispronunciation diagnosis; gives partial credit. |
| Pitch (F0) | **`praat-parselmouth`** | Fastest + CPU-only + phonetics-standard. `torchcrepe` only if audio is noisy/GPU. |
| Intonation compare | semitone-normalize F0 → `librosa.sequence.dtw` + `scipy.stats.linregress` slope | Score *shape*, not absolute pitch. |
| Timing/rhythm | SyllableNuclei v3 (via parselmouth) + **`silero-vad`** | Rate, articulation rate, pauses; nPVI/%V from alignment if desired. |
| Stress | CMUdict reference + per-syllable duration/energy/F0 classifier (MD-DNN style) | No turnkey lib — must be custom-built; weakest-tooling area. |
| Offline ground truth | **MFA** (Montreal Forced Aligner) | Batch tool — use offline to generate eval/training alignments, **not** per-request. |
| Benchmarks | **L2-ARCTIC**, **speechocean762** | For validating A/B against human labels. |

### 5.2 Compute paths (decision pending)
- **GPU path:** wav2vec2 runs in tens of ms; enables the full serious stack at low latency.
- **CPU-only path:** parselmouth/silero are CPU-fast; run wav2vec2 on CPU for short clips
  (acceptable for push-to-talk, ~hundreds of ms) **or** offload only the phoneme recognizer to a
  hosted inference endpoint while keeping prosody local. Load models once at FastAPI startup and
  call via `run_in_executor` to avoid blocking the event loop.

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

### Phase 1 — Real phoneme accuracy (Dimension A) — *highest impact* — ✅ IMPLEMENTED
Built in `backend/app/services/pronunciation/`:
- ✅ Swappable `PronunciationScorer` interface (`base.py`) + config-driven `registry.py`
  (`TextProxyScorer` default, `AcousticScorer` behind `ENABLE_ACOUSTIC_SCORING`).
- ✅ Load-once wav2vec2 phoneme recognizer (`wav2vec2_phonemes.py`) with CTC frame-posterior
  **confidence** per phone; runs via `asyncio.to_thread`. Default model
  `facebook/wav2vec2-lv-60-espeak-cv-ft`.
- ✅ Needleman–Wunsch alignment (`alignment.py`) with a self-contained articulatory-feature
  distance (`phone_set.py`) — avoids the `panphon`/`phonemizer`/espeak-ng system deps; gives
  partial credit + S/I/D diagnosis.
- ✅ GOP-style, confidence-weighted, intelligibility-leaning scoring (`scoring.py`); the raw
  turn audio (already buffered) now feeds the scorer instead of being discarded.
- ✅ Wired into `_emit_pronunciation_result`; **same WebSocket message shape** plus additive
  `method` + `per_phoneme` fields. Graceful fallback to text proxy when audio/model absent.
- ✅ 22 unit tests covering distance, alignment, scoring, and fallback (model-independent).
- ⏳ **Remaining:** enable the flag with the model downloaded, validate end-to-end on real audio
  + a small labeled set (L2-ARCTIC), tune `CORRECT_DISTANCE_THRESHOLD` for intelligibility,
  decide GPU vs CPU hosting, and surface `per_phoneme` in the web UI.

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

### Phase 5 — Progress & practice product
- Analytics dashboard: accuracy trends, weak-phoneme tracking, mastery over time.
- Targeted drills + spaced repetition for weak sounds; minimal-pair practice.
- Multi-accent target selection wired through the scorer and TTS voices.

### Phase 6 — Hardening & launch polish
- Streaming STT, latency/load tuning, empty/noisy-audio handling, rate limiting.
- Transparent billing/trial UX. Validate scoring correlation vs human raters (publish a number).
- `npm run lint && npm run build`; backend `python -m unittest discover -s tests` green in CI.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Latency of wav2vec2 on CPU hurts the realtime feel | Load-once + executor; consider GPU or hosted inference; score on END_TURN, not per chunk. |
| Phoneme recognizer over/under-strict → trust loss | Calibrate to **intelligibility**; validate on L2-ARCTIC/speechocean762; expose confidence. |
| Lexical-stress has no turnkey model | Budget custom classifier time in Phase 2; ship duration+energy heuristic first, refine later. |
| Scope creep across 6 phases | Each phase ships independently; A (Phase 1) is the must-win; B–D are incremental. |
| Audio privacy (storing raw speech) | Explicit consent, retention policy, encrypt at rest; needed for eval but treat as sensitive. |
| Deepgram still useful? | Keep it for the conversation transcript/LLM; the new scorer handles pronunciation from audio. |

---

## 9. Open Decisions

1. **Compute/hosting** for the phoneme model — GPU instance vs CPU vs hosted inference endpoint.
2. **Reference audio per accent** — synthesize with TTS, or curate native recordings, for DTW
   intonation/stress references across US/UK/Indian/AU targets.
3. **Stress classifier** — heuristic first vs train MD-DNN on speechocean762 (effort vs accuracy).
4. **Privacy/retention policy** for stored raw audio.

---

## 10. Immediate Next Steps (start of Phase 0/1)

1. Add `PronunciationScorer` interface + persist raw turn audio.
2. Stand up wav2vec2 phoneme recognition as a load-once service with a smoke test.
3. Prototype `audio → recognized IPA → align vs reference → per-phoneme GOP` on 2–3 sample clips.
4. Swap it into `_emit_pronunciation_result` behind a feature flag; compare against the text proxy.

> **Appendix — key source pointers:** wav2vec2 L2-ARCTIC phoneme model
> (`mrrubino/wav2vec2-large-xlsr-53-l2-arctic-phoneme`), eSpeak IPA model
> (`facebook/wav2vec2-lv-60-espeak-cv-ft`), segmentation-free GOP (arXiv:2507.16838),
> parselmouth (github.com/YannickJadoul/Parselmouth), silero-vad, MFA, L2-ARCTIC,
> speechocean762, Azure Pronunciation Assessment (benchmark reference). Full sourced research
> is in the planning conversation.
