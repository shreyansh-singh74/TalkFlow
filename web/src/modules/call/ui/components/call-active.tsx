import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/use-webrtc";
import { Mic, MicOff, Camera, CameraOff, PhoneOff } from "lucide-react";

interface Props {
  onLeave: () => void;
  meetingName: string;
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

export const CallActive = ({
  onLeave,
  meetingName,
  attachLocalStream,
  requestMedia,
  localStream,
  isFetching,
  error,
  isCameraOn,
  isMicOn,
  toggleCamera,
  toggleMic,
}: Props) => {
  return (
    <div className="flex flex-col justify-between p-4 h-full text-white">
      <div className="bg-[#101213] rounded-full flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit"
        >
          <Image src="/logo.svg" width={22} height={22} alt="Logo" />
        </Link>
        <h4 className="text-base">{meetingName}</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        {/* Left: Video and call controls */}
        <div className="md:col-span-2 flex flex-col gap-y-4 items-center justify-center">
          <div className="w-full flex items-center justify-center bg-black/50 rounded-lg relative px-4 py-4">
            {localStream && isCameraOn ? (
              <div className="w-full flex items-center justify-center">
                <video
                  ref={attachLocalStream}
                  className="max-w-4xl w-full aspect-video object-cover rounded-lg"
                  muted
                  playsInline
                  autoPlay
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-white/80">
                <CameraOff className="w-12 h-12 mb-2" />
                <p className="text-sm">Camera is off</p>
              </div>
            )}
          </div>
          <div className="bg-[#101213] rounded-full px-4 py-2">
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="link"
                size="icon"
                onClick={toggleMic}
                className="h-10 w-10"
              >
                {isMicOn ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="link"
                size="icon"
                onClick={toggleCamera}
                className="h-10 w-10"
              >
                {isCameraOn ? (
                  <Camera className="h-5 w-5" />
                ) : (
                  <CameraOff className="h-5 w-5" />
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={onLeave}
                className="h-10 px-4"
              >
                Leave
              </Button>
            </div>

            {error && (
              <p className="text-center text-red-500 text-xs mt-1">{error}</p>
            )}
          </div>

          <div className="flex flex-col items-center justify-center gap-y-4 h-40 bg-[#1a1a1a] rounded-lg p-4 w-[900px] mt-4">
            <h1 className="text-lg font-medium text-center">Here The Correct Pronounciation will come</h1>
            <p className="text-sm text-center">Here The Correct Pronounciation will come</p>
          </div>
        </div>

        {/* Right: Meta pane */}
        <div className="flex-1 flex items-center justify-center bg-white/10 rounded-lg relative px-4 py-4 mt-4">
          <div className="flex flex-col items-center justify-center">
            <h4 className="text-base">{meetingName}</h4>
            <p className="text-sm">{meetingName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
