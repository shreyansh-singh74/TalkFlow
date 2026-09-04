/**
 * Frame timing for the mouth-shape animation.
 *
 * WHAT IS MEASURED AND WHAT IS NOT — this distinction is the point of the file.
 *
 * Measured: the total duration of the exact MP3 the learner hears, read from
 * `HTMLAudioElement.duration`. That is real, and it absorbs the Slow toggle for
 * free — `rate=0.65` makes the server synthesise a genuinely longer clip, so
 * the timeline stretches with it instead of drifting ~35% as a fixed-millisecond
 * table would.
 *
 * Nominal: the *relative share* each phone takes of that measured total. Those
 * are the constants below. They are presentation timing for a synthetic
 * reference voice — the same category as a CSS transition duration — and they
 * describe no speaker, least of all the learner.
 *
 * They live on the client on purpose. `PhonemeEntry.expected_duration_ms` is
 * reserved for real forced-alignment output feeding rhythm scoring, which *is*
 * learner-facing; writing table constants there is how a legitimate animation
 * constant would quietly become an illegitimate metric (compare the fabricated
 * report values that `backend/tests/test_session_report.py` exists to prevent).
 * Keeping the table here makes that mistake impossible rather than merely
 * discouraged. Nothing in this file may ever be rendered as a number.
 *
 * When real timings do arrive — Google TTS SSML `<mark>` timepoints are the
 * cheap source, not WhisperX — `buildSlots` already prefers
 * `expected_duration_ms` per phone and `fitSlots` degrades to a no-op.
 */

import type { ApiPhoneme } from "@/types/pronunciation";
import { type PoseId, poseIdFor } from "@/lib/viseme-poses";

/** Nominal relative durations, in milliseconds at a normal speaking rate. */
const NOMINAL_MS: Record<string, number> = {
  // stops — closure plus burst, the briefest events in the sequence
  P: 80, B: 75, T: 75, D: 70, K: 85, G: 80,
  // affricates
  CH: 110, JH: 105,
  // fricatives; sibilants run noticeably longer
  F: 100, V: 90, TH: 100, DH: 85, S: 120, Z: 110, SH: 125, ZH: 110, HH: 55,
  // nasals, liquids, glides
  M: 80, N: 75, NG: 85, L: 70, R: 80, W: 70, Y: 65,
  // lax vowels
  IH: 90, EH: 100, AE: 110, AH: 85, UH: 90,
  // tense vowels
  IY: 140, UW: 140, EY: 155, OW: 150, AA: 145, AO: 145, ER: 150,
  // diphthongs — two targets inside one phone, so the longest of all
  AY: 190, AW: 195, OY: 200,
};

const NOMINAL_FALLBACK = 100;

/** Stressed syllables are held longer; unstressed ones are compressed. */
const STRESS_MULTIPLIER: Record<number, number> = { 0: 1, 1: 1.25, 2: 1.1 };

/** English lengthens the final segment of an utterance. */
const FINAL_LENGTHENING = 1.2;

/**
 * Phones whose duration barely moves when a speaker slows down. A stop closure
 * is a physical gesture of roughly fixed length; the extra time in slow speech
 * goes almost entirely into vowels. Without this split, `rate=0.65` leaves the
 * mouth visibly parked on /t/ and /k/ — the opposite of the lesson.
 */
const RIGID = new Set(["P", "B", "T", "D", "K", "G", "CH", "JH", "M", "N", "NG"]);
const RIGID_ELASTICITY = 0.35;

/**
 * MP3 encoder delay plus the leading and trailing silence Google TTS returns.
 * Mapping the timeline across the full `[0, duration]` instead of the speech
 * region makes every word run systematically early.
 */
const LEAD_IN_MS = 45;
const TAIL_MS = 70;

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;

export const TIMELINE_TAIL_MS = TAIL_MS;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface Slot {
  index: number;
  symbol: string;
  pose: PoseId;
  stress: number;
  syllableIndex: number;
  nominalMs: number;
  startMs: number;
  endMs: number;
}

/**
 * Stage one: assign each phone a nominal duration and its refined pose.
 *
 * A pure function of the phoneme list, which is what lets the hover-scrub and
 * silent-demo modes work before any audio has been fetched.
 */
export function buildSlots(phonemes: readonly ApiPhoneme[]): Slot[] {
  const last = phonemes.length - 1;
  return phonemes.map((p, i) => {
    const symbol = (p.symbol || "").toUpperCase();
    const base = p.expected_duration_ms ?? NOMINAL_MS[symbol] ?? NOMINAL_FALLBACK;
    let ms = base * (STRESS_MULTIPLIER[p.stress] ?? 1);
    if (i === last) ms *= FINAL_LENGTHENING;
    return {
      index: i,
      symbol,
      pose: poseIdFor(symbol, p.viseme_id),
      stress: p.stress ?? 0,
      syllableIndex: p.syllable_index ?? 0,
      nominalMs: Math.max(20, ms),
      startMs: 0,
      endMs: 0,
    };
  });
}

/**
 * Stage two: fit the nominal slots onto the real clip.
 *
 * `realMs` may be `NaN` (before metadata) or `Infinity` (a response with no
 * known length). Neither is ever propagated: the caller built the TTS URL and
 * therefore knows `rate`, so `1 / rate` is a good scale estimate in the
 * meantime, and a `durationchange` listener refits once the true value lands.
 * This matters because a `NaN` start makes every comparison in `resolveFrame`
 * false, which would freeze the mouth on its first pose forever.
 */
export function fitSlots(slots: readonly Slot[], realMs: number, rate: number): Slot[] {
  if (!slots.length) return [];

  const nominalTotal = slots.reduce((a, s) => a + s.nominalMs, 0);
  const usable = realMs - LEAD_IN_MS - TAIL_MS;
  const rawScale =
    Number.isFinite(realMs) && usable > 60
      ? usable / nominalTotal
      : 1 / clamp(rate || 1, 0.5, 2);
  // A browser guessing an MP3's length from its bitrate can be wildly wrong;
  // clamping degrades to the nominal timeline rather than a nonsensical one.
  const scale = clamp(rawScale, MIN_SCALE, MAX_SCALE);

  const rigidNominal = slots.reduce(
    (a, s) => a + (RIGID.has(s.symbol) ? s.nominalMs : 0),
    0
  );
  const elasticNominal = nominalTotal - rigidNominal;
  const rigidScale = scale > 1 ? 1 + (scale - 1) * RIGID_ELASTICITY : scale;
  const elasticScale =
    elasticNominal > 0
      ? Math.max(
          0.2,
          (nominalTotal * scale - rigidNominal * rigidScale) / elasticNominal
        )
      : scale;

  let t = LEAD_IN_MS;
  return slots.map((s) => {
    const dur = s.nominalMs * (RIGID.has(s.symbol) ? rigidScale : elasticScale);
    const fitted = { ...s, startMs: t, endMs: t + dur };
    t += dur;
    return fitted;
  });
}

export interface VisemeFrame {
  /** Index into `slots`; `-1` means at rest. */
  index: number;
  /** `null` means the rest pose, which is deliberately not pose 0. */
  pose: PoseId | null;
  syllableIndex: number;
  /** Progress through the current slot, 0–1. */
  blend: number;
  isRest: boolean;
}

export const REST_FRAME: VisemeFrame = {
  index: -1,
  pose: null,
  syllableIndex: -1,
  blend: 0,
  isRest: true,
};

/** Find the pose active at `tMs`. `snap` skips sub-slot blending. */
export function resolveFrame(
  slots: readonly Slot[],
  tMs: number,
  snap: boolean
): VisemeFrame {
  if (!slots.length || !Number.isFinite(tMs)) return REST_FRAME;
  const last = slots[slots.length - 1];
  // The mouth is closed before the word starts and after it ends.
  if (tMs < slots[0].startMs || tMs > last.endMs) return REST_FRAME;

  let i = slots.length - 1;
  for (let k = 0; k < slots.length; k++) {
    if (tMs < slots[k].endMs) {
      i = k;
      break;
    }
  }
  const s = slots[i];
  const span = Math.max(1, s.endMs - s.startMs);
  return {
    index: i,
    pose: s.pose,
    syllableIndex: s.syllableIndex,
    blend: snap ? 1 : clamp((tMs - s.startMs) / span, 0, 1),
    isRest: false,
  };
}
