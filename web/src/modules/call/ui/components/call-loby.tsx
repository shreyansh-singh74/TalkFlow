
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { GeneratedAvatarUri } from "@/lib/avatar";
import { LogInIcon, Mic, MicOff, Camera, CameraOff, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useWebRTC } from "@/hooks/use-webrtc";

interface Props {
  onJoin: () => void;
  attachLocalStream: (el: HTMLVideoElement | null) => void;
  requestMedia: () => Promise<void>;
  localStream: MediaStream | null;
  isFetching: boolean;
  error: string | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  toggleCamera: () => void;
  toggleMic: () => void;
}

export const CallLobby = ({ onJoin, attachLocalStream, requestMedia, localStream, isFetching, error, isCameraOn, isMicOn, toggleCamera, toggleMic }: Props) => {
  const { data } = authClient.useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    attachLocalStream(videoRef.current);
  }, [attachLocalStream]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-radial from-sidebar-accent to-sidebar">
      <div className="py-4 px-8 flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg p-10 shadow-sm">
          <div className="flex flex-col gap-y-2 text-center">
            <h6 className="text-lg font-medium">Ready to join?</h6>
            <p className="text-sm">Set up your call before joining</p>
          </div>
          
          <div className="w-64 h-48 bg-black rounded-lg flex items-center justify-center overflow-hidden relative">
            {localStream && isCameraOn ? (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-white/80">
                <CameraOff className="w-10 h-10 mb-2" />
                <p className="text-xs">Camera is off</p>
              </div>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-3 py-1">
              <Button variant="ghost" size="icon" onClick={toggleMic} className="h-8 w-8 text-white">
                {isMicOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleCamera} className="h-8 w-8 text-white">
                {isCameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          
          <div className="flex gap-x-2">
            <Button variant="outline" size="sm" onClick={() => requestMedia()} disabled={isFetching}>
              {!localStream ? "Allow Camera & Mic" : (
                <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Refresh Preview</span>
              )}
            </Button>
          </div>
          
          <div className="flex gap-x-2 justify-between w-full">
            <Button asChild variant="ghost">
              <Link href="/meetings">
                Cancel
              </Link>
            </Button>
            <Button onClick={onJoin} disabled={!localStream || isFetching}>
              <LogInIcon />
              Join Call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
