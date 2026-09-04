"use client";

import { HeardTextHighlight } from "@/components/heard-text-highlight";
import { CallActivePhonemes } from "./call-active-phonemes";
import type { PronunciationResultPayload } from "@/types/pronunciation";

interface CallActiveFeedbackProps {
  lastPronunciation: PronunciationResultPayload | null;
}

const METHOD_LABEL: Record<string, string> = {
  acoustic: "acoustic model",
};

/**
 * Row-1 "Heard" panel. A fixed-height grid cell on desktop: the header stays
 * pinned while the heard text, coach feedback and per-sound chips share one
 * internal scroll area. It always renders — before the first attempt it shows
 * an empty state — because in a grid the cell must hold its width or row 1
 * reflows when the first result lands.
 *
 * Below `lg` the panel grows with its content and the page scrolls; the pane
 * only becomes the flex-1 scroll region on desktop, where the row has a
 * definite height.
 */
export function CallActiveFeedback({ lastPronunciation }: CallActiveFeedbackProps) {
  if (!lastPronunciation) {
    return (
      <div className="call-panel call-panel-t glass-panel flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl shadow-xs">
        <div className="my-auto flex flex-col items-center gap-1.5 text-center">
          <p className="text-sm font-semibold text-neutral-500">
            Hold SPACE and read the sentence.
          </p>
          <p className="text-xs font-medium text-neutral-400">
            Your attempt and per-sound scores appear here.
          </p>
        </div>
      </div>
    );
  }

  const method = lastPronunciation.method
    ? METHOD_LABEL[lastPronunciation.method] ?? lastPronunciation.method
    : null;

  return (
    <div className="call-panel call-panel-t glass-panel flex min-h-0 min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl shadow-xs">
      {/* Header */}
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-neutral-200/80 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
          Heard
        </p>
        {method && (
          <span className="text-[10px] font-medium text-neutral-400">{method}</span>
        )}
      </div>

      {/* Heard text + coach feedback + per-phone scores */}
      <div data-call-pane="heard" className="min-h-0 overflow-y-auto lg:flex-1">
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

        {/* Per-phone scores from the acoustic model */}
        <CallActivePhonemes perPhoneme={lastPronunciation.per_phoneme} />
      </div>
    </div>
  );
}
