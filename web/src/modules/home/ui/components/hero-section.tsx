"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Play, Sparkles } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { HERO_LINE } from "./phoneme-data";
import { PhonemeSlider } from "./phoneme-slider";

const TRUST = ["Browser-based", "Free to start", "Accent-friendly"];

export function HeroSection() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  return (
    <section className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-tf-bg px-6 pb-24 pt-32 md:pt-40">
      {/* Backdrop: green bloom behind the headline, dot grid fading downward. */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(24,164,75,0.13),transparent_70%)]" />
      <div className="tf-dots pointer-events-none absolute inset-x-0 top-0 -z-20 h-[46rem] opacity-40 [mask-image:linear-gradient(180deg,#000_0%,transparent_78%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-20 h-40 bg-gradient-to-b from-transparent to-tf-bg" />

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <span className="tf-eyebrow mb-7 bg-tf-surface/70 backdrop-blur">
          <span className="relative flex size-1.5" aria-hidden="true">
            <span className="absolute inline-flex size-full rounded-full bg-tf-green opacity-70 motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-tf-green" />
          </span>
          Spoken English coach
        </span>

        <h1 className="text-balance text-[clamp(2.75rem,7.4vw,5.75rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-tf-text">
          Speak clearer.{" "}
          <span className="h-accent tracking-[-0.03em] text-tf-green-strong">
            Stay yourself.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-balance text-base leading-relaxed text-tf-muted md:text-[17px]">
          TalkFlow listens to a sentence, aligns it against the sounds you
          actually produced, and gives you one practical cue — so your speech gets
          easier to understand without losing your accent.
        </p>

        <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={signedIn ? "/dashboard" : "/sign-up"}
            className="group inline-flex items-center justify-center rounded-full bg-tf-green px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_-10px_rgba(24,164,75,0.65)] transition-all hover:bg-tf-green-strong hover:shadow-[0_18px_40px_-10px_rgba(24,164,75,0.7)] active:scale-[0.98]"
          >
            {signedIn ? "Go to dashboard" : "Start practicing free"}
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#demo"
            className="inline-flex items-center justify-center rounded-full border border-tf-border bg-tf-surface px-7 py-3.5 text-sm font-semibold text-tf-text transition-colors hover:border-tf-text/25 hover:bg-tf-green-tint"
          >
            <Play className="mr-2 size-3.5 fill-current text-tf-green-strong" />
            See a scored session
          </Link>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-tf-muted">
          {TRUST.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-tf-green" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* The product in one object: the same sentence rolling from spelling to
          sounds to IPA, with the cue that follows from it. */}
      <div className="relative z-10 mx-auto mt-16 w-full max-w-4xl md:mt-20">
        <div className="overflow-hidden rounded-[1.75rem] border border-tf-border bg-tf-surface shadow-[0_30px_80px_-32px_rgba(8,32,26,0.28)]">
          <div className="flex items-center justify-between gap-4 border-b border-tf-border bg-tf-green-tint/60 px-5 py-3.5">
            <span className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-tf-muted">
              <Sparkles className="size-3.5 text-tf-green-strong" aria-hidden="true" />
              Sound alignment
            </span>
            <span className="flex items-center gap-2">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle sm:inline">
                intelligibility
              </span>
              <span className="rounded-full bg-tf-green px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
                79%
              </span>
            </span>
          </div>

          {/* No rules or grid in here on purpose — the sentence has to read as a
              sentence, and anything vertical behind it chops it into cells. */}
          <div className="relative px-5 py-10 md:px-10 md:py-12">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_65%_at_50%_50%,rgba(24,164,75,0.07),transparent_75%)]"
              aria-hidden="true"
            />
            <div className="relative">
              <PhonemeSlider tokens={HERO_LINE} />
            </div>
          </div>

          <div className="border-t border-tf-border bg-tf-green-light/45 px-5 py-4 md:px-8">
            <p className="text-left text-[13.5px] leading-relaxed text-tf-muted">
              <span className="mr-2 inline-flex items-center rounded-md bg-tf-green px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                Cue
              </span>
              In <strong className="font-semibold text-tf-text">data</strong>, start
              with <span className="font-mono text-tf-green-strong">/eɪ/</span> like
              “day”, then relax into “tuh”. Fix the sound, not your accent.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
