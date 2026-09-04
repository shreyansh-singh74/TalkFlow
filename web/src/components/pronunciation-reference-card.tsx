"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Pause, Volume2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { VisemeMouth, hintFor } from "@/components/viseme-mouth";
import { usePronunciationReference } from "@/hooks/use-pronunciation-reference";
import { useVisemeTimeline } from "@/hooks/use-viseme-timeline";
import { DIALECTS, requestSpeechVoices } from "@/lib/speak-word";
import { cn } from "@/lib/utils";
import type {
  ArpabetSyllableItem,
  MisalignedWordPair,
} from "@/types/pronunciation";

type Props = {
  displayWord: string;
  activeWordKey: string;
  lang: string;
  onLangChange: (lang: string) => void;
  /** Misaligned pairs for the phoneme diff row */
  misalignedPairs?: MisalignedWordPair[];
};

/**
 * The pronunciation reference content, row-2 of the call page.
 *
 * The surrounding chrome (border, radius, shadow, padding) belongs to the
 * row-2 group that mounts this card — call-active's row-2 <section> — so this
 * root is plain: the two-column text + mouth grid only.
 */
export function PronunciationReferenceCard({
  displayWord,
  activeWordKey,
  lang,
  onLangChange,
  misalignedPairs,
}: Props) {
  const idSlow = useId();
  const [isSlow, setIsSlow] = useState(false);
  const [showIPA, setShowIPA] = useState(false);
  const { data, loading, error } = usePronunciationReference(activeWordKey, lang);

  const spoken = (data?.word || displayWord || activeWordKey || "").trim();

  const {
    status,
    frame,
    slots,
    reducedMotion,
    silent,
    play,
    stop,
    step,
  } = useVisemeTimeline({
    text: spoken,
    phonemes: data?.phonemes,
    lang,
    rate: isSlow ? 0.65 : 1,
  });

  const isBusy = status === "playing" || status === "loading";

  useEffect(() => {
    requestSpeechVoices();
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
  }, []);

  // Find the misaligned pair for the active word to show heard IPA
  const activePair = misalignedPairs?.find(
    (p) => p.expected?.toLowerCase() === displayWord?.toLowerCase()
  );

  const syllables = data?.arpabet_syllables ?? [];
  const activeSyllable = frame.isRest ? -1 : frame.syllableIndex;

  /**
   * The step affordance is what makes this usable without audio at all — on a
   * machine with no TTS credentials, in a silent room, or with motion reduced.
   * Arrow keys walk the word one phone at a time.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (isBusy) {
        stop();
      } else {
        play();
      }
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
          Phonetic Breakdown
        </span>
        <div className="flex items-center gap-3">
          {/* IPA toggle */}
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-neutral-600">
            <Switch checked={showIPA} onCheckedChange={setShowIPA} className="scale-75" />
            IPA
          </label>
          {/* Dialect select */}
          <select
            className="rounded-md border px-2 py-1 text-xs font-semibold cursor-pointer bg-neutral-100 border-neutral-300 text-neutral-800 shadow-2xs"
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
          >
            {DIALECTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Pronunciation Section */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 space-y-2.5">
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Sounds like</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
              {loading ? (
                <p className="text-xl font-medium text-neutral-400">Loading phonetic breakdown…</p>
              ) : error ? (
                <p className="text-sm font-semibold text-amber-600">{error}</p>
              ) : data ? (
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold tracking-tight text-neutral-900">
                    <SyllableLine syllables={syllables} activeIndex={activeSyllable} />
                  </div>
                </div>
              ) : (
                <p className="text-2xl font-bold capitalize text-neutral-900">{displayWord}</p>
              )}

              {/* Play icon button directly next to sounds-like spelling */}
              <button
                type="button"
                onClick={() => (isBusy ? stop() : play())}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                title={isBusy ? "Stop" : isSlow ? "Play slow" : "Play"}
                aria-label={isBusy ? "Stop pronunciation" : "Play pronunciation"}
              >
                {isBusy ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4.5 w-4.5" />
                )}
              </button>

              {/* Slow toggle on the same row as the spelling */}
              <label
                htmlFor={idSlow}
                className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-neutral-600"
              >
                <Switch id={idSlow} checked={isSlow} onCheckedChange={setIsSlow} className="scale-75" />
                Slow speed
              </label>
            </div>
          </div>

          {showIPA && data?.ipa && (
            <p
              className="text-sm font-semibold text-neutral-600"
              style={{ fontFamily: "var(--font-phonetic)" }}
            >
              /{data.ipa}/
            </p>
          )}

          {/* Show expected vs heard comparison row if IPA toggle is on */}
          {showIPA && activePair && (
            <div className="border-t border-dashed border-neutral-200 pt-2">
              <HeardVsExpectedRow
                expected={activePair.expected}
                heard={activePair.heard}
              />
            </div>
          )}

          {/* Mismatch coaching note. Sized to its text rather than stretched
              across the cell — a one-line sentence in a full-width band read as
              a banner and pushed the phone strip down. */}
          {activePair && (
            <p className="w-fit max-w-full rounded-lg px-3 py-1.5 text-xs leading-relaxed bg-blue-50 border border-blue-200 text-blue-800 font-medium">
              Expected <strong className="text-blue-950">&ldquo;{activePair.expected}&rdquo;</strong>, heard{" "}
              <span className="font-bold text-red-600">&ldquo;{activePair.heard}&rdquo;</span>.
            </p>
          )}

          {/* Phone filmstrip — every mouth position in the word, at a glance,
              with no audio and no motion required. Click any phone to hold that
              shape. Sits inside the text cell so the mouth stays beside the
              whole block rather than above a full-width strip. */}
          {slots.length > 0 && (
            <div className="border-t border-dashed border-neutral-200 pt-2.5">
              <PhoneStrip
                slots={slots}
                activeIndex={frame.isRest ? -1 : frame.index}
                onPick={(i) => step(i - (frame.isRest ? -1 : frame.index))}
              />
            </div>
          )}
        </div>

        {/* The reference face: shape follows the phoneme currently being said.
            Clickable, because a diagram that only responds to a button 200px
            away reads as static decoration — which is exactly how the previous
            one read. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (isBusy) {
              stop();
            } else {
              play();
            }
          }}
          onKeyDown={onKeyDown}
          aria-label="Reference mouth position. Press space to play, arrow keys to step through each sound."
          className={cn(
            "flex shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 self-center justify-self-center",
            "bg-emerald-50/60 border border-emerald-200/80 shadow-2xs transition-colors",
            "hover:bg-emerald-50 hover:border-emerald-300",
            "outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          )}
        >
          <VisemeMouth
            pose={frame.pose}
            snap={reducedMotion}
            dimmed={status === "loading"}
            className="call-mouth"
          />
          <p className="min-h-7 max-w-32 text-center text-[10px] font-semibold leading-tight text-emerald-900/80">
            {status === "loading" ? "Loading audio…" : hintFor(frame.pose)}
          </p>
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-800/70">
            {isBusy
              ? silent
                ? "Silent demo"
                : "Reference mouth"
              : slots.length > 0
                ? "Tap to play"
                : "Reference mouth"}
          </span>
        </div>
      </div>
    </div>
  );
}

function SyllableLine({
  syllables,
  activeIndex,
}: {
  syllables: ArpabetSyllableItem[];
  activeIndex: number;
}) {
  if (!syllables.length) return null;
  return (
    <span
      className="text-2xl font-bold leading-snug text-neutral-900"
      style={{ fontFamily: "var(--font-phonetic)" }}
    >
      {syllables.map((s, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="text-neutral-400"> · </span>
          )}
          <span
            className={cn(
              "rounded px-0.5 transition-colors duration-150",
              i === activeIndex && "bg-emerald-100 text-emerald-900"
            )}
            // Only primary stress is bold. `stressed` is already primary-only,
            // but fall back to `stress_level` for payloads cached before the
            // field existed.
            style={{ fontWeight: (s.stress_level ?? (s.stressed ? 1 : 0)) === 1 ? 800 : 500 }}
          >
            {s.display}
          </span>
        </span>
      ))}
    </span>
  );
}

function PhoneStrip({
  slots,
  activeIndex,
  onPick,
}: {
  slots: ReturnType<typeof useVisemeTimeline>["slots"];
  activeIndex: number;
  onPick: (index: number) => void;
}) {
  const labels = useMemo(
    () => slots.map((s) => ({ index: s.index, symbol: s.symbol, pose: s.pose })),
    [slots]
  );
  return (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
      {labels.map((s) => (
        <button
          key={s.index}
          type="button"
          onClick={() => onPick(s.index)}
          title={hintFor(s.pose)}
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors cursor-pointer",
            s.index === activeIndex
              ? "border-emerald-400 bg-emerald-100 text-emerald-900"
              : "border-neutral-200 bg-neutral-50 text-neutral-500 hover:border-emerald-200 hover:text-emerald-800"
          )}
          style={{ fontFamily: "var(--font-phonetic)" }}
        >
          {s.symbol}
        </button>
      ))}
    </div>
  );
}

/**
 * Simple two-chip row: expected word (emerald) vs heard word (amber).
 * Shown when the user enables the IPA toggle and a mismatch pair exists.
 */
function HeardVsExpectedRow({
  expected,
  heard,
}: {
  expected: string;
  heard: string;
}) {
  return (
    <div className="mt-1 flex items-center gap-2 text-sm font-semibold" style={{ fontFamily: "var(--font-phonetic)" }}>
      <span className="rounded px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
        {expected}
      </span>
      <span className="text-neutral-400">→</span>
      <span className="rounded px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200">
        {heard}
      </span>
    </div>
  );
}
