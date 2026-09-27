# TalkFlow — Logo Redesign Brief

> This document is written to be handed verbatim to a design AI or a designer.
> Everything in it is extracted from the actual product codebase, not aspirational.

---

## 1. What the product is

**TalkFlow is an AI speaking coach that scores how clearly you spoke — from your
voice, not your transcript.**

One line, for the logo's mental model: *it hears the sounds.*

The user speaks a sentence into their browser. TalkFlow records the turn, runs a
phoneme recogniser over the raw audio waveform, aligns the phonemes the user
actually produced against the phonemes the sentence requires, and reports which
specific sound was missed and how to fix it. Then it does it again on the next
sentence, and tracks which sounds keep failing across sessions.

**Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4 · Drizzle · Postgres
(Better Auth) · FastAPI · WavLM ASR · phoneme-CTC acoustic scoring · OpenRouter ·
Google Cloud TTS. MIT licensed.

### The one idea the brand must carry

This is the strategic core, and the logo has to survive being reduced to 16px.

Most conversation apps grade you on *what* you said. TalkFlow grades you on *how
you said it*. There is a real, demonstrable reason this matters, and it is the
product's entire claim to difference:

> A word-level ASR is trained to emit **real words**. If you say "tink", it
> transcribes "think". So if you grade pronunciation by comparing the transcript
> to the target text, **the error is corrected away before the comparison runs.**
> The system confirms what you meant to say, not what you said. No choice of ASR
> model fixes this — it is structural.

The proof from the project's own smoke test:
- Target `"Let us try that phrase again."`, spoken as `"...try zat phrase..."`.
- Text-vs-text comparison scores it **100%**.
- The acoustic path returns `{'op': 'replace', 'expected': 'ð', 'actual': 'z'}`
  with the feedback *"Place tongue between teeth and voice the sound."*

**Design implication:** the brand is about **the sound underneath the word** —
the phoneme, the waveform, the alignment. Not a chat bubble. Not a microphone.
Not a generic "AI sparkle". A logo that could equally belong to a podcast app, a
voice-note app, or a language-learning Duolingo is a failed logo.

---

## 2. Audience and positioning

| | |
|---|---|
| **Primary user** | An adult non-native English speaker, likely Indian-accented, already comfortable reading and writing English but unsure whether they are *understood out loud*. |
| **Secondary** | Professionals preparing for interviews, presentations, or client calls. |
| **Session length** | 2–10 minutes, in a browser tab, on a laptop, in a quiet room. |
| **Emotional job** | The user is slightly anxious about being judged on their accent. The product must feel like a **precise instrument**, not a gamified toy. |
| **Category frame** | Pronunciation / speaking practice, not "AI conversation partner." The product must not read as a chatbot, and must not read as Duolingo. |
| **Pricing posture** | Free tier, Pro tier. Consumer-SaaS, not enterprise. |

---

## 3. Brand voice — derived from live site copy

The voice is already consistent and unusually well defined. Match it.

**Headline:** "Speak clearer. *Stay yourself.*"
(the second clause is set in an italic serif — the brand's emotional anchor)

**Subhead:** "The pronunciation coach that scores your speech from the sound you
make, not the words a transcript guessed."

**Section heading:** "A speaking coach that *hears the sounds between words.*"

**Voice attributes:**
- **Precise, not cute.** The product talks in phonemes, IPA, waveform, alignment.
- **Honest to a fault.** The README's "What is not built yet" section states plain
  uncalibrated features rather than implying them; the UI returns `null` for any
  metric that was not measured instead of a plausible-looking number. *A metric
  that was not measured is `null`, never a stand-in.* The brand should feel like
  it has nothing to hide.
- **Confident, never boastful.** States mechanisms, not superlatives. No
  "revolutionary", no "AI-powered", no exclamation marks.
- **Respectful of the learner's existing voice.** "Intelligibility first — the
  goal is being understood, not sounding American or British. If your accent is
  clear, it stays yours." The logo must not imply *correcting* a user into
  something else.
- **Uses concrete detail as a flex.** `/ð/ → /z/`, `89.57`, "Place tongue between
  teeth." Specificity is the brand.

**Words the brand uses:** sound, hear, voice, speak, clear, align, waveform,
phoneme, intelligible, coach, score, drill, practice, session.
**Words the brand avoids:** AI, smart, powerful, seamless, unlock, level up,
streak, gamify, journey, transform, empower, revolutionary, next-generation.

---

## 4. The current logo — exact spec

Two files, `web/public/logo.svg` and `web/public/logo-ink.svg`. They are
**the same geometry**, differing only in colour:

| | |
|---|---|
| Format | SVG, `viewBox="0 0 50 50"`, `width/height="80"` |
| Structure | **11 identical paths** (`class="ccustom"`) |
| Shape of each path | A closed tapered lozenge / petal (13 points, ~2.5 units wide at the base, rounded tip) |
| Placement | Radiating from centre (25, 25) at **r ≈ 15** |
| Angular spacing | **~32.7°** apart (360 ÷ 11), covering the full circle |
| Colour | `fill="white"` (logo.svg) / `fill="currentColor"` with `color="#1A1A1A"` (logo-ink.svg) |
| Other attributes | `fill="none"` on root, no strokes, no gradients, no negative space, no detail |

**Read:** a radial 11-point starburst / asterisk / sunburst. A generic
"emission" or "sparkle" mark.

**Where it is used today:**

| Location | Size | Background |
|---|---|---|
| `landing-nav.tsx` — inside a `rounded-lg bg-tf-green` chip, next to the wordmark | **16 × 16 px** | `#18A44B` green |
| `footer-section.tsx` | 16 × 16 px | `#0D1813` surface |
| `sign-in-view.tsx`, `sign-up-view.tsx` | 92 × 92 px | light auth screen |
| `forgot-password-view.tsx`, `reset-password-view.tsx` | large | light auth screen |
| `dashboard-sidebar.tsx` — above the wordmark | 36 × 36 px | dark sidebar |
| `web/src/app/favicon.ico` | favicon | browser tab |

**Why it should be replaced — be fair about this.** At 16 px, eleven 2.5-unit-wide
petals on a 50-unit grid collapse into a fuzzy grey disc with no legible
structure, and it is monochromatically meaningless: the exact same mark
represents "sounds", "voice", "AI sparkle", "sun", and "asterisk". It also
carries no trace of the product's actual differentiator — the alignment of
produced sound against required sound. A redesign should fix legibility at 16px
and encode the *sound* idea specifically.

---

## 5. The visual system the logo must live inside

These are the **actual tokens in `web/src/app/globals.css`**. Use them exactly.

### 5a. The core brand palette (dark, "deep forest") — use this as primary

```
--tf-bg:        #070D0A   near-black, green-cast
--tf-surface:   #0D1813
--tf-text:      #EDF4F0
--tf-muted:     #A2B6AC
--tf-subtle:    #6E847A

--tf-green:       #18A44B   ← PRIMARY BRAND COLOUR (also the app's --primary)
--tf-green-strong:#087A35
--tf-mint:        #5FD98B   ← the bright accent, used for CTAs and "correct"
--tf-green-light: #10271C
--tf-green-tint:  #0A1B14

--tf-deep:       #061A15   sidebar / dark sections
--tf-deep-raise: #0C4234
--tf-deep-line:  rgba(255,255,255,0.10)
--tf-deep-text:  #E9F2EC
--tf-deep-muted: #94AFA5

--tf-amber:      #E8925A   ← "this is what actually came out" (the error colour)
--tf-amber-light:#2B1B10
```

`--tf-green` is `oklch(0.63 0.1699 149.21)`. Hue ≈ 149° (a true, slightly
cool-leaning green — **not** mint, **not** teal).

**The load-bearing pairing to respect:** `#5FD98B` mint = *correct / understood
/ your score*. `#E8925A` amber = *the slip, the sound that came out wrong*. The
logo may use this pairing, but must not be confused with it — the amber in
particular is reserved as a signal colour.

### 5b. Secondary / legacy palette — present in the app, lower priority

```
--ink:         #14161A
--parchment:   #EFEAE1
--cobalt:      #3457D5
--emerald:     #00A878
--amber-warm:  #C25E2F
```

The signed-in app is **light-theme** (`--background: oklch(1 0 0)`) with green as
`--primary`. The call screen adds `#10b981` / `#14b8a6` gradients. **Consequence:
the logo must survive on near-black green-cast, on white, and on `#18A44B`.**
Assume three backgrounds minimum.

### 5c. Typography

| Role | Face | Note |
|---|---|---|
| Wordmark / UI | **Geist Sans** (variable), `--font-geist-sans` | Neutral, technical, slightly cold. Tight tracking: `letter-spacing: -0.015em` on the nav wordmark, `-0.045em` on the hero. |
| Display accent | **Playfair Display** (500/600/700, incl. italic) | Used *only* for the emotional second clause of a heading. Never for the wordmark. |
| Phonetic / mono | **JetBrains Mono** (400/500) | For IPA, phoneme chips, `→` substitution readouts, eyebrows (`text-[10px] uppercase tracking-[0.14em]`). |

**Wordmark treatment today:** the name "TalkFlow" is set in Geist Sans,
`font-semibold` (600), `15px`, `tracking-[-0.015em]`, colour `--tf-text`,
immediately right of a `size-7 rounded-lg` green chip holding the mark. Recreate
this lockup geometry.

### 5d. Geometry and texture

- `--radius: 0.625rem` (10px). Tiles use `rounded-2xl` (16px), pills `rounded-full`.
- **Dot grid** at 22px pitch, 1px dots at 22% `--tf-green` — the signature
  background texture (`.tf-dots`, `.tf-dots-deep`).
- **Soft radial green bloom** from the top of the hero, and again on card hover.
- Icons: Lucide, `strokeWidth 1.8`, inside `rounded-xl` chips with a
  `ring-1 ring-inset` of `tf-green/20–25`.

### 5e. Product motifs already in the UI — the logo's raw material

These are the strongest ownable assets the product already owns. A great logo
abstracts one of them.

1. **The score ring / arc dial** — an SVG circle, `r=30`, `stroke-width 6`,
   `stroke-linecap="round"`, drawn via `stroke-dashoffset` from 0 to a
   percentage. Mint fill on a faint track. Appears in the hero, the call screen,
   and the session report.
2. **The waveform** — a row of vertical bars scaled on Y (`.waveform-bar`), plus
   a `live-waveform.tsx` component. The literal sound.
3. **The viseme mouth diagram** — `viseme-mouth.tsx` draws a lower-face contour
   (jaw, chin crease, nose, nostrils, philtrum) around lips, oral cavity, teeth,
   and a pink tongue, all driven by a 10-dim pose vector and interpolated at
   70 ms. Lips are two filled crescents; the opening is a separate thin
   `stroke-width 1.2` aperture edge. **This is the product's most distinctive
   visual asset** and the most direct embodiment of "we coach your mouth, not
   your transcript."
4. **The phoneme substitution chip** — `/ð/ → /z/`, mono type, mint expected on
   the left, amber actual on the right, separated by a small `→`. This is the
   product's signature *data* display and the literal shape of its value prop.
5. **The phonetic staff** — a word in Playfair Display with its IPA in
   JetBrains Mono directly beneath, letterspaced.
6. **The roll/slot transition** — spelling → respelling → IPA, rolling vertically
   behind a soft `linear-gradient(180deg, transparent, #000 16%, #000 84%,
   transparent)` edge mask over 620 ms. Three states of one word.

---

## 6. Design constraints — non-negotiable

**Form**
- **Minimal.** Fewer elements, not more. If a shape can be removed without losing
  the idea, remove it. Target: **1–3 filled paths**, or one path + one counter.
  Nothing at 11-part complexity.
- Must be legible and recognisable at **16 × 16 px** — this is the real nav size
  today. Test it. If it does not survive a 16px render, it is wrong.
- Must also hold at **92 × 92 px** (auth screens) without looking empty or
  trivially inflated.
- Must work in **pure monochrome** (single colour, no gradient, no glow) because
  the favicon and print contexts force it.
- Must be describable in **one short sentence** without saying "abstract."
- Geometric construction on a clear grid. Optical centring, not just
  mathematical — a mark centred by bounding box will look off.
- **Must not require a background plate or container to be legible.** The nav
  currently wraps it in a green chip; a new mark should ideally not need that
  crutch, but must still work if the chip stays.

**Colour**
- Primary: `#18A44B` (green) with `#5FD98B` (mint) as the single permitted
  second colour, on `#070D0A` / `#0D1813` / `#061A15`.
- Must also be supplied as a **single-colour `#FFFFFF`** variant (for the green
  chip and the dark sidebar) and a **single-colour dark variant** (`#14161A` or
  near-black) for the light auth screens.
- Avoid: purple/blue "AI" gradients, neon, drop shadows, glows, glassmorphism.

**Format**
- Hand-authored or exported **SVG**. No `<image>`, no embedded raster, no
  `filter`, no `mask` if avoidable, no external font references.
- Must be legible with `fill` overridden to a single colour — so build it from
  `currentColor` or a single-fill group, the way `logo-ink.svg` already does.
  **Ship the geometry once; derive the colour variants from it.**
- Include real `viewBox` and no fixed `width`/`height` mismatch.

**Do not**
- Do not redesign the wordmark. Keep "TalkFlow" in Geist Sans 600. The task is
  the mark, plus optionally a refined lockup.
- Do not change the palette or the CSS tokens. Fit the logo to the system that
  exists.
- Do not introduce a mascot, a character, or a literal smiling mouth.
- Do not put the mark inside a speech bubble, chat bubble, or rounded-square
  "app icon" unless it is genuinely required by the favicon.

---

## 7. Suggested concept territories

Four directions, each grounded in something the product actually does. Pick one
or deliberately reject it — do not blend all four into mush.

### A. The alignment mark — *the strongest idea, and the true differentiator*
The product's whole thesis is **produced sound vs. required sound**, compared
against each other. Encode that comparison, not the speech itself.
- Two elements in correspondence: a filled form and its outline, a solid bar and
  a hairline, a bright arc and a faint one.
- Evokes: the score ring at 78% drawn, `/ð/ → /z/`, Needleman–Wunsch alignment.
- Reads as: measurement, correspondence, "we compared it."
- Risk: abstract. Mitigate by keeping the correspondence legible — the two
  elements must visibly *relate*, not merely sit near each other.

### B. The aperture — mouth as the unit of speech
The most ownable asset the product has is the viseme mouth.
- A single lens or aperture form: an ellipse/lens shape, a parted-lip silhouette,
  the crescent pair from `upperLip`/`lowerLip`.
- Evokes: articulation, the moment of sound leaving, vowel space.
- Reads as: the mouth, the voice, precision at the source.
- Risk: drifts toward a generic mic/sound-hole/lens. Push it toward the
  *lips-as-crescents* geometry, not a plain circle — a circle is a mic.

### C. The waveform, disciplined
The literal sound, reduced to its most economical form.
- Not the 40-bar decorative waveform of every podcast app. Three to five bars, or
  one bar set inside a boundary, with a deliberate asymmetry (sound is not
  periodic).
- Consider the bars as *phoneme slots* rather than amplitude — discrete units
  in sequence, one of them flagged.
- Reads as: sound, audio, measurement over time.
- Risk: **highest cliché risk of the four.** A plain bar chart is the default
  output of every "make me an audio logo" prompt. Only pursue this if the
  execution has a genuine idea in it, not just the shape.

### D. The signal that was caught
The product's promise is *detection*: a specific slip, located precisely.
- A single localised event: a dot or tick inside a field, one element that is
  "off" from its neighbours, one notch in an otherwise regular series.
- Evokes: the flagged word, the amber error marker, the drill queue, the
  `ð → z` correction chip.
- Reads as: attention, precision, "we found it."
- Risk: can read as generic "analytics" or "notification." Needs the regularity
  of the series to make the anomaly legible.

### Explicitly reject
A chat bubble. A microphone (a mic is a different product: capture, not
analysis). A graduation cap or book. A globe or speech bubbles (generic
"languages"). A neural-network node graph. A four-point sparkle (AI-default, and
the current mark is already an 11-point sparkle). A sound-emitting mouth in
profile with radiating lines. A brain or lightbulb.

---

## 8. Deliverables requested from the designer/AI

1. **Primary mark** — the symbol alone, on a transparent background, as SVG.
2. **Wordmark lockup** — mark + "TalkFlow" in Geist Sans 600, horizontal, with
   the gap and baseline relationship specified (current gap: `gap-2`, 8px, at
   28px chip).
3. **Colour variants**, all from the same geometry:
   - `logo.svg` — single-colour **white** fill (used in the green nav chip and
     the dark sidebar today).
   - `logo-ink.svg` — `fill="currentColor"`, `color="#1A1A1A"` (light auth screens).
   - `logo-green.svg` — `#18A44B`, for use on white/light surfaces.
   - Optionally a two-colour `#18A44B` + `#5FD98B` version for large placements
     (≥ 64px) only. The 16px version must be single-colour.
4. **Scale sheet** — the same mark rendered at 16, 20, 24, 32, 48, 92 px so the
   small-size legibility can be judged honestly.
5. **Favicon** — 16×16 and 32×32 `.ico`/`.png`, plus an SVG favicon. Must be the
   simplest variant; a favicon may need more simplification than the app mark.
6. **Clear space** — specified as a multiple of a unit (e.g. "clear space = the
   height of the mark's inner counter") and a **minimum size** (state it; if the
   mark is legible at 16px, say 16px is the floor).
7. **One paragraph** of rationale: what the mark encodes, which product mechanism
   it abstracts, and why it will still mean something in five years.

---

## 9. Acceptance checklist

A submission passes only if every line is true:

- [ ] Legible and identifiable at **16 × 16 px**.
- [ ] Survives being flattened to **one colour**.
- [ ] Works on `#070D0A`, on `#FFFFFF`, and on `#18A44B`.
- [ ] Built from **1–3 filled paths** (plus counters), or an equivalently simple
      construction.
- [ ] Pure vector, no filters, no masks, no raster, no embedded fonts.
- [ ] Grid-consistent and optically centred.
- [ ] **Encodes sound, alignment, or articulation** — not "AI", not "chat", not
      "audio capture."
- [ ] Distinguishable at a glance from: Duolingo, Google Podcasts, Spotify,
      Otter.ai, a chat bubble, a microphone, and the outgoing 11-point starburst.
- [ ] Describable in one sentence that contains the word "sound" or "speech" or
      "voice" — and does **not** require the word "abstract."
- [ ] Does not imply the user's accent is wrong or needs correcting.

---

## 10. Reference material available in the repo

If the designing AI can read the repository, these are the highest-value files:

| Path | What to look at |
|---|---|
| `README.md` | The product thesis, the `ð → z` proof, the design-principles section |
| `web/public/logo.svg`, `logo-ink.svg` | The outgoing mark (50×50, 11 petals at 32.7°) |
| `web/src/app/globals.css` | Every colour token, font, radius, and animation; the dot-grid and green-bloom primitives |
| `web/src/components/viseme-mouth.tsx` | The mouth diagram — lips, aperture, tongue, jaw |
| `web/src/lib/viseme-poses.ts` | The 10-dim articulation pose vectors |
| `web/src/modules/call/ui/components/call-active-score-ring.tsx` | The score ring |
| `web/src/components/ui/live-waveform.tsx` | The waveform |
| `web/src/modules/home/ui/components/hero-section.tsx` | The `/ð/ → /z/` chips and the score dial, in situ |
| `web/src/modules/home/ui/components/phoneme-slider.tsx` | The three-state word roll |
| `web/src/modules/home/ui/components/landing-nav.tsx` | The current lockup, at 16px |
| `web/images/dashboard.png`, `web/images/agents.png` | Screenshots of the signed-in product |
