import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export interface SessionSample {
  id: string;
  /** What the tutor asked for. */
  target: string;
  /** The same sentence as heard, with the words that slipped flagged. */
  heard: { word: string; ok: boolean }[];
  /** 0–100 intelligibility score. */
  accuracy: number;
  /** Per-phoneme substitutions the aligner found. */
  diffs: { expected: string; actual: string }[];
  /** The one thing to change, with a placement cue. */
  fix: { sound: string; word: string; cue: string };
  duration: string;
}

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface SessionCardProps {
  sample: SessionSample;
  className?: string;
  /** Render at reduced scale for use as a secondary illustration. */
  compact?: boolean;
}

/**
 * Presentational mock of a practice session, for the marketing page only.
 * The real UI lives in `@/components/phoneme-feedback` and friends; that one is
 * styled for the /call page's palette, so this keeps the two from fighting.
 *
 * Colour carries meaning here: green is the target sound, amber is what actually
 * came out. Using green for both would make the diff unreadable at a glance.
 */
export function SessionCard({ sample, className, compact = false }: SessionCardProps) {
  const { target, heard, accuracy, diffs, fix, duration } = sample;
  /** Counts `diffs`, not flagged words — this label sits directly above the
   *  substitution chips, so counting words would contradict what's rendered
   *  ("1 sound to fix" beside two chips). */
  const slips = diffs.length;
  const dashOffset = RING_CIRCUMFERENCE * (1 - accuracy / 100);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-tf-border bg-tf-surface shadow-[0_2px_6px_-2px_rgba(8,32,26,0.1)]",
        className,
      )}
    >
      {/* Session chrome */}
      <div className="flex items-center justify-between border-b border-tf-border bg-tf-green-tint/50 px-5 py-3">
        <span className="flex items-center gap-2.5">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full rounded-full bg-tf-green opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-tf-green" />
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-tf-muted">
            Live session
          </span>
        </span>
        <span className="font-mono text-[11px] text-tf-subtle">{duration}</span>
      </div>

      <div className={cn("space-y-4 p-5", compact && "space-y-3 p-4")}>
        {/* Target vs. heard. Side by side at full size; stacked when compact,
            since the compact card sits in a half-width column. */}
        <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
          <div className="rounded-xl border border-tf-border bg-tf-bg p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
              Target
            </p>
            <p
              className={cn(
                "font-semibold leading-snug tracking-[-0.01em] text-tf-text",
                compact ? "text-[14.5px]" : "text-[15.5px]",
              )}
            >
              {target}
            </p>
          </div>

          <div className="rounded-xl border border-tf-border bg-tf-bg p-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
              Heard
            </p>
            <p
              className={cn(
                "flex flex-wrap gap-x-1.5 gap-y-1 font-semibold leading-snug",
                compact ? "text-[14.5px]" : "text-[15.5px]",
              )}
            >
              {heard.map((w, i) => (
                <span
                  key={`${w.word}-${i}`}
                  className={
                    w.ok
                      ? "text-tf-muted"
                      : "rounded bg-tf-amber-light px-1 text-tf-amber underline decoration-tf-amber/60 decoration-wavy decoration-1 underline-offset-4"
                  }
                >
                  {w.word}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Score + the sounds that caused it */}
        <div className="flex flex-col gap-4 rounded-xl border border-tf-border bg-tf-bg p-4 sm:flex-row sm:items-center sm:gap-5">
          <div className="relative shrink-0 self-start sm:self-auto">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              className="-rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--tf-border)"
                strokeWidth="5"
              />
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                stroke="var(--tf-green)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                className="score-ring-fill"
                style={
                  {
                    "--ring-circumference": RING_CIRCUMFERENCE,
                    "--ring-offset": dashOffset,
                  } as CSSProperties
                }
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-tf-text">
              {accuracy}
            </span>
            <span className="sr-only">{accuracy} out of 100 intelligibility</span>
          </div>

          <div className="min-w-0 space-y-2.5">
            <p className="text-[13px] font-medium text-tf-text">
              {slips === 0
                ? "Every sound landed."
                : `${slips} ${slips === 1 ? "sound" : "sounds"} to fix`}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {diffs.map(({ expected, actual }) => (
                <li
                  key={`${expected}-${actual}`}
                  className="flex items-center gap-1.5 rounded-md border border-tf-border bg-tf-surface px-2 py-1 font-mono text-[12px]"
                >
                  <span className="font-semibold text-tf-green-strong">{expected}</span>
                  <span className="text-tf-subtle" aria-label="became">
                    &rarr;
                  </span>
                  <span className="text-tf-amber">{actual}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The coaching cue — the differentiator, so it gets its own block */}
        <div className="rounded-xl border border-tf-green/25 bg-tf-green-light/70 p-4">
          <p className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[12px] font-semibold text-tf-green-strong">
            <span className="rounded bg-tf-green px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white">
              Fix
            </span>
            /{fix.sound}/ in &ldquo;{fix.word}&rdquo;
          </p>
          <p className="text-[13px] leading-relaxed text-tf-muted">{fix.cue}</p>
        </div>
      </div>
    </div>
  );
}
