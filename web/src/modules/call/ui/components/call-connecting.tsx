"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, PhoneOff, RefreshCw } from "lucide-react";

interface CallConnectingProps {
  /** Live status from the engine: reconnect countdowns, token errors. */
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

/**
 * Full-screen gate between "Join" and the practice UI. The call used to render
 * its half-initialized state while the socket handshake and the first practice
 * target were still in flight — "Connecting…" as the target sentence, an empty
 * audio player, disabled controls. The learner now waits here instead, and the
 * practice UI appears only once the session is actually ready.
 */
export function CallConnecting({ error, onRetry, onCancel }: CallConnectingProps) {
  const [elapsedSlow, setElapsedSlow] = useState(false);

  // If connecting is taking suspiciously long, say what to check instead of
  // leaving a spinner with no diagnosis. The common causes are a backend that
  // is not running and a mic permission prompt nobody answered.
  useEffect(() => {
    const timer = setTimeout(() => setElapsedSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  // After the automatic retries gave up, the error stops changing — surface
  // the manual retry affordance then.
  const exhausted = error === "Connection lost. Please refresh.";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-success/20" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-success/30 bg-success/10">
          <Mic className="h-8 w-8 text-brand-accent" />
        </span>
      </div>

      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Connecting to your coach…
        </h1>
        <p
          className={
            error
              ? "text-sm font-medium text-warning"
              : "text-sm text-muted-foreground"
          }
          role="status"
        >
          {error ?? "Setting up the session. Allow microphone access if your browser asks."}
        </p>
        {!error && elapsedSlow && (
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-warning">
            Still connecting — check that the practice backend is running, and
            that microphone access was not blocked for this site.
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse items-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-secondary"
        >
          <PhoneOff className="h-4 w-4" />
          Cancel
        </button>
        {exhausted && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
      </div>

      <Link
        href="/sessions"
        className="text-xs text-muted-foreground underline underline-offset-4 hover:text-muted-foreground"
      >
        Back to sessions
      </Link>
    </div>
  );
}
