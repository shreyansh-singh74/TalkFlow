"use client";

import Link from "next/link";

import { authClient } from "@/lib/auth-client";

import CurvedLoop from "./curved-loop";

const TRUST = ["No install", "Works in your browser", "Free to start"];

export function HeroSection() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-tf-bg px-6 pb-20 pt-32">
      {/* Decorative backdrop: the same sentence written, then respelled by sound.
          Stacked rather than side-by-side so it never collides with the copy. */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between py-12 md:py-20"
        aria-hidden="true"
      >
        <CurvedLoop
          marqueeText="I'll check the data and update the schedule."
          speed={0.7}
          curveAmount={200}
          direction="right"
          interactive={false}
          className="curved-loop-left"
        />
        <CurvedLoop
          marqueeText="Ayl chek thuh day·tuh and up·dayt thuh skeh·jool."
          speed={0.7}
          curveAmount={-200}
          direction="right"
          interactive={false}
          className="curved-loop-right"
          showTrack
        />
      </div>

      {/* Foreground copy */}
      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center">
        <span className="tf-eyebrow mb-6 bg-tf-bg">Spoken English coach</span>

        <h1 className="text-balance text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-tf-text">
          Speak English.
          <br />
          <span className="h-accent">Be understood.</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-[15px] leading-relaxed text-tf-muted md:text-base">
          An AI conversation partner that listens to how you actually say each sound,
          then shows you exactly what to fix — and why. Intelligibility first: your
          accent stays yours.
        </p>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href={signedIn ? "/dashboard" : "/sign-up"}
            className="inline-flex items-center justify-center rounded-full bg-tf-green px-7 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(24,164,75,0.35)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            {signedIn ? "Go to dashboard" : "Start practicing free"}
          </Link>
          <Link
            href="#demo"
            className="inline-flex items-center justify-center rounded-full border-[1.5px] border-tf-text bg-tf-bg px-7 py-3 text-sm font-semibold text-tf-text transition-colors hover:bg-tf-text hover:text-tf-bg"
          >
            See a session
          </Link>
        </div>

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-tf-muted">
          {TRUST.map((item, i) => (
            <li key={item} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
