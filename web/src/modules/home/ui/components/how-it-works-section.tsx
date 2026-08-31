import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { SessionCard } from "./session-card";
import { SAMPLES } from "./session-samples";

const STEPS = [
  {
    number: "01",
    title: "Choose what to practise.",
    desc: "Start a daily conversation, prep for an interview, or build a tutor around the situations you care about.",
  },
  {
    number: "02",
    title: "Speak naturally.",
    desc: "Say the sentence out loud. The coach keeps things conversational while listening for the sounds that affect clarity.",
  },
  {
    number: "03",
    title: "Review the alignment.",
    desc: "Compare the target sentence with what was heard, including the phoneme substitutions behind the score.",
  },
  {
    number: "04",
    title: "Repeat with a cue.",
    desc: "Use one focused mouth-placement tip, then try again until the sentence lands more clearly.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-tf-border bg-tf-bg px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          {/* Left — the flow */}
          <div>
            <Reveal>
              <SectionHeading
                align="left"
                eyebrow="How it works"
                title="A simple loop."
                accent="Speak, see, improve."
              />
            </Reveal>

            <ol className="relative mt-12 space-y-9">
              {/* Vertical connecting line */}
              <li
                className="absolute bottom-8 left-[19px] top-6 w-px bg-gradient-to-b from-tf-green/50 via-tf-border to-tf-border"
                aria-hidden="true"
              />

              {STEPS.map(({ number, title, desc }, i) => (
                <Reveal key={number} delay={((i % 3) + 1) as 1 | 2 | 3}>
                  <li className="relative flex gap-5">
                    <span
                      className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-tf-green/35 bg-tf-surface font-mono text-[13px] font-semibold text-tf-green-strong shadow-[0_4px_14px_-8px_rgba(24,164,75,0.9)]"
                      aria-hidden="true"
                    >
                      {number}
                    </span>
                    <div className="pt-1.5">
                      <h3 className="mb-1.5 text-[15.5px] font-semibold tracking-[-0.01em] text-tf-text">
                        {title}
                      </h3>
                      <p className="text-[13.5px] leading-relaxed text-tf-muted">
                        {desc}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>

          {/* Right — what step 3 actually looks like */}
          <Reveal className="lg:sticky lg:top-28">
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(24,164,75,0.12),transparent_70%)]"
                aria-hidden="true"
              />
              <span className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
                <span className="h-px w-6 bg-tf-border" aria-hidden="true" />
                Step 03, in the product
              </span>
              {/* SAMPLES[1] is the hero sentence, scored — same line, same 79%,
                  same /eɪ/ cue, so the page tells one story instead of three.
                  SAMPLES[0] is the demo section's default tab; reusing it here
                  would show the identical card twice within one scroll. */}
              <SessionCard
                sample={SAMPLES[1]}
                compact
                className="shadow-[0_24px_60px_-32px_rgba(8,32,26,0.32)]"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
