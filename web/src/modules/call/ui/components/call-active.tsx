import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  Radio,
  Trash2,
  ChevronLeft,
} from "lucide-react";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { useSpacebarControl } from "@/hooks/use-spacebar-control";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  requestMedia,
  localStream,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isFetching,
  error,
  isCameraOn,
  isMicOn,
  toggleCamera,
  toggleMic,
}: Props) => {
  const {
    isConnected,
    isTalking,
    isAISpeaking,
    transcripts,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    partialTranscript,
    streamingAIText,
    conversationStatus,
    error: transcriptionError,
    connect,
    disconnect,
    startTalking,
    stopTalking,
    clearTranscripts
  } = usePushToTalk();

  const [isChatOpen, setIsChatOpen] = useState(true);

  // Spacebar control
  useSpacebarControl({
    onSpaceDown: startTalking,
    onSpaceUp: stopTalking,
    enabled: isConnected && isMicOn
  });

  // Auto-connect when mic turns on
  useEffect(() => {
    if (isMicOn && !isConnected) {
      connect();
    } else if (!isMicOn && isConnected) {
      disconnect();
    }
  }, [isMicOn, isConnected, connect, disconnect]);

  const handleMicToggle = () => {
    toggleMic();
    // Connection is handled by useEffect above
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
      <div className="flex flex-col p-4 h-full w-full overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center w-full justify-between mb-4 flex-shrink-0">
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

        {/* Main Content: Video Left, Chat Right */}
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Video Section - Left */}
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <div className="w-[70%] h-[70%] max-w-3xl bg-black/50 rounded-lg relative overflow-hidden group">
              {localStream && isCameraOn ? (
                <video
                  ref={attachLocalStream}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  autoPlay
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/80 bg-gradient-to-br from-gray-900 to-gray-800">
                  <CameraOff className="w-16 h-16 mb-3" />
                  <p className="text-sm">Camera is off</p>
                </div>
              )}
              
              {/* Status Overlay at Bottom - Always Visible */}
              {conversationStatus && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-lg border border-white/20 px-4 py-2 rounded-full shadow-lg z-10">
                  <div className="flex items-center gap-2">
                    {isTalking && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                        <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                        <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    {streamingAIText && (
                      <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse" />
                    )}
                    {isAISpeaking && (
                      <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                    {!isTalking && !streamingAIText && !isAISpeaking && isConnected && (
                      <div className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
                    )}
                    <span className="text-sm font-medium text-white">{conversationStatus}</span>
                  </div>
                </div>
              )}
              
              {/* Overlay Controls at Bottom - Show on Hover */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
                <div className="flex items-center justify-center gap-4 pointer-events-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleMicToggle}
                    className={`h-14 w-14 rounded-full backdrop-blur-lg bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-110 transition-all duration-200 shadow-lg ${
                      !isMicOn ? 'bg-red-500/30 border-red-500/50' : isConnected ? 'bg-blue-500/30 border-blue-500/50 animate-pulse' : ''
                    }`}
                    title={isMicOn ? "Turn off microphone" : "Turn on microphone"}
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

          {/* Chat Section - Right */}
          <Collapsible open={isChatOpen} onOpenChange={setIsChatOpen}>
            {!isChatOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsChatOpen(true)}
                className="h-full w-12 bg-black/80 backdrop-blur-lg border border-white/10 rounded-lg hover:bg-black/90 flex flex-col items-center justify-center gap-2"
              >
                <Radio className="h-5 w-5 text-blue-400" />
                <ChevronLeft className="h-4 w-4 transform rotate-180" />
              </Button>
            )}
            <CollapsibleContent className="w-[400px] h-full overflow-hidden flex-shrink-0">
              <div className="h-full bg-black/80 backdrop-blur-lg border border-white/10 rounded-lg p-4 flex flex-col">
                {/* Header with Toggle - Fixed */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3 flex-shrink-0">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:text-white hover:bg-white/10 h-8"
                    >
                      <Radio className="h-4 w-4 text-blue-400 mr-2" />
                      <span className="font-semibold">Voice Conversation</span>
                      <ChevronLeft className="h-4 w-4 ml-2" />
                    </Button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-2">
                    {isAISpeaking && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400">AI Speaking...</span>
                      </div>
                    )}
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
                </div>

                {/* Scrollable Content */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="flex flex-col gap-3 pr-4">
                    {/* Status Messages */}
                    {transcriptionError && (
                      <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg flex-shrink-0">
                        <div className="h-2 w-2 bg-red-500 rounded-full" />
                        <p className="text-xs text-red-200">{transcriptionError}</p>
                      </div>
                    )}

                    {/* Listening State */}
                    {isConnected && !isTalking && !isAISpeaking && !streamingAIText && (
                      <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg flex-shrink-0">
                        <div className="h-2 w-2 bg-blue-400 rounded-full animate-pulse" />
                        <p className="text-xs text-blue-200">Hold SPACE to talk</p>
                      </div>
                    )}

                    {/* Speaking State */}
                    {isTalking && (
                      <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg flex-shrink-0">
                        <div className="flex gap-1">
                          <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                          <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                          <div className="h-2 w-1 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                        <p className="text-xs text-purple-200">Recording... Release SPACE to send</p>
                      </div>
                    )}

                    {/* AI Streaming State */}
                    {streamingAIText && (
                      <div className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg flex-shrink-0">
                        <Radio className="h-3 w-3 text-green-400 mt-0.5 animate-pulse" />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-green-300">AI is thinking...</span>
                          <p className="text-xs text-green-100 leading-relaxed mt-1">{streamingAIText}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Speaking State in Chat */}
                    {isAISpeaking && (
                      <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg flex-shrink-0">
                        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                        <p className="text-xs text-green-200">AI Speaking...</p>
                      </div>
                    )}

                    {/* Transcripts */}
                    {transcripts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-4">
                        <Mic className="h-6 w-6 text-gray-400" />
                        <p className="text-xs text-gray-400">
                          {isConnected ? "Hold SPACE to talk" : "Turn on the mic to start voice conversation"}
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
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};