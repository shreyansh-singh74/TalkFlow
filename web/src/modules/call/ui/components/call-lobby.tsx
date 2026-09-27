"use client";

import { Button } from "@/components/ui/button";
import { LogIn, Mic, X } from "lucide-react";
import Link from "next/link";
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_PASS_THRESHOLDS,
  type Difficulty,
  type PracticeScript,
  type SessionSource,
} from "@/types/practice";

interface Props {
  onJoin: () => void;
  sessionName: string;
  coachName: string;
  script: PracticeScript | null;
  source: SessionSource;
  difficulty: Difficulty;
}

export const CallLobby = ({
  onJoin,
  sessionName,
  coachName,
  script,
  source,
  difficulty,
}: Props) => {
  const steps = script?.steps ?? [];
  const passThreshold =
    script?.pass_threshold ?? DIFFICULTY_PASS_THRESHOLDS[difficulty];

  return (
    <div className="flex min-h-screen flex-col bg-muted text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-card px-4 sm:px-6">
        <Button
          asChild
          variant="ghost"
          className="gap-2 rounded-full px-3 text-sm text-danger hover:bg-danger/10 hover:text-danger"
        >
          <Link href="/sessions">
            <X className="h-4 w-4" />
            Close
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          {/* Icon */}
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-success/30 bg-success/10 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <Mic className="h-10 w-10 text-brand-accent" />
            </div>
            {/* Animated ring */}
            <span
              className="mic-pulse-ring absolute inset-0 rounded-full bg-primary/10"
            />
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {coachName}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {sessionName || "Ready to practise?"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hold{" "}
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">
                SPACE
              </kbd>{" "}
              to talk; release to submit. Microphone access is requested when you
              start speaking.
            </p>
          </div>

          {/* What this session actually contains */}
          <div className="w-full space-y-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {script?.source_label ??
                  (source === "custom" ? "Your text" : coachName)}
              </span>
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                {DIFFICULTY_LABELS[difficulty]}
              </span>
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                Pass at {passThreshold}%
              </span>
            </div>

            {steps.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {steps.length} {steps.length === 1 ? "step" : "steps"} — first
                  up:
                </p>
                <ol className="space-y-1.5">
                  {steps.slice(0, 3).map((step) => (
                    <li
                      key={step.index}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <span className="w-4 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                        {step.index + 1}
                      </span>
                      <span className="leading-snug">{step.text}</span>
                    </li>
                  ))}
                </ol>
                {steps.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    + {steps.length - 3} more
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
                This session has no saved steps, so you&apos;ll practise generic{" "}
                {DIFFICULTY_LABELS[difficulty].toLowerCase()} sentences. Edit the
                session to build a real script.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex w-full justify-center">
            <button
              type="button"
              onClick={onJoin}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_4px_20px_rgba(16,185,129,0.25)] transition-all duration-200 hover:bg-primary-hover active:scale-95 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              Start Practice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
