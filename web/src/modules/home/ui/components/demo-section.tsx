"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { SectionHeading } from "./section-heading";
import { SessionCard } from "./session-card";
import { SAMPLES } from "./session-samples";

export function DemoSection() {
  const [activeId, setActiveId] = useState(SAMPLES[0].id);
  const active = SAMPLES.find((s) => s.id === activeId) ?? SAMPLES[0];

  return (
    <section
      id="demo"
      className="scroll-mt-24 rounded-t-[2.5rem] border-t border-tf-border bg-tf-green-light/40 px-6 py-24 md:rounded-t-[80px] md:py-32"
    >
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="Live feedback"
          title="Every score comes with"
          accent="the sound that caused it."
          accentOnNewLine
          sub="Not a number and a shrug. Which phoneme slipped, what your mouth should do differently, and why it changed the meaning."
        />

        {/* Example switcher */}
        <div
          role="tablist"
          aria-label="Example practice sessions"
          className="mt-10 flex flex-wrap justify-center gap-2"
        >
          {SAMPLES.map((sample, i) => (
            <button
              key={sample.id}
              type="button"
              role="tab"
              id={`demo-tab-${sample.id}`}
              aria-selected={sample.id === activeId}
              aria-controls={`demo-panel-${sample.id}`}
              onClick={() => setActiveId(sample.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-[13px] font-medium transition-colors",
                sample.id === activeId
                  ? "border-tf-text bg-tf-text text-tf-bg"
                  : "border-tf-border bg-tf-surface text-tf-muted hover:border-tf-text/30 hover:text-tf-text",
              )}
            >
              Example {i + 1}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`demo-panel-${active.id}`}
          aria-labelledby={`demo-tab-${active.id}`}
          className="mt-6"
        >
          <SessionCard sample={active} />
        </div>

        <p className="mt-5 text-center text-[12px] text-tf-muted">
          Illustrative examples. Your own sessions are scored from your audio.
        </p>
      </div>
    </section>
  );
}
