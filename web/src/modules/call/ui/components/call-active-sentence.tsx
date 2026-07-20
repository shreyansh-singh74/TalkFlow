"use client";

import { useMemo } from "react";
import { normalizeWord } from "@/lib/normalize-word";
import { cn } from "@/lib/utils";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { getBackendUrl } from "@/lib/backend-config";
import {
  TranscriptViewerContainer,
  TranscriptViewerAudio,
  TranscriptViewerWords,
  TranscriptViewerPlayPauseButton,
  TranscriptViewerScrubBar,
} from "@/components/ui/transcript-viewer";

interface CallActiveSentenceProps {
  targetText: string;
  practiceMode: "word" | "sentence";
  practiceSentence: string;
  misExpectedNormSet: Set<string>;
  activeWordKey: string;
  onWordClick: (norm: string) => void;
  isTalking: boolean;
  isEvaluating?: boolean;
  micStream?: MediaStream | null;
  speechLang?: string;
}

export function CallActiveSentence({
  targetText,
  practiceMode,
  practiceSentence,
  misExpectedNormSet,
  activeWordKey,
  onWordClick,
  isTalking,
  isEvaluating = false,
  micStream,
  speechLang = "en-US",
}: CallActiveSentenceProps) {
  const audioSrc = useMemo(() => {
    return `${getBackendUrl()}/api/phonemes/tts?text=${encodeURIComponent(targetText)}&lang=${encodeURIComponent(speechLang)}`;
  }, [targetText, speechLang]);

  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-4 animate-fade-in-up">
      {/* Target sentence container with TranscriptViewer */}
      <TranscriptViewerContainer
        audioSrc={audioSrc}
        text={targetText}
        className="w-full rounded-2xl px-6 sm:px-8 py-6 sm:py-8 glass-panel flex flex-col items-center justify-center text-center shadow-xs relative overflow-hidden"
      >
        <TranscriptViewerAudio />

        {/* Level target badge */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full px-3 py-1 font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200/80">
            Level target
          </span>
          {isTalking && (
            <span className="rounded-full px-3 py-1 font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
              🎙️ Listening... (Hold SPACE)
            </span>
          )}
          {isEvaluating && (
            <span className="rounded-full px-3 py-1 font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
              ⚡ Evaluating...
            </span>
          )}
        </div>

        {/* Interactive target words with word-by-word active audio sync highlighting */}
        <TranscriptViewerWords
          className="px-2 max-w-2xl gap-x-2 gap-y-3"
          renderWord={({ word, status }) => {
            const part = word.word;
            const norm = normalizeWord(part);
            const wrong = norm ? misExpectedNormSet.has(norm) : false;
            const active = norm === activeWordKey;

            return (
              <button
                type="button"
                onClick={() => {
                  if (norm) onWordClick(norm);
                }}
                className={cn(
                  "group flex flex-col items-center focus:outline-none transition-all duration-200 cursor-pointer px-1",
                  wrong && "animate-word-shake"
                )}
              >
                <span
                  className={cn(
                    "text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight transition-all duration-200",
                    status === "current" && "bg-emerald-100/90 text-emerald-950 scale-105 rounded-lg px-2 py-0.5 shadow-2xs border-b-3 border-emerald-600",
                    status === "spoken" && !wrong && "text-neutral-900",
                    status === "unspoken" && !wrong && !active && "text-neutral-600",
                    active && isTalking && "animate-word-glow"
                  )}
                  style={{
                    fontFamily: "var(--font-display)",
                    color: wrong
                      ? "#dc2626"
                      : active && status !== "current"
                      ? "#14161A"
                      : undefined,
                    borderBottom: wrong
                      ? "3px solid #dc2626"
                      : active && status !== "current"
                      ? "3px solid #059669"
                      : undefined,
                    paddingBottom: status === "current" ? "2px" : "4px",
                  }}
                >
                  {part}
                </span>
              </button>
            );
          }}
        />

        {/* Audio controls row: Play/Pause button + ScrubBar */}
        <div className="mt-4 flex items-center gap-3 w-full max-w-md bg-neutral-50/80 backdrop-blur-xs px-4 py-2 rounded-full border border-neutral-200/80 shadow-2xs">
          <TranscriptViewerPlayPauseButton />
          <TranscriptViewerScrubBar />
        </div>

        {/* Dynamic Canvas Live Waveform Display when recording or evaluating */}
        {(isTalking || isEvaluating) && (
          <div className="w-full max-w-md mt-4 px-4">
            <LiveWaveform
              active={isTalking}
              processing={isEvaluating}
              stream={micStream}
              mode="static"
              height={36}
              barWidth={3}
              barGap={2}
              barRadius={1.5}
              barColor={isTalking ? "#059669" : "#3b82f6"}
              fadeEdges={true}
              fadeWidth={20}
            />
          </div>
        )}

        {/* Word mode sentence context */}
        {practiceMode === "word" && practiceSentence !== targetText && (
          <p className="mt-4 text-center text-xs text-neutral-500 italic">
            Sentence: &ldquo;{practiceSentence}&rdquo;
          </p>
        )}
      </TranscriptViewerContainer>
    </div>
  );
}
