"use client";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePracticeSession } from "@/hooks/use-api";
import { CallUI } from "../components/call-ui";
import { useState } from "react";
import Link from "next/link";

interface Props {
  sessionId: string;
  /** Learner settings, resolved on the server so the socket is configured
   * correctly on the first frame rather than after a client fetch. */
  settings: {
    accent: string;
    l1: string;
    retainAudio: boolean;
    listeningRate: number;
  };
}

/**
 * Action row under a gate card, so no state of this route is ever a dead end
 * the learner can only escape with the browser's back button.
 */
function GateActions({ sessionId }: { sessionId: string }) {
  return (
    <div className="flex flex-col-reverse items-center justify-center gap-2 pt-1 sm:flex-row">
      <Link
        href="/sessions"
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary"
      >
        Back to sessions
      </Link>
      <Link
        href={`/sessions/${sessionId}`}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover"
      >
        Open session report
      </Link>
    </div>
  );
}

export const CallView = ({ sessionId, settings }: Props) => {
  const { data, isLoading, error } = usePracticeSession(sessionId);
  // The status gates below are for *arriving* at this URL — a finished or
  // cancelled session should not open a call. Once the call UI is up, the
  // learner's own actions (join, leave) update the status, and the refetch
  // that follows must not yank the screen out from under them: it used to
  // replace the end-of-call screen with a dead-end "session has ended" card.
  const [hasEnteredCall, setHasEnteredCall] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-muted">
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-card px-4 sm:px-6">
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="flex w-full max-w-md flex-col items-center gap-8">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-3 w-full flex flex-col items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <ErrorState
          title="Failed to Load Practice Session"
          description="Could not load the practice session details. Please try again."
        />
        <div className="-mt-6">
          <GateActions sessionId={sessionId} />
        </div>
      </div>
    );
  }

  const notJoinable =
    data.status === "completed" ||
    data.status === "cancelled" ||
    data.status === "processing";

  if (notJoinable && !hasEnteredCall) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <ErrorState
          title={
            data.status === "completed"
              ? "Practice Session has Ended"
              : data.status === "cancelled"
                ? "Practice Session was Cancelled"
                : "Practice Session is Being Prepared"
          }
          description={
            data.status === "completed"
              ? "You can no longer join this practice session — open it to read the report."
              : data.status === "cancelled"
                ? "This session was cancelled and cannot be started. Create a new session to practise."
                : "The practice steps are still being generated. Refresh in a few seconds."
          }
        />
        <div className="-mt-6">
          <GateActions sessionId={sessionId} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen flex-1 flex-col overflow-hidden">
      <CallUI
        sessionId={sessionId}
        sessionName={data.name}
        coachName={data.coach?.name ?? "TalkFlow Coach"}
        coachInstructions={data.coach?.instructions ?? ""}
        script={data.script ?? null}
        source={data.source ?? "coach"}
        difficulty={data.difficulty ?? "medium"}
        topic={data.coach?.topic ?? ""}
        // A coach that specifies an accent wins; otherwise the learner's own
        // target accent is used, instead of silently defaulting to en-US.
        accent={data.coach?.accent || settings.accent}
        l1={settings.l1}
        retainAudio={settings.retainAudio}
        listeningRate={settings.listeningRate}
        onEntered={() => setHasEnteredCall(true)}
      />
    </div>
  );
};
