"use client";

import { useMemo } from "react";
import { Bot, LogOut, RotateCcw, Trophy, SkipForward } from "lucide-react";
import { ScoreRing } from "./call-active-score-ring";
import type { SessionAnalysisReport } from "@/types/pronunciation";

interface CallActiveCompleteProps {
  sessionReport: SessionAnalysisReport;
  scoreHistory: number[];
  skippedLevelsCount?: number;
  onRestart: () => void;
  onLeave: () => void;
}

const CONFETTI_COLORS = ["#10b981", "#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#ec4899"];

export function CallActiveComplete({
  sessionReport,
  scoreHistory,
  skippedLevelsCount = 0,
  onRestart,
  onLeave,
}: CallActiveCompleteProps) {
  const bestScore = useMemo(
    () => (scoreHistory.length > 0 ? Math.max(...scoreHistory) : 0),
    [scoreHistory]
  );

  const skippedWords = sessionReport.words_skipped || [];

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col items-center justify-center p-6 overflow-y-auto">
      {/* Confetti overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${-10 - Math.random() * 20}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
              width: `${4 + Math.random() * 6}px`,
              height: `${4 + Math.random() * 6}px`,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            }}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="relative z-10 w-full max-w-xl glass-panel-strong rounded-3xl p-8 flex flex-col items-center text-center gap-6 animate-fade-in-up">
        {/* Trophy */}
        <div className="animate-float">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.15))",
              border: "2px solid rgba(16,185,129,0.25)",
              boxShadow: "0 0 40px rgba(16,185,129,0.15)",
            }}
          >
            <Trophy className="h-10 w-10 text-emerald-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1
            className="text-3xl font-extrabold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #10b981, #14b8a6, #06b6d4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Practice Complete!
          </h1>
          <p className="text-sm text-neutral-400">
            You successfully completed the practice session
          </p>
        </div>

        {/* Score ring + stats */}
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full my-2">
          <ScoreRing score={Math.round(sessionReport.overall_score)} size={130} strokeWidth={10} />

          <div className="flex-1 grid grid-cols-2 gap-3 w-full">
            {[
              { label: "Fluency", value: Math.round(sessionReport.fluency_score) },
              { label: "Clarity", value: Math.round(sessionReport.clarity_score) },
              { label: "Best Score", value: bestScore },
              { label: "Skipped", value: `${skippedLevelsCount} levels`, highlightAmber: skippedLevelsCount > 0 },
            ].map(({ label, value, highlightAmber }) => (
              <div
                key={label}
                className="rounded-xl p-3 flex flex-col items-center glass-panel"
              >
                <span className="text-[9px] text-neutral-500 font-bold tracking-wider uppercase">
                  {label}
                </span>
                <span
                  className={`text-lg font-bold mt-0.5 tabular-nums ${
                    highlightAmber ? "text-amber-400" : "text-neutral-200"
                  }`}
                >
                  {typeof value === "number" && label !== "Words" ? `${value}%` : value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Skipped sentences / words badge section in Yellow (Amber) */}
        {(skippedLevelsCount > 0 || skippedWords.length > 0) && (
          <div className="w-full rounded-xl p-4 text-left bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <div className="flex items-center gap-2 mb-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
              <SkipForward className="h-4 w-4" />
              <span>Skipped in this Session ({skippedLevelsCount} levels)</span>
            </div>
            {skippedWords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {skippedWords.map((word, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >
                    {word}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Strengths & improvements */}
        {(sessionReport.strengths.length > 0 || sessionReport.areas_to_improve.length > 0) && (
          <div className="w-full flex flex-col gap-3">
            {sessionReport.strengths.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 justify-center">
                {sessionReport.strengths.slice(0, 4).map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            )}
            {sessionReport.areas_to_improve.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 justify-center">
                {sessionReport.areas_to_improve.slice(0, 4).map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  >
                    ↑ {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Coach summary */}
        <div className="w-full rounded-xl p-5 text-left glass-panel">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Coach Summary
            </span>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed italic">
            &ldquo;{sessionReport.coach_feedback || "Excellent job completing your practice session!"}&rdquo;
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #10b981, #14b8a6)",
              boxShadow: "0 4px 20px rgba(16,185,129,0.25)",
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Practice Again
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-neutral-300 hover:text-white transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 glass-panel hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Exit Session
          </button>
        </div>
      </div>
    </div>
  );
}
