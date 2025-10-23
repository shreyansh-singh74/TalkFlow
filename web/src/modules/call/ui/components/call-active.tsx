import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/use-webrtc";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Radio,
  Trash2,
  Loader2,
} from "lucide-react";
import { useAutoTranscription } from "@/hooks/use-auto-transcription";
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
    isActive,
    isUserSpeaking,
    isProcessing,
    isAISpeaking,
    transcripts,
    error: transcriptionError,
    startListening,
    stopListening,
    clearTranscripts,
  } = useAutoTranscription();

  const handleMicToggle = async () => {
    toggleMic();
    if (isMicOn) {
      // Currently on, so turning off → stop automatic listening
      stopListening();
    } else {
      // Currently off, so turning on → start automatic listening
      await startListening();
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
      {/* Main Content Area */}
      <div className="flex flex-col p-4 h-full w-full">
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

        <div className="flex flex-col gap-4 h-full">
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
                  onClick={handleMicToggle}
                  disabled={isProcessing}
                  className={`h-14 w-14 rounded-full backdrop-blur-lg bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-110 transition-all duration-200 shadow-lg ${
                    !isMicOn ? 'bg-red-500/30 border-red-500/50' : isActive ? 'bg-blue-500/30 border-blue-500/50 animate-pulse' : ''
                  }`}
                  title={isMicOn ? "Stop Auto-Conversation" : "Start Auto-Conversation"}
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

          {/* Transcript Section Below Video */}
          {(transcripts.length > 0 || isActive || isProcessing || transcriptionError) && (
            <div className="w-full max-w-6xl bg-black/80 backdrop-blur-lg border border-white/10 rounded-lg p-4 mt-4">
              <div className="flex flex-col gap-3 max-h-[300px]">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-semibold">Auto-Conversation</span>
                    {isProcessing && (
                      <div className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                        <span className="text-xs text-blue-300">AI is thinking...</span>
                      </div>
                    )}
                    {isAISpeaking && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400">AI Speaking...</span>
                      </div>
                    )}
                  </div>
                  {transcripts.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearTranscripts}
                      className="h-7 w-7 hover:bg-white/10"
                      title="Clear transcripts"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Status Messages */}
                {transcriptionError && (
                  <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="h-2 w-2 bg-red-500 rounded-full" />
                    <p className="text-xs text-red-200">{transcriptionError}</p>
                  </div>
                )}

                {/* Listening State */}
                {isActive && !isUserSpeaking && !isProcessing && !isAISpeaking && (
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
                    <p className="text-xs text-blue-200">Listening... Speak naturally, I'll auto-send after 1s silence</p>
                  </div>
                )}

                {/* Speaking State */}
                {isUserSpeaking && (
                  <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex gap-1">
                      <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                      <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                    <p className="text-xs text-purple-200">Speaking...</p>
                  </div>
                )}

                {/* Transcripts */}
                <ScrollArea className="flex-1 rounded-lg border border-white/10 bg-black/20 p-3">
                  {transcripts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-4">
                      <Mic className="h-6 w-6 text-gray-400" />
                      <p className="text-xs text-gray-400">
                        {isActive ? "Listening... Start speaking!" : "Turn on the mic to start auto-conversation"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transcripts.map((transcript) => (
                        <div key={transcript.id} className="space-y-2">
                          {/* User transcript */}
                          <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className="text-xs font-medium text-gray-400">You</span>
                              <span className="text-xs text-gray-500">
                                {formatTime(transcript.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-white leading-relaxed">{transcript.text}</p>
                          </div>
                          
                          {/* AI reply if exists */}
                          {transcript.reply && (
                            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 ml-4">
                              <div className="flex items-start gap-2 mb-1">
                                <Radio className="h-3 w-3 text-blue-400 mt-0.5" />
                                <span className="text-xs font-medium text-blue-300">AI Response</span>
                              </div>
                              <p className="text-xs text-blue-50 leading-relaxed">{transcript.reply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};
