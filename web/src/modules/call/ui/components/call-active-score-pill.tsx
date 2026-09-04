"use client";

import { cn } from "@/lib/utils";
import type { UIState } from "./call-active-controls";

interface CallActiveScorePillProps {
  /** Most recent pronunciation score, or null before the first attempt. */
  score: number | null;
  /** Score the current step must reach to advance. */
  passThreshold: number;
  uiState: UIState;
}

const PILL_BOX =
  "pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-3 py-1 shadow-md backdrop-blur-sm";

/**
 * The single authoritative score readout on the call page.
 *
 * Mounted inside row 1 so it straddles the top edge of the two practice panels.
 * Always renders (even before the first result) so the panels never shift when a
 * score lands. Colours are relative to the session's own pass threshold — the
 * same bands the header chip used — rather than the 95/80/50 bands the score
 * ring hardcodes, which are wrong for every tier.
 */
export function CallActiveScorePill({
  score,
  passThreshold,
  uiState,
}: CallActiveScorePillProps) {
  if (uiState === "Recording") {
    return (
      <div className={cn(PILL_BOX, "border-emerald-300")}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Listening…
        </span>
      </div>
    );
  }

  if (uiState === "Evaluating") {
    return (
      <div className={cn(PILL_BOX, "border-blue-300")}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
          Evaluating…
        </span>
      </div>
    );
  }

  if (score === null) {
    return (
      <div className={cn(PILL_BOX, "border-neutral-200")}>
        <span className="whitespace-nowrap text-[11px] font-semibold text-neutral-500">
          Speak to score · need {passThreshold}%
        </span>
      </div>
    );
  }

  const passed = score >= passThreshold;
  const band = passed
    ? "border-emerald-300 text-emerald-700"
    : score >= passThreshold - 15
      ? "border-blue-300 text-blue-700"
      : score >= passThreshold - 35
        ? "border-amber-300 text-amber-700"
        : "border-red-300 text-red-600";

  return (
    <div className={cn(PILL_BOX, band)}>
      <span className="text-base font-bold tabular-nums leading-none">{score}%</span>
      <span className="text-[10px] font-semibold text-neutral-500">
        {passed ? "passed" : `need ${passThreshold}%`}
      </span>
    </div>
  );
}
