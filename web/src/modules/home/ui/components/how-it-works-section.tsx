import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { SessionCard } from "./session-card";
import { SAMPLES } from "./session-samples";

const STEPS = [
  {
    number: "01",
    title: "Pick a tutor.",
    desc: "Choose a conversation partner or write your own — its persona, its topic, and how hard it pushes you.",
  },
  {
    number: "02",
    title: "Talk.",
    desc: "Hold to speak and say it however it comes out. It answers out loud, so it stays a conversation rather than a test.",
  },
  {
    number: "03",
    title: "See what slipped.",
    desc: "Per-word scores, the IPA for the sound that broke, and a placement cue for fixing it.",
  },
  {
    number: "04",
    title: "Run it back.",
    desc: "Missed words go to your practice bar, and every session is saved so you can replay what you actually said.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-tf-border bg-tf-bg px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          {/* Left — the flow */}
          <div>
            <Reveal>
              <SectionHeading
                align="left"
                eyebrow="How it works"
                title="Four steps."
                accent="No linguistics degree."
              />
            </Reveal>

            <ol className="mt-12 space-y-10">
              {STEPS.map(({ number, title, desc }, i) => (
                <Reveal key={number} delay={((i % 3) + 1) as 1 | 2 | 3}>
                  <li className="flex gap-6">
                    <span
                      className="w-10 shrink-0 font-mono text-3xl font-bold text-tf-border"
                      aria-hidden="true"
                    >
                      {number}
                    </span>
                    <div className="pt-1">
                      <h3 className="mb-2 text-[15px] font-semibold text-tf-text">
                        {title}
                      </h3>
                      <p className="text-[13px] leading-relaxed text-tf-muted">
                        {desc}
                      </p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>

          {/* Right — what step 3 actually looks like */}
          <Reveal className="lg:sticky lg:top-24">
            <SessionCard sample={SAMPLES[0]} compact />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
