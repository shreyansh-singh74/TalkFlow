import { useState } from "react";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";
import { useUpdateMeeting } from "@/hooks/use-api";
import { MeetingStatus } from "@/modules/meetings/types";

interface Props {
  meetingId: string;
  meetingName: string;
  agentName: string;
  agentInstructions: string;
}

export const CallUI = ({ meetingId, meetingName, agentName, agentInstructions }: Props) => {
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  const updateMeeting = useUpdateMeeting();

  const handleJoin = async () => {
    updateMeeting.mutate({
      id: meetingId,
      status: MeetingStatus.Active,
      startedAt: new Date().toISOString(),
    });
    setShow("call");
  };
  
  const handleLeave = async () => {
    updateMeeting.mutate({
      id: meetingId,
      status: MeetingStatus.Completed,
      endedAt: new Date().toISOString(),
    });
    setShow("ended");
  };
  
  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
      {show == "lobby" && (
        <CallLobby
          onJoin={handleJoin}
        />
      )}
      {show == "call" && (
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <CallActive
            onLeave={handleLeave}
            meetingName={meetingName}
            meetingId={meetingId}
            agentName={agentName}
            agentInstructions={agentInstructions}
          />
        </div>
      )}
      {show == "ended" && <CallEnded />} 
    </div>
  );
};
