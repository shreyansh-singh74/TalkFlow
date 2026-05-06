import { useState } from "react";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingId: string;
  meetingName: string;
}

export const CallUI = ({ meetingId, meetingName }: Props) => {
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");

  const handleJoin = async () => {
    setShow("call");
  };
  
  const handleLeave = async () => {
    setShow("ended");
  };
  
  return (
    <div className="flex h-full min-h-0 flex-col">
      {show == "lobby" && (
        <CallLobby
          onJoin={handleJoin}
        />
      )}
      {show == "call" && (
        <div className="min-h-0 flex-1">
          <CallActive
            onLeave={handleLeave}
            meetingName={meetingName}
            meetingId={meetingId}
          />
        </div>
      )}
      {show == "ended" && <CallEnded />} 
    </div>
  );
};
