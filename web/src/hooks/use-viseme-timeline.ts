"use client";

/**
 * Drives the mouth-shape animation from the reference clip.
 *
 * The clip is the clock. Every frame reads `audio.currentTime` rather than
 * counting its own elapsed milliseconds, so drift is structurally impossible:
 * if the browser stalls on a buffer, throttles a background tab, or the user
 * scrubs, the mouth is wherever the audio is. The replaced implementation ran a
 * fixed 120 ms `setInterval` with no reference to the audio at all, which is why
 * it desynchronised by roughly a third the moment the Slow toggle was used — the
 * toggle a struggling learner reaches for first.
 *
 * The hook also owns the `HTMLAudioElement`. That is not incidental tidiness:
 * the previous code did `new Audio(url)` inside a click handler and kept no
 * reference, so a second click layered a second clip over the first, a failed
 * load left the mouth animating forever, and navigating away left audio playing
 * with no way to stop it. One element in one ref makes all three impossible.
 *
 * When synthesis is unavailable — `tts_service` returns `None` without Google
 * credentials, which is the normal state of a fresh dev machine — the timeline
 * falls back to a silent wall-clock run over the nominal durations. The mouth
 * still teaches the shapes; it just does it without sound.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getBackendUrl } from "@/lib/backend-config";
import {
  REST_FRAME,
  TIMELINE_TAIL_MS,
  buildSlots,
  fitSlots,
  resolveFrame,
  type Slot,
  type VisemeFrame,
} from "@/lib/viseme-timing";
import type { ApiPhoneme } from "@/types/pronunciation";

export type TimelineStatus =
  /** At rest, nothing queued. */
  | "idle"
  /** Fetching or decoding; the mouth stays at rest until sound actually starts. */
  | "loading"
  /** Advancing through the slots, with or without audio. */
  | "playing"
  /** The learner is stepping or scrubbing by hand. */
  | "manual";

export interface UseVisemeTimelineOptions {
  /** Text to synthesise. Empty disables audio and forces the silent run. */
  text: string;
  phonemes: readonly ApiPhoneme[] | undefined;
  /** BCP-47 dialect, forwarded to `/api/phonemes/tts`. */
  lang: string;
  /** Server-side synthesis rate — 0.65 for the Slow toggle, 1 otherwise. */
  rate: number;
}

export interface UseVisemeTimelineResult {
  status: TimelineStatus;
  frame: VisemeFrame;
  /** Nominal slots, for the filmstrip and step affordances. */
  slots: Slot[];
  /** True when the OS asks for reduced motion; poses snap instead of easing. */
  reducedMotion: boolean;
  /** True when audio could not be synthesised and the run is silent. */
  silent: boolean;
  play: () => void;
  stop: () => void;
  /** Move by whole phones. Takes over from playback. */
  step: (delta: number) => void;
  /** Scrub to a fraction of the word, 0–1. Takes over from playback. */
  seekFraction: (fraction: number) => void;
}

function ttsUrl(text: string, lang: string, rate: number): string {
  const q = new URLSearchParams({
    text,
    lang,
    rate: String(rate),
  });
  return `${getBackendUrl()}/api/phonemes/tts?${q.toString()}`;
}

export function useVisemeTimeline({
  text,
  phonemes,
  lang,
  rate,
}: UseVisemeTimelineOptions): UseVisemeTimelineResult {
  const nominal = useMemo(() => buildSlots(phonemes ?? []), [phonemes]);

  const [status, setStatus] = useState<TimelineStatus>("idle");
  const [frame, setFrame] = useState<VisemeFrame>(REST_FRAME);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [silent, setSilent] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const fittedRef = useRef<Slot[]>([]);
  const nominalRef = useRef<Slot[]>(nominal);
  const frameRef = useRef<VisemeFrame>(REST_FRAME);
  /** Invalidates in-flight `play()` continuations after a stop or a word change. */
  const genRef = useRef(0);
  const silentRef = useRef(false);
  const silentStartRef = useRef(0);
  const snapRef = useRef(false);
  const rateRef = useRef(rate);

  rateRef.current = rate;

  /* ------------------------------------------------------------ reduced motion */

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      snapRef.current = mq.matches;
      setReducedMotion(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* ----------------------------------------------------------------- publishing */

  /**
   * Push the frame for `ms`, but only when the *slot* changed.
   *
   * Sub-slot easing is the renderer's job — it interpolates two pose vectors on
   * its own rAF and writes SVG attributes through refs. Re-rendering React 60
   * times a second to communicate a number that only the renderer consumes
   * would be pure waste, so `frame.blend` is a sample taken at the transition,
   * not a continuously-updated value.
   */
  const publish = useCallback((ms: number) => {
    const next = resolveFrame(fittedRef.current, ms, snapRef.current);
    if (next.index === frameRef.current.index) return;
    frameRef.current = next;
    setFrame(next);
  }, []);

  const goRest = useCallback(() => {
    frameRef.current = REST_FRAME;
    setFrame(REST_FRAME);
  }, []);

  const gotoIndex = useCallback((i: number) => {
    const list = fittedRef.current;
    if (!list.length || i < 0) {
      frameRef.current = REST_FRAME;
      setFrame(REST_FRAME);
      return;
    }
    const s = list[Math.min(list.length - 1, i)];
    const next: VisemeFrame = {
      index: s.index,
      pose: s.pose,
      syllableIndex: s.syllableIndex,
      blend: 1,
      isRest: false,
    };
    frameRef.current = next;
    setFrame(next);
  }, []);

  /* ---------------------------------------------------------------- the clock */

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const timelineEndMs = useCallback(() => {
    const list = fittedRef.current;
    return list.length ? list[list.length - 1].endMs + TIMELINE_TAIL_MS : 0;
  }, []);

  const startLoop = useCallback(
    (gen: number) => {
      stopLoop();
      const loop = () => {
        if (genRef.current !== gen) {
          rafRef.current = null;
          return;
        }
        if (silentRef.current) {
          const ms = performance.now() - silentStartRef.current;
          publish(ms);
          if (ms > timelineEndMs()) {
            rafRef.current = null;
            goRest();
            setStatus("idle");
            return;
          }
        } else {
          const audio = audioRef.current;
          if (!audio) {
            rafRef.current = null;
            return;
          }
          publish(audio.currentTime * 1000);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [goRest, publish, stopLoop, timelineEndMs]
  );

  const refit = useCallback(() => {
    const audio = audioRef.current;
    const durationMs = audio ? audio.duration * 1000 : Number.NaN;
    fittedRef.current = fitSlots(nominalRef.current, durationMs, rateRef.current);
  }, []);

  /** Animate without sound. Used when synthesis is unavailable or playback is blocked. */
  const runSilent = useCallback(
    (gen: number) => {
      if (genRef.current !== gen) return;
      silentRef.current = true;
      silentStartRef.current = performance.now();
      fittedRef.current = fitSlots(nominalRef.current, Number.NaN, rateRef.current);
      setSilent(true);
      setStatus(nominalRef.current.length ? "playing" : "idle");
      if (nominalRef.current.length) startLoop(gen);
    },
    [startLoop]
  );

  /* ------------------------------------------------------- the audio element */

  useEffect(() => {
    if (typeof window === "undefined") return;
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const ac = new AbortController();
    const on = (type: string, fn: () => void) =>
      audio.addEventListener(type, fn, { signal: ac.signal });

    // The mouth leaves rest on `playing`, never on the click. Synthesis takes a
    // few hundred milliseconds on a cold cache, and starting the animation at
    // click time meant mouthing through that silence.
    on("playing", () => {
      silentRef.current = false;
      setSilent(false);
      refit();
      setStatus("playing");
      startLoop(genRef.current);
    });
    on("ended", () => {
      stopLoop();
      goRest();
      setStatus("idle");
    });
    on("error", () => {
      // A teardown (`removeAttribute("src")` + `load()`) also raises `error`.
      // Only a real failure has a src to have failed on.
      if (!audio.getAttribute("src")) return;
      runSilent(genRef.current);
    });
    // The fitted timeline depends on the clip's real length, which arrives after
    // playback may already have started.
    on("durationchange", refit);
    on("ratechange", refit);
    on("seeked", () => publish(audio.currentTime * 1000));
    // ~4 Hz backstop. rAF is throttled or suspended in background tabs and in
    // some power-saving modes; `timeupdate` keeps firing.
    on("timeupdate", () => {
      if (rafRef.current === null && !silentRef.current) return;
      publish(audio.currentTime * 1000);
    });

    return () => {
      genRef.current += 1;
      ac.abort();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [goRest, publish, refit, runSilent, startLoop, stopLoop]);

  /* -------------------------------------------------- reset when the word changes */

  useEffect(() => {
    nominalRef.current = nominal;
    genRef.current += 1;
    silentRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const audio = audioRef.current;
    if (audio && audio.getAttribute("src")) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    fittedRef.current = fitSlots(nominal, Number.NaN, rateRef.current);
    frameRef.current = REST_FRAME;
    setFrame(REST_FRAME);
    setSilent(false);
    setStatus("idle");
  }, [nominal]);

  /* -------------------------------------------------------------------- controls */

  const stop = useCallback(() => {
    genRef.current += 1;
    stopLoop();
    silentRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setSilent(false);
    goRest();
    setStatus("idle");
  }, [goRest, stopLoop]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    const trimmed = text.trim();
    const gen = ++genRef.current;
    stopLoop();
    silentRef.current = false;
    goRest();

    if (!audio || !trimmed || !nominalRef.current.length) {
      runSilent(gen);
      return;
    }

    setSilent(false);
    setStatus("loading");
    audio.pause();
    audio.currentTime = 0;
    audio.src = ttsUrl(trimmed, lang, rateRef.current);
    audio.load();
    fittedRef.current = fitSlots(nominalRef.current, Number.NaN, rateRef.current);

    void audio.play().catch(() => {
      // Autoplay refusal or a 500 from a backend without TTS credentials.
      // Either way the shapes are still worth showing.
      if (genRef.current !== gen) return;
      runSilent(gen);
    });
  }, [goRest, lang, runSilent, stopLoop, text]);

  const step = useCallback(
    (delta: number) => {
      genRef.current += 1;
      stopLoop();
      silentRef.current = false;
      const audio = audioRef.current;
      if (audio) audio.pause();
      setStatus("manual");
      const from = frameRef.current.isRest ? -1 : frameRef.current.index;
      const next = from + delta;
      gotoIndex(next < 0 ? -1 : Math.min(nominalRef.current.length - 1, next));
    },
    [gotoIndex, stopLoop]
  );

  const seekFraction = useCallback(
    (fraction: number) => {
      const n = nominalRef.current.length;
      if (!n) return;
      genRef.current += 1;
      stopLoop();
      silentRef.current = false;
      const audio = audioRef.current;
      if (audio) audio.pause();
      setStatus("manual");
      const f = Math.min(1, Math.max(0, fraction));
      gotoIndex(Math.min(n - 1, Math.floor(f * n)));
    },
    [gotoIndex, stopLoop]
  );

  return {
    status,
    frame,
    slots: nominal,
    reducedMotion,
    silent,
    play,
    stop,
    step,
    seekFraction,
  };
}
