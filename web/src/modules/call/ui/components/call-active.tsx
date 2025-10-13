import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/use-webrtc";
import { Mic, MicOff, Camera, CameraOff, PhoneOff, Radio, Square } from "lucide-react";
import { useCallTranscription } from "@/hooks/use-call-transcription";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const {
    recording,
    processing,
    transcripts,
    error: transcriptionError,
    startRecording,
    stopRecording,
    clearTranscripts,
  } = useCallTranscription();

  const handleTranscriptionToggle = async () => {
    if (recording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

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

          {/* Transcription Section */}
          <div className="flex flex-col gap-y-4 bg-[#1a1a1a] rounded-lg p-4 w-full max-w-4xl mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                <h2 className="text-lg font-medium">Live Transcription</h2>
                {processing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {transcripts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearTranscripts}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  variant={recording ? "destructive" : "secondary"}
                  size="sm"
                  onClick={handleTranscriptionToggle}
                  disabled={processing}
                  className="flex items-center gap-2"
                >
                  {recording ? (
                    <>
                      <Square className="h-4 w-4" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Start Recording
                    </>
                  )}
                </Button>
              </div>
            </div>

            {transcriptionError && (
              <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-md">
                <p className="text-sm text-red-200">{transcriptionError}</p>
              </div>
            )}

            {recording && (
              <div className="flex items-center gap-2 p-2 bg-red-500/20 border border-red-500/50 rounded-md animate-pulse">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
                <p className="text-sm text-red-200">Recording in progress...</p>
              </div>
            )}

            <ScrollArea className="h-32 w-full rounded-md border border-white/10 p-3">
              {transcripts.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">
                    {recording 
                      ? "Speak now... Your voice will be transcribed when you stop recording."
                      : "Click 'Start Recording' to begin transcription"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transcripts.map((transcript) => (
                    <div 
                      key={transcript.id} 
                      className="p-2 bg-white/5 rounded-md border border-white/10"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs text-gray-400">
                          {formatTime(transcript.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-white">{transcript.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
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
