import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { PhonemeSlider } from "./phoneme-slider";
import { HERO_LINE, HERO_SENTENCE } from "./phoneme-data";

const STEPS = [
  {
    number: "1",
    title: "Speak naturally.",
    desc: "Say the sentence out loud. The coach keeps things conversational while listening for the sounds that affect clarity.",
  },
  {
    number: "2",
    title: "Review the alignment.",
    desc: "Compare the target sentence with what was heard, including the phoneme substitutions behind the score.",
  },
  {
    number: "3",
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
          {/* Left: the loop */}
          <div>
            <Reveal>
              <SectionHeading
                align="left"
                title="A simple loop."
                accent="Speak, see, improve."
              />
            </Reveal>

            <ol className="relative mt-12 space-y-9">
              <li
                className="absolute bottom-8 left-[19px] top-6 w-px bg-gradient-to-b from-tf-green/50 via-tf-border to-tf-border"
                aria-hidden="true"
              />

              {STEPS.map(({ number, title, desc }, i) => (
                <Reveal key={number} delay={((i % 3) + 1) as 1 | 2 | 3}>
                  <li className="relative flex gap-5">
                    <span
                      className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-tf-green/35 bg-tf-surface font-mono text-[13px] font-semibold text-tf-mint shadow-[0_4px_14px_-8px_rgba(24,164,75,0.9)]"
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

          {/* Right: what step 2 actually looks like */}
          <Reveal className="lg:sticky lg:top-28">
            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(24,164,75,0.12),transparent_70%)]"
                aria-hidden="true"
              />
              <span className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
                <span className="h-px w-6 bg-tf-border" aria-hidden="true" />
                Spelling, then sounds, then IPA
              </span>

              <div className="rounded-2xl border border-tf-border bg-tf-surface p-6 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.6)] md:p-8">
                <PhonemeSlider tokens={HERO_LINE} sentence={HERO_SENTENCE} />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
