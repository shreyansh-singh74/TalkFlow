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
import { CallActiveContext } from "./call-active-context";

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
  /** Surrounding lines of a pasted text. Null for coach-backed sessions. */
  contextBefore?: string | null;
  contextAfter?: string | null;
  /** Segmenter hint for the current step, e.g. "continues in the next step". */
  stepNote?: string | null;
  /** Learner's listening speed from settings. 1 when unset. */
  rate?: number;
}

/**
 * Row-1 "Level target" panel. On desktop it is a fixed-height grid cell: the
 * word pane owns the flex space and scrolls internally, while the context
 * lines, badges and audio row stay pinned as shrink-0 zones. Below `lg` the
 * panel grows with its content and the page scrolls instead.
 */
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
  contextBefore = null,
  contextAfter = null,
  stepNote = null,
  rate = 1,
}: CallActiveSentenceProps) {
  const audioSrc = useMemo(() => {
    // `rate` is the learner's listening speed; it changes the URL because the
    // backend synthesises at that rate, so a cached clip is never reused at the
    // wrong speed.
    return `${getBackendUrl()}/api/phonemes/tts?text=${encodeURIComponent(targetText)}&lang=${encodeURIComponent(speechLang)}&rate=${rate}`;
  }, [targetText, speechLang, rate]);

  return (
    /* Target sentence panel — the container's baked-in `gap-3` is overridden by
       `cn` (tailwind-merge) with `gap-2`. */
    <TranscriptViewerContainer
      audioSrc={audioSrc}
      text={targetText}
      className="call-panel call-panel-t glass-panel relative flex h-full min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-2xl text-center shadow-xs"
    >
      <TranscriptViewerAudio />

      {/* Level target badge. The recording / evaluating state is deliberately
          not repeated here — the score pill straddling the panel's top edge is
          the one authoritative readout for it, and it sits directly above. */}
      <div className="flex shrink-0 items-center justify-center gap-2 text-xs">
        <span className="rounded-full px-3 py-1 font-semibold bg-secondary text-muted-foreground border border-border/80">
          Level target
        </span>
      </div>

      {/* The line being read, its neighbouring lines and the model audio travel
          as one block, centred in the panel's spare height — so the player sits
          directly under the sentence instead of being pushed to the panel floor
          with a void in between. Only the words scroll: the player must not
          scroll away when the sentence is long. */}
      <div className="flex w-full min-w-0 flex-col justify-center gap-2 lg:min-h-0 lg:flex-1">
        {/* Preceding line of a pasted text */}
        <CallActiveContext text={contextBefore} position="before" note={stepNote} />

        {/* Interactive target words with word-by-word active audio sync
            highlighting. The pane shrinks and scrolls internally on desktop;
            below `lg` it grows with the words and the page scrolls. */}
        <div
          key={targetText}
          data-call-pane="target"
          className="w-full min-w-0 animate-fade-in-up lg:min-h-0 lg:overflow-y-auto"
        >
          <TranscriptViewerWords
            className="px-2"
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
                      "call-target-word font-bold leading-tight tracking-tight transition-all duration-200",
                      status === "current" && "bg-success/15 text-primary scale-105 rounded-lg px-2 py-0.5 shadow-2xs border-b-3 border-primary",
                      status === "spoken" && !wrong && "text-foreground",
                      status === "unspoken" && !wrong && !active && "text-muted-foreground",
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
        </div>

        {/* Following line of a pasted text */}
        <CallActiveContext text={contextAfter} position="after" />

        {/* Audio controls row: Play/Pause button + ScrubBar */}
        <div className="mx-auto flex w-full max-w-sm shrink-0 items-center gap-3 rounded-full border border-border/80 bg-muted/80 px-4 py-2 shadow-2xs backdrop-blur-xs">
          <TranscriptViewerPlayPauseButton />
          <TranscriptViewerScrubBar />
        </div>

        {/* Dynamic Canvas Live Waveform Display when recording or evaluating */}
        {(isTalking || isEvaluating) && (
          <div className="mx-auto w-full max-w-sm shrink-0 px-4">
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
      </div>

      {/* Word mode sentence context */}
      {practiceMode === "word" && practiceSentence !== targetText && (
        <p className="mt-1 shrink-0 text-center text-xs italic text-muted-foreground">
          Sentence: &ldquo;{practiceSentence}&rdquo;
        </p>
      )}
    </TranscriptViewerContainer>
  );
}
