import {
  HeartHandshake,
  Lightbulb,
  MessagesSquare,
  Repeat,
  Volume2,
  Waves,
} from "lucide-react";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** Bento spans keep the grid full on every breakpoint: 4+2 / 2+2+2 / 3+3. */
const FEATURES = [
  {
    icon: Waves,
    title: "Understands sounds, not just words",
    desc: "TalkFlow looks at phonemes — the tiny sounds inside each word — so it catches the slips normal transcription smooths over.",
    span: "md:col-span-2 lg:col-span-4",
    feature: true,
  },
  {
    icon: MessagesSquare,
    title: "Practice inside conversation",
    desc: "Talk with an AI tutor about daily life, interviews or meetings. Feedback comes from sentences you would actually say.",
    span: "lg:col-span-2",
  },
  {
    icon: Lightbulb,
    title: "One correction at a time",
    desc: "The sound that slipped, the word it affected, and a simple mouth-placement cue for the next attempt.",
    span: "lg:col-span-2",
  },
  {
    icon: HeartHandshake,
    title: "Intelligibility first",
    desc: "The goal is being understood, not sounding American or British. If your accent is clear, it stays yours.",
    span: "lg:col-span-2",
  },
  {
    icon: Volume2,
    title: "Hear the target",
    desc: "Reference pronunciation for any word in US, UK or Indian voices, with a syllable and stress breakdown.",
    span: "lg:col-span-2",
  },
  {
    icon: Repeat,
    title: "Drill what you missed",
    desc: "Missed words collect into a practice bar, so the next round targets your weak sounds instead of random ones.",
    span: "md:col-span-1 lg:col-span-3",
  },
];

/** What the aligner reports on the featured card. */
const SUBSTITUTIONS = [
  { word: "data", expected: "eɪ", actual: "ɑ" },
  { word: "schedule", expected: "dʒ", actual: "d" },
  { word: "thursday", expected: "θ", actual: "t" },
];

/** Not built yet — labelled as such rather than implied. */
const ROADMAP = ["Word stress", "Rhythm & pace", "Intonation"];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-24 bg-tf-bg px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="What makes it different"
            title="A speaking coach that hears"
            accent="the sounds between words."
            accentOnNewLine
            sub="TalkFlow combines conversation practice with phoneme-level feedback, so you know exactly what made a sentence harder to understand."
          />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          {FEATURES.map(({ icon: Icon, title, desc, span, feature }, i) => (
            <Reveal
              key={title}
              delay={((i % 3) + 1) as 1 | 2 | 3}
              className={`h-full ${span}`}
            >
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-tf-border bg-tf-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-tf-green/40 hover:shadow-[0_18px_40px_-24px_rgba(8,32,26,0.35)] sm:p-7">
                {/* Green wash that arrives on hover */}
                <span
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(24,164,75,0.09),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden="true"
                />

                <div className="relative flex flex-1 flex-col">
                  <span
                    className="mb-5 inline-flex size-10 items-center justify-center rounded-xl bg-tf-green-light ring-1 ring-inset ring-tf-green/20"
                    aria-hidden="true"
                  >
                    <Icon className="size-[18px] text-tf-green-strong" strokeWidth={1.8} />
                  </span>

                  <h3 className="mb-2 text-[15.5px] font-semibold tracking-[-0.01em] text-tf-text">
                    {title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed text-tf-muted">{desc}</p>

                  {/* The featured card carries proof: actual substitutions. */}
                  {feature ? (
                    <ul className="mt-6 grid gap-2 sm:grid-cols-3">
                      {SUBSTITUTIONS.map(({ word, expected, actual }) => (
                        <li
                          key={word}
                          className="rounded-xl border border-tf-border bg-tf-green-tint/70 px-3 py-2.5"
                        >
                          <p className="mb-1.5 truncate text-[11px] font-medium text-tf-muted">
                            {word}
                          </p>
                          <p className="flex items-center gap-1.5 font-mono text-[13px]">
                            <span className="font-semibold text-tf-green-strong">
                              {expected}
                            </span>
                            <span className="text-tf-subtle" aria-label="became">
                              →
                            </span>
                            <span className="text-tf-text">{actual}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            </Reveal>
          ))}

          {/* Roadmap sits in the grid as the sixth tile, stated as roadmap. */}
          <Reveal delay={3} className="h-full md:col-span-1 lg:col-span-3">
            <div className="flex h-full flex-col justify-center gap-4 rounded-2xl border border-dashed border-tf-border bg-tf-green-tint/40 p-6 sm:p-7">
              <span className="tf-eyebrow w-fit border-tf-green/30 bg-tf-surface text-tf-green-strong">
                Roadmap
              </span>
              <p className="text-[13.5px] leading-relaxed text-tf-muted">
                Scored today: per-sound accuracy. These three dimensions are
                designed and next in line.
              </p>
              <ul className="flex flex-wrap gap-2">
                {ROADMAP.map((item) => (
                  <li
                    key={item}
                    className="rounded-full border border-tf-border bg-tf-surface px-3 py-1 text-[12.5px] text-tf-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
