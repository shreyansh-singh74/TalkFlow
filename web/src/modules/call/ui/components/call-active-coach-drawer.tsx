"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Mic, RotateCcw, User, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CallActiveCoachDrawerProps {
  isConnected: boolean;
  isTalking: boolean;
  isAISpeaking: boolean;
  streamingAIText: string;
  isMicEnabled: boolean;
  partialTranscript: string;
  transcripts: Array<{
    id: string;
    text: string;
    timestamp: Date;
    reply?: string;
  }>;
  startTalking: () => void;
  formatTime: (date: Date) => string;
  practiceMode: "word" | "sentence";
}

export function CallActiveCoachDrawer({
  isConnected,
  isTalking,
  isAISpeaking,
  streamingAIText,
  isMicEnabled,
  partialTranscript,
  transcripts,
  startTalking,
  formatTime,
  practiceMode,
}: CallActiveCoachDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark unread when new transcript arrives and drawer is closed
  const prevLenRef = useRef(transcripts.length);
  useEffect(() => {
    if (transcripts.length > prevLenRef.current && !isOpen) {
      setHasUnread(true);
    }
    prevLenRef.current = transcripts.length;
  }, [transcripts.length, isOpen]);

  // Also mark unread when AI starts streaming and drawer is closed
  useEffect(() => {
    if (streamingAIText && !isOpen) {
      setHasUnread(true);
    }
  }, [streamingAIText, isOpen]);

  // Clear unread when opening
  useEffect(() => {
    if (isOpen) setHasUnread(false);
  }, [isOpen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) {
        setTimeout(() => {
          el.scrollTop = el.scrollHeight;
        }, 50);
      }
    }
  }, [isOpen, transcripts.length, streamingAIText]);

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "coach-fab fixed bottom-24 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full text-white transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-lg",
          hasUnread && "coach-fab-pulse",
          isOpen && "hidden"
        )}
        title="Open Coach"
      >
        <MessageCircle className="h-5 w-5" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-2 ring-black">
            !
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full sm:w-[380px] flex-col",
          isOpen ? "drawer-enter" : "pointer-events-none translate-x-full"
        )}
        style={{
          background: "rgba(14, 14, 16, 0.95)",
          backdropFilter: "blur(24px)",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Drawer header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800/60 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold text-neutral-200">Coach</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="flex flex-col gap-3 p-4">
            {/* Contextual prompt */}
            {isConnected && !isTalking && !isAISpeaking && !streamingAIText && isMicEnabled && (
              <div className="mx-auto rounded-full px-4 py-1.5 text-xs font-medium text-neutral-400 bg-neutral-800/50 border border-neutral-700/30 text-center">
                {practiceMode === "word" ? "Repeat the word" : "Repeat the sentence"} — hold SPACE
              </div>
            )}

            {isTalking && (
              <div className="mx-auto rounded-full px-4 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 text-center">
                Listening… release SPACE when done
              </div>
            )}

            {/* Empty state */}
            {transcripts.length === 0 && !partialTranscript && !streamingAIText && !isTalking && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/50 border border-neutral-700/30">
                  <Mic className="h-5 w-5 text-neutral-500" />
                </div>
                <p className="text-xs text-neutral-500 max-w-[200px]">
                  {isMicEnabled
                    ? "Your turns and coach replies will appear here."
                    : "Turn on the mic to start."}
                </p>
              </div>
            )}

            {/* Transcript messages */}
            {transcripts.map((t) => (
              <div key={t.id} className="flex flex-col gap-2.5">
                {/* User message — right aligned */}
                <div className="flex justify-end">
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm bg-emerald-500/10 border border-emerald-500/15 text-neutral-200">
                      <p className="leading-relaxed">{t.text}</p>
                      <p className="mt-1 text-[9px] text-neutral-500 text-right">
                        {formatTime(t.timestamp)}
                      </p>
                    </div>
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700/50">
                      <User className="h-3 w-3 text-neutral-400" />
                    </div>
                  </div>
                </div>

                {/* Coach reply — left aligned */}
                {t.reply && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <Bot className="h-3 w-3 text-emerald-400" />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm glass-panel text-neutral-300">
                        {t.reply.toLowerCase().startsWith("sorry") ||
                        t.reply.toLowerCase().includes("couldn't generate") ? (
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-neutral-400">
                              Didn&apos;t catch that — try again.
                            </p>
                            <button
                              type="button"
                              className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              onClick={startTalking}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Retry
                            </button>
                          </div>
                        ) : (
                          <p className="leading-relaxed">{t.reply}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming AI text */}
            {(isAISpeaking || streamingAIText) && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2 max-w-[85%]">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <Bot className="h-3 w-3 text-emerald-400" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm glass-panel text-neutral-300">
                    {streamingAIText ? (
                      <p className="leading-relaxed">{streamingAIText}</p>
                    ) : (
                      <div className="flex items-center gap-1 py-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 typing-dot" />
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 typing-dot" />
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 typing-dot" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Partial transcript preview */}
            {partialTranscript && (
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-sm italic bg-neutral-800/30 border border-neutral-700/20 text-neutral-400">
                  {partialTranscript}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
