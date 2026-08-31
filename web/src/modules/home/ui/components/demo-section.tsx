"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { SectionHeading } from "./section-heading";
import { SessionCard } from "./session-card";
import { SAMPLES } from "./session-samples";

const TAB_LABELS: Record<string, string> = {
  schedule: "Daily sentence",
  thursday: "Difficult sound",
  pronunciation: "Word focus",
};

export function DemoSection() {
  const [activeId, setActiveId] = useState(SAMPLES[0].id);
  const active = SAMPLES.find((s) => s.id === activeId) ?? SAMPLES[0];

  return (
    <section
      id="demo"
      className="relative scroll-mt-24 overflow-hidden rounded-t-[2.5rem] border-t border-tf-border bg-tf-green-tint px-6 py-24 md:rounded-t-[72px] md:py-32"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,rgba(24,164,75,0.12),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="Live feedback"
          title="See the sentence, the sounds,"
          accent="and the fix."
          accentOnNewLine
          sub="Each session compares what you meant to say with what was heard, then highlights the exact phoneme to practise next."
        />

        {/* Example switcher */}
        <div
          role="tablist"
          aria-label="Example practice sessions"
          className="mx-auto mt-10 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-tf-border bg-tf-surface p-1"
        >
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              role="tab"
              id={`demo-tab-${sample.id}`}
              aria-selected={sample.id === activeId}
              aria-controls={`demo-panel-${sample.id}`}
              onClick={() => setActiveId(sample.id)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
                sample.id === activeId
                  ? "bg-tf-green text-white shadow-[0_6px_18px_-8px_rgba(24,164,75,0.9)]"
                  : "text-tf-muted hover:bg-tf-green-tint hover:text-tf-text",
              )}
            >
              {TAB_LABELS[sample.id] ?? sample.id}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`demo-panel-${active.id}`}
          aria-labelledby={`demo-tab-${active.id}`}
          className="mt-6"
        >
          <SessionCard
            key={active.id}
            sample={active}
            className="shadow-[0_30px_70px_-34px_rgba(8,32,26,0.35)]"
          />
        </div>

        <p className="mt-5 text-center text-[12px] text-tf-subtle">
          Illustrative examples. Your own sessions are scored from your audio.
        </p>
      </div>
    </section>
  );
}
