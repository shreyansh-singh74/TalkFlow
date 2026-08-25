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
 */
export function SessionCard({ sample, className, compact = false }: SessionCardProps) {
  const { target, heard, accuracy, diffs, fix, duration } = sample;
  const misses = heard.filter((w) => !w.ok).length;
  const dashOffset = RING_CIRCUMFERENCE * (1 - accuracy / 100);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-tf-border bg-tf-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {/* Session chrome */}
      <div className="flex items-center justify-between border-b border-tf-border px-5 py-3.5">
        <span className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-tf-green opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-tf-green" />
          </span>
          <span className="font-mono text-[11px] tracking-wider text-tf-muted">
            LIVE SESSION
          </span>
        </span>
        <span className="font-mono text-[11px] text-tf-muted">{duration}</span>
      </div>

      <div className={cn("space-y-4 p-5", compact && "space-y-3 p-4")}>
        {/* Target vs. heard */}
        <div className="space-y-3">
          <div>
            <p className="tf-eyebrow mb-2 border-0 p-0">Target</p>
            <p
              className={cn(
                "font-semibold text-tf-text",
                compact ? "text-[15px]" : "text-lg",
              )}
            >
              &ldquo;{target}&rdquo;
            </p>
          </div>

          <div>
            <p className="tf-eyebrow mb-2 border-0 p-0">Heard</p>
            <p
              className={cn(
                "flex flex-wrap gap-x-1.5 gap-y-1 font-semibold",
                compact ? "text-[15px]" : "text-lg",
              )}
            >
              {heard.map((w, i) => (
                <span
                  key={`${w.word}-${i}`}
                  className={
                    w.ok
                      ? "text-tf-muted"
                      : "rounded bg-tf-green-light px-1 text-tf-green-strong underline decoration-tf-green decoration-wavy decoration-1 underline-offset-4"
                  }
                >
                  {w.word}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Score + the sounds that caused it */}
        <div className="flex items-center gap-5 rounded-xl border border-tf-border bg-tf-bg p-4">
          <div className="relative shrink-0">
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
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-tf-text">
              {accuracy}
            </span>
            <span className="sr-only">{accuracy} out of 100 intelligibility</span>
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-[13px] font-medium text-tf-text">
              {misses === 0
                ? "Every sound landed."
                : `${misses} ${misses === 1 ? "sound" : "sounds"} to fix`}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {diffs.map(({ expected, actual }) => (
                <li
                  key={`${expected}-${actual}`}
                  className="flex items-center gap-1 rounded-md border border-tf-border bg-tf-surface px-2 py-0.5 font-mono text-[12px]"
                >
                  <span className="text-tf-green-strong">{expected}</span>
                  <span className="text-tf-muted" aria-label="became">
                    &rarr;
                  </span>
                  <span className="text-tf-text">{actual}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The coaching cue — the differentiator, so it gets its own block */}
        <div className="rounded-xl border border-tf-green/25 bg-tf-green-light/60 p-4">
          <p className="mb-1 font-mono text-[12px] font-medium text-tf-green-strong">
            Fix /{fix.sound}/ in &ldquo;{fix.word}&rdquo;
          </p>
          <p className="text-[13px] leading-relaxed text-tf-muted">{fix.cue}</p>
        </div>
      </div>
    </div>
  );
}
