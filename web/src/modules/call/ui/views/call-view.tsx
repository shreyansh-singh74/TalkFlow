"use client";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { usePracticeSession } from "@/hooks/use-api";
import { CallUI } from "../components/call-ui";

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

export const CallView = ({ sessionId, settings }: Props) => {
  const { data, isLoading, error } = usePracticeSession(sessionId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-50">
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-neutral-200 bg-white px-4 sm:px-6">
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
      <div className="flex flex-1 items-center justify-center">
        <ErrorState 
          title="Failed to Load Practice Session"
          description="Could not load the practice session details. Please try again."
        />
      </div>
    );
  }

  if(data.status === "completed"){
    return (
      <div className="flex flex-1 items-center justify-center">
            <ErrorState 
                title="Practice Session has Ended"
                description="You can no longer join this practice session."
            />
        </div>
    )
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
      />
    </div>
  )
};
