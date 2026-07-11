"use client";
import { ErrorState } from "@/components/error-state";
import { useMeeting } from "@/hooks/use-api";
import { CallUI } from "../components/call-ui";

interface Props {
  meetingId: string;
}

export const CallView = ({ meetingId }: Props) => {
  const { data, isLoading, error } = useMeeting(meetingId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-white">Loading practice session...</p>
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
        meetingId={meetingId}
        meetingName={data.name}
        agentName={data.agent?.name ?? "TalkFlow Coach"}
        agentInstructions={data.agent?.instructions ?? ""}
      />
    </div>
  )
};
