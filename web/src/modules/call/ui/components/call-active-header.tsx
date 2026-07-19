"use client";

import { PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CallActiveHeaderProps {
  meetingName: string;
  agentName: string;
  practiceProgress: { current: number; total: number };
  skippedLevels?: Set<number>;
  lastScore: number | null;
  onLeave: () => void;
}

export function CallActiveHeader({
  agentName,
  practiceProgress,
  skippedLevels = new Set(),
  lastScore,
  onLeave,
}: CallActiveHeaderProps) {
  const progressPct = (practiceProgress.current / practiceProgress.total) * 100;
  const skippedCount = skippedLevels.size;

  return (
    <header className="glass-panel-strong relative z-20 flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6 bg-white/90 border-b border-neutral-200 shadow-2xs">
      {/* Left: Agent name */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
          <span className="text-[11px] font-bold text-emerald-700">AI</span>
        </div>
        <span
          className="truncate text-xs font-bold tracking-tight text-neutral-900"
          title={agentName}
        >
          {agentName}
        </span>
      </div>

      {/* Center: Segmented progress bar */}
      <div className="flex items-center gap-2 flex-1 max-w-md mx-2">
        <div className="flex flex-1 items-center gap-1">
          {Array.from({ length: practiceProgress.total }).map((_, idx) => {
            const lvl = idx + 1;
            const isSkipped = skippedLevels.has(lvl);
            const isCompleted = lvl < practiceProgress.current && !isSkipped;
            const isActive = lvl === practiceProgress.current;

            return (
              <div
                key={idx}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  isSkipped && "bg-amber-400 shadow-2xs",
                  isCompleted && "bg-emerald-600",
                  isActive && "bg-emerald-500 progress-shimmer",
                  !isCompleted && !isSkipped && !isActive && "bg-neutral-200"
                )}
                title={
                  isSkipped
                    ? `Level ${lvl}: Skipped`
                    : isCompleted
                    ? `Level ${lvl}: Completed`
                    : isActive
                    ? `Level ${lvl}: Active`
                    : `Level ${lvl}: Locked`
                }
              />
            );
          })}
        </div>

        {/* Level badge */}
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-neutral-100 text-neutral-700 border border-neutral-300">
          Lvl {practiceProgress.current}/{practiceProgress.total}
        </span>

        {/* Skipped count badge */}
        {skippedCount > 0 && (
          <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
            {skippedCount} Skipped
          </span>
        )}

        {/* Last score chip */}
        {lastScore !== null && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tabular-nums",
              lastScore >= 95
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : lastScore >= 80
                ? "bg-blue-100 text-blue-800 border border-blue-300"
                : lastScore >= 50
                ? "bg-amber-100 text-amber-800 border border-amber-300"
                : "bg-red-100 text-red-800 border border-red-300"
            )}
          >
            {lastScore}%
          </span>
        )}
      </div>

      {/* Right: Progress % + Leave */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:block text-xs tabular-nums font-bold text-neutral-600">
          {Math.round(progressPct)}%
        </span>
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
