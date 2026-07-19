"use client";

import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 95) return { stroke: "score-stroke-green", text: "score-color-green", label: "Excellent!" };
  if (score >= 80) return { stroke: "score-stroke-blue", text: "score-color-blue", label: "Good" };
  if (score >= 50) return { stroke: "score-stroke-amber", text: "score-color-amber", label: "Keep trying" };
  return { stroke: "score-stroke-red", text: "score-color-red", label: "Needs work" };
}

export function ScoreRing({ score, size = 120, strokeWidth = 8, className }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = getScoreColor(score);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center animate-scale-pop", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn("score-ring-fill", colors.stroke)}
          style={{
            strokeDasharray: circumference,
            ["--ring-circumference" as string]: circumference,
            ["--ring-offset" as string]: offset,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center score-ring-text">
        <span className={cn("text-3xl font-bold tabular-nums", colors.text)}>
          {score}
          <span className="text-lg">%</span>
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mt-0.5">
          {colors.label}
        </span>
      </div>
    </div>
  );
}
