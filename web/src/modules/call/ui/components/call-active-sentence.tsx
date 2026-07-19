"use client";

import { normalizeWord } from "@/lib/normalize-word";
import { cn } from "@/lib/utils";

interface CallActiveSentenceProps {
  targetText: string;
  practiceMode: "word" | "sentence";
  practiceSentence: string;
  misExpectedNormSet: Set<string>;
  activeWordKey: string;
  onWordClick: (norm: string) => void;
  isTalking: boolean;
}

export function CallActiveSentence({
  targetText,
  practiceMode,
  practiceSentence,
  misExpectedNormSet,
  activeWordKey,
  onWordClick,
  isTalking,
}: CallActiveSentenceProps) {
  const words = targetText.split(/(\s+)/g);

  return (
    <div className="w-full max-w-3xl flex flex-col items-center gap-4 animate-fade-in-up">
      {/* Target sentence container */}
      <div
        className="w-full rounded-2xl px-6 sm:px-8 py-8 sm:py-10 glass-panel flex flex-col items-center justify-center text-center shadow-xs"
        style={{ minHeight: "140px" }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full px-3 py-1 font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200/80">
            Level target
          </span>
        </div>

        {/* Hero-sized target sentence */}
        <div
          className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4 px-2"
          aria-label="Target sentence"
        >
          {words.map((part, i) => {
            if (!/\S/.test(part)) return <span key={i} className="w-2 sm:w-3" />;
            const norm = normalizeWord(part);
            if (!norm) return <span key={i}>{part}</span>;
            const wrong = misExpectedNormSet.has(norm);
            const active = norm === activeWordKey;

            return (
              <button
                key={i}
                type="button"
                onClick={() => onWordClick(norm)}
                className={cn(
                  "group flex flex-col items-center gap-1 focus:outline-none transition-all duration-200 cursor-pointer",
                  wrong && "animate-word-shake"
                )}
              >
                <span
                  className={cn(
                    "text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight transition-all duration-200",
                    active && isTalking && "animate-word-glow"
                  )}
                  style={{
                    fontFamily: "var(--font-display)",
                    color: wrong
                      ? "#dc2626"
                      : active
                      ? "#14161A"
                      : "#4b5563",
                    borderBottom: wrong
                      ? "3px solid #dc2626"
                      : active
                      ? "3px solid #059669"
                      : "3px solid transparent",
                    paddingBottom: "4px",
                  }}
                >
                  {part}
                </span>
              </button>
            );
          })}
        </div>

        {/* Word mode sentence context */}
        {practiceMode === "word" && practiceSentence !== targetText && (
          <p className="mt-5 text-center text-sm text-neutral-500 italic">
            Sentence: &ldquo;{practiceSentence}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}
