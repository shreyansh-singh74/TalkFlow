"use client";

import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CallEndedProps {
  sessionId: string;
}

/**
 * Shown when a call is abandoned before any report exists (leaving mid-session
 * flushes the entries, then lands here). When the session completed normally
 * the learner skips this screen entirely and goes straight to the report.
 */
export const CallEnded = ({ sessionId }: CallEndedProps) => {
  return (
    <div className="flex h-full min-h-screen flex-col bg-muted text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-card px-4 sm:px-6">
        <Button
          asChild
          variant="ghost"
          className="gap-2 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <Link href="/sessions">
            <X className="h-4 w-4" />
            Close
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center animate-fade-in-up">
          {/* Icon */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 border-2 border-success/30 animate-float">
            <CheckCircle2 className="h-9 w-9 text-brand-accent" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Session ended
            </h1>
            <p className="text-sm text-muted-foreground">
              Everything you practised is saved. Open the session to read it
              back.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px w-full bg-muted" />

          {/* CTA */}
          <Link
            href={`/sessions/${sessionId}`}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary-hover active:scale-95"
          >
            View session report
          </Link>
        </div>
      </div>
    </div>
  );
};
