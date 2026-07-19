"use client";

import { HeardTextHighlight } from "@/components/heard-text-highlight";
import { ScoreRing } from "./call-active-score-ring";
import type { PronunciationResultPayload } from "@/types/pronunciation";

interface CallActiveFeedbackProps {
  lastPronunciation: PronunciationResultPayload | null;
  scoreDisplay: number | null;
}

export function CallActiveFeedback({
  lastPronunciation,
  scoreDisplay,
}: CallActiveFeedbackProps) {
  if (!lastPronunciation) return null;

  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-5 animate-fade-in-up">
      {/* Score Presentation & Feedback Container */}
      <div className="w-full rounded-2xl px-6 py-5 glass-panel flex flex-col items-center gap-4 shadow-xs">
        {/* Score Ring */}
        {scoreDisplay !== null && (
          <div className="flex flex-col items-center gap-1 my-1">
            <ScoreRing score={scoreDisplay} size={110} strokeWidth={8} />
          </div>
        )}

        {/* Heard Text */}
        <div className="w-full border-t border-neutral-200 pt-4 text-center sm:text-left">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            Heard
          </p>
          <HeardTextHighlight
            className="text-lg leading-relaxed font-semibold text-neutral-900"
            text={lastPronunciation.heard_text || "—"}
            misalignedWords={lastPronunciation.misaligned_words}
          />

          {/* Coach feedback lines */}
          {lastPronunciation.feedback.slice(0, 2).map((line, i) => (
            <p
              key={i}
              className="mt-2 text-sm leading-relaxed text-neutral-600 font-medium"
            >
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
