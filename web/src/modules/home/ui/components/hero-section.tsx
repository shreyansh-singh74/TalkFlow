"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { SAMPLES } from "./session-samples";

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function HeroSection() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  // The hero sentence, scored: "I'll check the data and update the schedule."
  const sample = SAMPLES[1];
  const dashOffset = RING_CIRCUMFERENCE * (1 - sample.accuracy / 100);

  return (
    <section className="relative isolate overflow-hidden bg-tf-lime">
      <div
        className="tf-dots pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-32 md:pt-40">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <span className="tf-eyebrow mb-6 bg-tf-surface/60">Spoken English coach</span>

          <h1 className="text-balance text-[clamp(2.75rem,7vw,5.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-tf-text">
            Clarity,{" "}
            <span className="text-tf-accent">not accent.</span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-base leading-relaxed text-tf-accent-deep md:text-[17px]">
            TalkFlow scores your voice, finds the one sound that slipped, and
            shows you how to fix it.
          </p>

          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href={signedIn ? "/home" : "/sign-up"}
              className="group inline-flex items-center justify-center rounded-full bg-tf-green px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-tf-green-strong active:scale-[0.98]"
            >
              {signedIn ? "Go to dashboard" : "Start practicing free"}
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-tf-text/15 bg-tf-surface/60 px-7 py-3.5 text-sm font-semibold text-tf-text transition-colors hover:bg-tf-surface"
            >
              See how it works
            </Link>
          </div>

          <p className="mt-6 text-[13px] text-tf-accent-deep/70">
            Free to start, no downloads, works in your browser.
          </p>
        </div>

        {/* The product in one object: what you said, and what TalkFlow caught. */}
        <div className="relative mx-auto mt-16 max-w-4xl md:mt-20">
          <div className="overflow-hidden rounded-3xl border border-tf-border bg-tf-surface shadow-[0_40px_90px_-40px_rgba(54,83,20,0.35)]">
            <div className="flex items-center justify-between gap-4 border-b border-tf-border px-6 py-4">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-tf-subtle">
                Sound alignment
              </span>
              <span className="rounded-full bg-tf-lime px-3 py-1 font-mono text-[12px] font-semibold text-tf-accent-deep">
                {sample.accuracy}% intelligible
              </span>
            </div>

            <div className="grid md:grid-cols-2">
              {/* Before: what you said */}
              <div className="p-6 md:p-8">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
                  You said
                </p>
                <p className="text-[18px] font-medium leading-snug tracking-[-0.01em] text-tf-text md:text-[20px]">
                  {sample.heard.map((w, i) => (
                    <span
                      key={`${w.word}-${i}`}
                      className={
                        w.ok
                          ? undefined
                          : "rounded bg-tf-amber-light px-1 text-tf-amber underline decoration-tf-amber/60 decoration-wavy decoration-1 underline-offset-4"
                      }
                    >
                      {w.word}{" "}
                    </span>
                  ))}
                </p>
                <p className="mt-4 text-[13px] leading-relaxed text-tf-subtle">
                  Two words slipped, and the score dropped with them.
                </p>
              </div>

              {/* After: what TalkFlow caught */}
              <div className="border-t border-tf-border bg-tf-green-tint p-6 md:border-l md:border-t-0 md:p-8">
                <div className="mb-5 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <svg
                      width="72"
                      height="72"
                      viewBox="0 0 72 72"
                      className="-rotate-90"
                      aria-hidden="true"
                    >
                      <circle
                        cx="36"
                        cy="36"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="var(--tf-border)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="36"
                        cy="36"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="var(--tf-accent)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={dashOffset}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-tf-text">
                      {sample.accuracy}
                    </span>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-tf-text">
                      Two sounds to fix
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sample.diffs.map(({ expected, actual }) => (
                        <span
                          key={`${expected}-${actual}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-tf-border bg-tf-surface px-2 py-1 font-mono text-[12px]"
                        >
                          <span className="font-semibold text-tf-accent">
                            /{expected}/
                          </span>
                          <span className="text-tf-subtle" aria-label="became">
                            →
                          </span>
                          <span className="text-tf-amber">/{actual}/</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-tf-lime-deep bg-tf-surface/70 p-4">
                  <p className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[12px] font-semibold text-tf-accent">
                    <span className="rounded bg-tf-lime px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-tf-accent-deep">
                      Fix
                    </span>
                    /{sample.fix.sound}/ in “{sample.fix.word}”
                  </p>
                  <p className="text-[13px] leading-relaxed text-tf-muted">
                    {sample.fix.cue}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
