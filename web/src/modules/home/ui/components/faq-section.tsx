"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const FAQS = [
  {
    q: "How is TalkFlow different from a normal pronunciation app?",
    a: "Most apps grade the transcript. Word-level speech recognition quietly corrects your mistakes before they are scored, so “tink” becomes “think” and you get full marks. TalkFlow scores the audio itself, so it catches the sound that actually slipped.",
  },
  {
    q: "Will it change my accent?",
    a: "No. The goal is being understood, not sounding American or British. If your accent is clear, it stays yours. TalkFlow only flags the specific sounds that made a word harder to understand.",
  },
  {
    q: "What do I need to get started?",
    a: "A browser and a microphone. There is nothing to install and no special hardware. The free plan gives you 10 practice sessions a month.",
  },
  {
    q: "How is a score actually calculated?",
    a: "A phoneme recognizer reads your waveform and lines up the sounds you produced against the sounds the sentence needs. The gap between the two becomes your score, weighted toward intelligibility rather than nativeness.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-tf-border bg-tf-bg px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionHeading
            title="Questions, answered."
            accent="Good questions."
          />
        </Reveal>

        <div className="mt-12 space-y-3">
          {FAQS.map(({ q, a }, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={q} delay={((i % 3) + 1) as 1 | 2 | 3}>
                <div
                  className={cn(
                    "overflow-hidden rounded-2xl border transition-colors",
                    isOpen
                      ? "border-tf-green/30 bg-tf-surface"
                      : "border-tf-border bg-tf-surface/40 hover:border-tf-border",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-tf-text">
                      {q}
                    </span>
                    <Plus
                      className={cn(
                        "size-4 shrink-0 text-tf-mint transition-transform duration-200",
                        isOpen && "rotate-45",
                      )}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>

                  <div
                    className={cn(
                      "grid transition-all duration-200",
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-[14px] leading-relaxed text-tf-muted">
                        {a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
