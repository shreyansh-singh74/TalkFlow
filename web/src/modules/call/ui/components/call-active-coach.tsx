"use client";

import { useEffect, useRef } from "react";
import { Bot, Mic, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CallActiveCoachProps {
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
  practiceMode: "word" | "sentence";
}

export function CallActiveCoach({
  isConnected,
  isTalking,
  isAISpeaking,
  streamingAIText,
  isMicEnabled,
  partialTranscript,
  transcripts,
  practiceMode,
}: CallActiveCoachProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [transcripts.length, streamingAIText]);

  return (
    <div className="flex h-full w-full flex-col bg-neutral-50/90 border-l border-neutral-200/80 shadow-2xs">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-neutral-200/80 px-5 bg-white/60">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <Bot className="h-4 w-4 text-emerald-600" />
        </div>
        <span className="text-sm font-bold text-neutral-900">Coach</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="flex flex-col gap-3.5 p-5">
          {isConnected && !isTalking && !isAISpeaking && !streamingAIText && isMicEnabled && (
            <div className="mx-auto rounded-full px-4 py-1.5 text-xs font-semibold text-center bg-neutral-100 text-neutral-600 border border-neutral-200/80">
              {practiceMode === "word" ? "Repeat the word" : "Repeat the sentence"} — hold SPACE
            </div>
          )}

          {isTalking && (
            <div className="mx-auto rounded-full px-4 py-1.5 text-xs font-semibold text-center bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              Listening… release SPACE when done
            </div>
          )}

          {transcripts.length === 0 && !partialTranscript && !streamingAIText && !isTalking && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 border border-neutral-200">
                <Mic className="h-5 w-5 text-neutral-400" />
              </div>
              <p className="text-xs font-medium text-neutral-500 max-w-[200px] leading-relaxed">
                {isMicEnabled
                  ? "Your turns and coach replies will appear here."
                  : "Turn on the mic to start."}
              </p>
            </div>
          )}

          {transcripts.map((t) => (
            <div key={t.id} className="flex flex-col gap-2.5">
              {/* User transcript */}
              <div className="flex justify-end">
                <div className="flex items-start gap-2 max-w-[88%]">
                  <div className="rounded-2xl rounded-tr-xs px-4 py-2.5 text-sm bg-emerald-600 text-white shadow-xs">
                    <p className="leading-relaxed font-medium">{t.text}</p>
                  </div>
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200/80 border border-neutral-300/80 text-neutral-600">
                    <User className="h-3 w-3" />
                  </div>
                </div>
              </div>

              {/* Coach reply */}
              {t.reply && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-2 max-w-[88%]">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                      <Bot className="h-3 w-3" />
                    </div>
                    <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 text-sm bg-white text-neutral-800 border border-neutral-200 shadow-2xs">
                      <p className="leading-relaxed font-normal">{t.reply}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming AI text */}
          {(isAISpeaking || streamingAIText) && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2 max-w-[88%]">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="rounded-2xl rounded-tl-xs px-4 py-2.5 text-sm bg-white text-neutral-800 border border-neutral-200 shadow-2xs">
                  {streamingAIText ? (
                    <p className="leading-relaxed">{streamingAIText}</p>
                  ) : (
                    <div className="flex items-center gap-1.5 py-1">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse delay-75" />
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse delay-150" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Partial transcript */}
          {partialTranscript && (
            <div className="flex justify-end">
              <p className="max-w-[88%] rounded-2xl rounded-tr-xs px-4 py-2.5 text-sm italic bg-neutral-100 text-neutral-500 border border-neutral-200">
                {partialTranscript}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
