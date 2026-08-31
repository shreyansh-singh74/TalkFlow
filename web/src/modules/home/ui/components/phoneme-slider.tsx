"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { HERO_SENTENCE, type PhonemeToken } from "./phoneme-data";

const STAGES = ["Spelling", "Sounds", "IPA"] as const;

/**
 * Ping-pong through the three layers (0 → 1 → 2 → 1 → …) so every transition
 * moves exactly one step. A plain modulo would snap 2 → 0 and roll backwards
 * three slots at once, which reads as a glitch rather than a transformation.
 */
const SEQUENCE = [0, 1, 2, 1] as const;

const STEP_MS = 1900;
/** Per-word delay. Turns a simultaneous swap into a wave across the sentence. */
const STAGGER_MS = 70;

interface PhonemeSliderProps {
  tokens: readonly PhonemeToken[];
  sentence?: string;
  className?: string;
}

/**
 * The hero's sliding sentence: each word is a slot whose spelling, respelling
 * and IPA are stacked vertically and rolled into view behind an edge mask.
 *
 * All three layers are also rendered into a hidden grid sizer (see
 * `.phoneme-slot-sizer` in globals.css) which stacks them in a single cell — so
 * the slot is already as wide as its widest variant and the line never reflows
 * while animating. Holds on the spelling for `prefers-reduced-motion`.
 */
export function PhonemeSlider({
  tokens,
  sentence = HERO_SENTENCE,
  className,
}: PhonemeSliderProps) {
  const [tick, setTick] = useState(0);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setAnimated(true);
    const id = window.setInterval(() => setTick((t) => t + 1), STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  const stage = animated ? SEQUENCE[tick % SEQUENCE.length] : 0;

  return (
    <div className={className}>
      <p className="sr-only">
        {sentence} Shown as spelling, then a plain-English respelling, then IPA.
      </p>

      <p className="phoneme-line" aria-hidden="true">
        {tokens.map((token, i) => {
          const layers = (
            <>
              <span className="phoneme-word">{token.word}</span>
              <span className="phoneme-sound">{token.respell}</span>
              <span className="phoneme-sound">{token.ipa}</span>
            </>
          );

          return (
            <span
              key={`${token.word}-${i}`}
              className={cn("phoneme-slot", token.focus && "phoneme-slot-focus")}
            >
              {/* Reserves the widest layer's width and one line of height. */}
              <span className="phoneme-slot-sizer">{layers}</span>

              <span
                className="phoneme-slot-roll"
                style={{
                  transform: `translateY(-${stage * 100}%)`,
                  transitionDelay: `${i * STAGGER_MS}ms`,
                }}
              >
                {layers}
              </span>
            </span>
          );
        })}
      </p>

      {/* Names what the animation is doing, so the motion reads as meaning. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
        {STAGES.map((label, i) => (
          <span key={label} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span
                className="font-mono text-[10px] text-tf-subtle"
                aria-hidden="true"
              >
                →
              </span>
            ) : null}
            <span
              className="phoneme-stage rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em]"
              data-active={i === stage}
            >
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
