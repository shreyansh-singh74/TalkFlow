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
          <p className="mt-2 text-white">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorState 
          title="Failed to Load Meeting"
          description="Could not load the meeting details. Please try again."
        />
      </div>
    );
  }

  if(data.status === "completed"){
    return (
      <div className="flex flex-1 items-center justify-center">
            <ErrorState 
                title="Meeting has Ended"
                description="You can no longer join this meeting."
            />
        </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <CallUI
        meetingId={meetingId}
        meetingName={data.name}
      />
    </div>
  )
};
