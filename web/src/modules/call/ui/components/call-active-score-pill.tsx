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
  "pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full border bg-card/95 px-3 py-1 shadow-md backdrop-blur-sm";

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
      <div className={cn(PILL_BOX, "border-success/40")}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          Listening…
        </span>
      </div>
    );
  }

  if (uiState === "Evaluating") {
    return (
      <div className={cn(PILL_BOX, "border-info/40")}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-info">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-info/100" />
          Evaluating…
        </span>
      </div>
    );
  }

  if (score === null) {
    return (
      <div className={cn(PILL_BOX, "border-border")}>
        <span className="whitespace-nowrap text-[11px] font-semibold text-muted-foreground">
          Speak to score · need {passThreshold}%
        </span>
      </div>
    );
  }

  const passed = score >= passThreshold;
  const band = passed
    ? "border-success/40 text-primary"
    : score >= passThreshold - 15
      ? "border-info/40 text-info"
      : score >= passThreshold - 35
        ? "border-warning/40 text-warning"
        : "border-danger/40 text-danger";

  return (
    <div className={cn(PILL_BOX, band)}>
      <span className="text-base font-bold tabular-nums leading-none">
        {Math.round(score)}%
      </span>
      <span className="text-[10px] font-semibold text-muted-foreground">
        {passed ? "passed" : `need ${passThreshold}%`}
      </span>
    </div>
  );
}
