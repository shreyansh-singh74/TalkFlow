
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { GeneratedAvatarUri } from "@/lib/avatar";
import { LogInIcon } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useWebRTC } from "@/hooks/use-webrtc";

interface Props {
  onJoin: () => void;
}

export const CallLobby = ({ onJoin }: Props) => {
  const { data } = authClient.useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { attachLocalStream, isFetching, error, requestMedia, localStream } = useWebRTC({ video: true, audio: true });

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
          
          <div className="w-64 h-48 bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              autoPlay
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          
          <div className="flex gap-x-2">
            <Button variant="outline" size="sm" onClick={() => requestMedia()} disabled={isFetching}>
              {localStream ? "Refresh Preview" : "Allow Camera & Mic"}
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
