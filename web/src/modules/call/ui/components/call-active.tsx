import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/use-webrtc";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Radio,
  Square,
  Trash2,
  MessageSquare,
  ChevronLeft,
  X,
} from "lucide-react";
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
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  
  const {
    recording,
    processing,
    transcripts,
    error: transcriptionError,
    isSpeaking,
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
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex h-full text-white overflow-hidden relative">
      {/* Main Content Area - Slides left when conversation opens */}
      <div className={`flex flex-col p-4 h-full transition-all duration-500 ease-in-out ${
        isConversationOpen ? 'w-[calc(100%-450px)]' : 'w-full'
      }`}>
        {/* Top Bar */}
        <div className="flex items-center w-full justify-between mb-4">
          <div className="bg-[#101213] rounded-full flex items-center gap-4 w-full mr-2">
            <Link
              href="/"
              className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit"
            >
              <Image src="/logo.svg" width={22} height={22} alt="Logo" />
            </Link>
            <h4 className="text-base">{meetingName}</h4>
          </div>
          
          {/* Leave Button - Top Right */}
          <Button
            variant="destructive"
            onClick={onLeave}
            className="flex items-center gap-2 rounded-full text-xs h-7.5"
            size="default"
          >
            <PhoneOff className="h-2 w-2" />
            Leave Call
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 h-full">
        {/* Video with integrated controls */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-6xl bg-black/50 rounded-lg relative overflow-hidden group">
            {localStream && isCameraOn ? (
              <video
                ref={attachLocalStream}
                className="w-full aspect-video object-cover"
                muted
                playsInline
                autoPlay
              />
            ) : (
              <div className="w-full aspect-video flex flex-col items-center justify-center text-white/80 bg-gradient-to-br from-gray-900 to-gray-800">
                <CameraOff className="w-16 h-16 mb-3" />
                <p className="text-sm">Camera is off</p>
              </div>
            )}
            
            {/* Overlay Controls at Bottom - Hidden by default, shown on hover */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center justify-center gap-4 pointer-events-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMic}
                  className={`h-14 w-14 rounded-full backdrop-blur-lg bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-110 transition-all duration-200 shadow-lg ${
                    !isMicOn ? 'bg-red-500/30 border-red-500/50' : ''
                  }`}
                  title={isMicOn ? "Mute" : "Unmute"}
                >
                  {isMicOn ? (
                    <Mic className="h-6 w-6 text-white" />
                  ) : (
                    <MicOff className="h-6 w-6 text-red-200" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleCamera}
                  className={`h-14 w-14 rounded-full backdrop-blur-lg bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-110 transition-all duration-200 shadow-lg ${
                    !isCameraOn ? 'bg-red-500/30 border-red-500/50' : ''
                  }`}
                  title={isCameraOn ? "Turn off camera" : "Turn on camera"}
                >
                  {isCameraOn ? (
                    <Camera className="h-6 w-6 text-white" />
                  ) : (
                    <CameraOff className="h-6 w-6 text-red-200" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Toggle Button */}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setIsConversationOpen(!isConversationOpen)}
        className={`fixed top-1/2 transform -translate-y-1/2 h-12 w-12 rounded-full shadow-lg z-50 hover:scale-110 transition-all duration-500 ${
          isConversationOpen ? 'right-[420px]' : 'right-4'
        }`}
      >
        {isConversationOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>

      {/* Sliding Conversation Panel */}
      <div className={`fixed top-0 right-0 h-full w-[450px] bg-[#0a0a0a] border-l border-white/10 text-white transition-transform duration-500 ease-in-out ${
        isConversationOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Radio className="h-5 w-5 text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold">Conversation</h2>
                {processing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">AI Speaking...</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {transcripts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={clearTranscripts}
                    className="h-9 w-9 hover:bg-white/10"
                    title="Clear transcripts"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant={recording ? "destructive" : "secondary"}
                  size="icon"
                  onClick={handleTranscriptionToggle}
                  disabled={processing}
                  className={`h-9 w-9 ${recording ? 'animate-pulse' : ''}`}
                  title={recording ? "Stop recording" : "Start recording"}
                >
                  {recording ? (
                    <Square className="h-4 w-4 fill-current" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col h-[calc(100%-120px)] gap-y-4 p-6">

        {transcriptionError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="h-2 w-2 bg-red-500 rounded-full" />
            <p className="text-sm text-red-200">{transcriptionError}</p>
          </div>
        )}

        {recording && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
            <p className="text-sm text-blue-200">Recording... Speak now</p>
          </div>
        )}

        <ScrollArea className="flex-1 w-full rounded-lg border border-white/10 bg-black/20 p-4">
          {transcripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="p-3 bg-white/5 rounded-full">
                <Mic className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-300">
                  {recording ? "Listening..." : "No transcripts yet"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {recording
                    ? "Speak clearly and stop recording when done"
                    : "Click the mic icon to start recording"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className="space-y-2"
                >
                  {/* User transcript */}
                  <div className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-medium text-gray-400">
                        You
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTime(transcript.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-white leading-relaxed">{transcript.text}</p>
                  </div>
                  
                  {/* AI reply if exists */}
                  {transcript.reply && (
                    <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 ml-6 hover:bg-blue-500/15 transition-colors">
                      <div className="flex items-start gap-2 mb-2">
                        <Radio className="h-3.5 w-3.5 text-blue-400 mt-0.5" />
                        <span className="text-xs font-medium text-blue-300">
                          AI Response
                        </span>
                      </div>
                      <p className="text-sm text-blue-50 leading-relaxed">{transcript.reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
};
