import { useState } from "react";
import { CallLobby } from "./call-loby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingName: string;
}

export const CallUI = ({ meetingName }: Props) => {
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");

  const handleJoin = async () => {
    // TODO: Implement custom WebRTC join logic
    console.log("Joining WebRTC call");
    setShow("call");
  };
  
  const handleLeave = async () => {
    // TODO: Implement custom WebRTC leave logic
    console.log("Leaving WebRTC call");
    setShow("ended");
  };
  
  return (
    <div className="h-full">
      {show == "lobby" && <CallLobby onJoin={handleJoin} />}
      {show == "call" && <CallActive onLeave={handleLeave} meetingName={meetingName} />}
      {show == "ended" && <CallEnded />} 
    </div>
  );
};
