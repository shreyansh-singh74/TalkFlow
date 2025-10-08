import { useState } from "react";
import { useWebRTC } from "@/hooks/use-webrtc";
import { CallLobby } from "./call-loby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  meetingName: string;
}

export const CallUI = ({ meetingName }: Props) => {
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  // Single shared WebRTC instance across lobby and active screens
  const webrtc = useWebRTC({ video: true, audio: true });

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
      {show == "lobby" && (
        <CallLobby
          onJoin={handleJoin}
          attachLocalStream={webrtc.attachLocalStream}
          requestMedia={webrtc.requestMedia}
          localStream={webrtc.localStream}
          isFetching={webrtc.isFetching}
          error={webrtc.error}
          isCameraOn={webrtc.isCameraOn}
          isMicOn={webrtc.isMicOn}
          toggleCamera={webrtc.toggleCamera}
          toggleMic={webrtc.toggleMic}
        />
      )}
      {show == "call" && (
        <CallActive
          onLeave={handleLeave}
          meetingName={meetingName}
          attachLocalStream={webrtc.attachLocalStream}
          requestMedia={webrtc.requestMedia}
          localStream={webrtc.localStream}
          isFetching={webrtc.isFetching}
          error={webrtc.error}
          isCameraOn={webrtc.isCameraOn}
          isMicOn={webrtc.isMicOn}
          toggleCamera={webrtc.toggleCamera}
          toggleMic={webrtc.toggleMic}
        />
      )}
      {show == "ended" && <CallEnded />} 
    </div>
  );
};
