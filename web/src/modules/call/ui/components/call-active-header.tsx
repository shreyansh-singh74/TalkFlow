"use client";

import { PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTY_LABELS, type Difficulty, type PracticeStep } from "@/types/practice";

/**
 * Above this many steps the segmented bar degrades to a continuous one — a
 * 40-step speech would otherwise render 40 slivers a few pixels wide.
 */
const MAX_SEGMENTS = 20;

type StepState = "done" | "failed" | "skipped" | "current" | "pending";

/**
 * A step behind the cursor with no recorded score was advanced past without an
 * attempt — read it as skipped rather than claiming it was passed.
 */
function stateFor(
  index: number,
  currentIndex: number,
  skipped: Set<number>,
  scoreByStep: Record<number, number>,
  passThreshold: number
): StepState {
  if (index === currentIndex) return "current";
  if (skipped.has(index)) return "skipped";
  if (index > currentIndex) return "pending";
  const best = scoreByStep[index];
  if (best === undefined) return "skipped";
  return best >= passThreshold ? "done" : "failed";
}

const SEGMENT_STYLES: Record<StepState, string> = {
  done: "bg-emerald-600",
  failed: "bg-red-400",
  skipped: "bg-amber-400",
  current: "bg-emerald-500 progress-shimmer",
  pending: "bg-neutral-200",
};

const SEGMENT_TITLES: Record<StepState, string> = {
  done: "Completed",
  failed: "Failed",
  skipped: "Skipped",
  current: "Active",
  pending: "Not reached",
};

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface CallActiveHeaderProps {
  sessionName: string;
  coachName: string;
  practiceProgress: { current: number; total: number };
  /** The session's script. Empty whenever `script` is null, which happens when
   * the backend's fallback bank drives progression instead. */
  steps?: PracticeStep[];
  /** Zero-based step indexes the user chose to skip. */
  skippedSteps?: Set<number>;
  /** Best score seen per step index, so a passed step reads as passed. */
  scoreByStep?: Record<number, number>;
  passThreshold: number;
  difficulty: Difficulty;
  sourceLabel?: string | null;
  onLeave: () => void;
}

export function CallActiveHeader({
  coachName,
  practiceProgress,
  steps = [],
  skippedSteps = new Set(),
  scoreByStep = {},
  passThreshold,
  difficulty,
  sourceLabel,
  onLeave,
}: CallActiveHeaderProps) {
  const total = Math.max(1, practiceProgress.total);
  const progressPct = Math.min(100, (practiceProgress.current / total) * 100);
  const skippedCount = skippedSteps.size;
  // When a script is present it is authoritative for the segment list; the
  // backend's fallback bank otherwise sets `practiceProgress` on its own. Never
  // assume the two lengths agree.
  const segmentCount = steps.length > 0 ? steps.length : total;
  const useSegments = segmentCount <= MAX_SEGMENTS;
  const hasSteps = steps.length > 0;
  // 1-based `practiceProgress.current` ↔ zero-based engine cursor.
  const currentIndex = practiceProgress.current - 1;

  return (
    <header className="glass-panel-strong call-header relative z-20 flex shrink-0 items-center justify-between gap-3 px-4 sm:px-6 bg-white/90 border-b border-neutral-200 shadow-2xs">
      {/* Left: Coach name + what's being drilled */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
          <span className="text-[11px] font-bold text-emerald-700">AI</span>
        </div>
        <div className="min-w-0">
          <span
            className="block truncate text-xs font-bold tracking-tight text-neutral-900"
            title={coachName}
          >
            {coachName}
          </span>
          {sourceLabel && (
            <span
              className="hidden truncate text-[10px] font-medium text-neutral-500 sm:block"
              title={sourceLabel}
            >
              {sourceLabel}
            </span>
          )}
        </div>
      </div>

      {/* Center: progress */}
      <div className="flex items-center gap-2 flex-1 max-w-md mx-2">
        {useSegments ? (
          <div className="flex flex-1 items-center gap-1">
            {Array.from({ length: segmentCount }).map((_, idx) => {
              if (hasSteps) {
                const state = stateFor(idx, currentIndex, skippedSteps, scoreByStep, passThreshold);
                const score = scoreByStep[idx];
                const stepText = steps[idx]?.text;
                const parts = [`Step ${idx + 1}`];
                if (score !== undefined) parts.push(`${Math.round(score)}%`);
                if (stepText) parts.push(`"${truncate(stepText)}"`);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-all duration-500",
                      SEGMENT_STYLES[state]
                    )}
                    title={parts.join(" · ")}
                  />
                );
              }

              // Fallback when there is no script (generic bank): the progress
              // payload alone says where you are.
              const isSkipped = skippedSteps.has(idx);
              const isCompleted = idx + 1 < practiceProgress.current && !isSkipped;
              const isActive = idx + 1 === practiceProgress.current;
              const state: StepState = isSkipped
                ? "skipped"
                : isCompleted
                  ? "done"
                  : isActive
                    ? "current"
                    : "pending";
              return (
                <div
                  key={idx}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-500",
                    SEGMENT_STYLES[state]
                  )}
                  title={`Step ${idx + 1}: ${SEGMENT_TITLES[state]}`}
                />
              );
            })}
          </div>
        ) : (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* Step badge */}
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-300">
          Step {practiceProgress.current}/{Math.max(1, segmentCount)}
        </span>

        {/* Difficulty + threshold */}
        <span
          className="hidden shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-300 lg:block"
          title={`Score ${passThreshold}% or more to advance`}
        >
          {DIFFICULTY_LABELS[difficulty]} · {passThreshold}%
        </span>

        {/* Skipped count badge */}
        {skippedCount > 0 && (
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            {skippedCount} Skipped
          </span>
        )}
      </div>

      {/* Right: Leave. The percentage that used to sit here said the same thing
          as the step badge two elements to its left. */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-150 bg-red-50 hover:bg-red-100 active:scale-95 cursor-pointer text-red-600 border border-red-200 shadow-2xs"
        >
          <PhoneOff className="h-3 w-3" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
}
