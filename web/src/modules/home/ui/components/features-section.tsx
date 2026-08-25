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

const FEATURES = [
  {
    icon: Waves,
    title: "Scored on sound, not spelling",
    desc: "Your audio goes through a phoneme recognizer, so “tink” doesn’t get autocorrected to “think”. The mistake survives long enough to be taught.",
  },
  {
    icon: MessagesSquare,
    title: "A conversation, not flashcards",
    desc: "Push to talk and speak freely with a tutor you configure. Feedback lands on spontaneous speech, not scripted drills.",
  },
  {
    icon: Lightbulb,
    title: "Every score explains itself",
    desc: "Not “try again”. Which sound slipped, what your mouth should do differently, and why it changed the meaning.",
  },
  {
    icon: HeartHandshake,
    title: "Intelligibility first",
    desc: "Graded on being understood, not on sounding American. Harmless accent isn’t an error — keep your voice.",
  },
  {
    icon: Volume2,
    title: "Hear the target",
    desc: "Reference pronunciation for any word in US, UK or Indian voices, with a syllable and stress breakdown.",
  },
  {
    icon: Repeat,
    title: "Drill what you missed",
    desc: "Missed words collect into a practice bar, so the next round targets your weak sounds instead of random ones.",
  },
];

/** Not built yet — labelled as such rather than implied. */
const ROADMAP = ["Word stress", "Rhythm & pace", "Intonation"];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 bg-tf-bg px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="What makes it different"
            title="Pronunciation apps don’t converse."
            accent="Conversation apps don’t listen."
            accentOnNewLine
            sub="TalkFlow scores real sounds inside a real conversation — the quadrant nobody else occupies."
          />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <Reveal
              key={title}
              delay={((i % 3) + 1) as 1 | 2 | 3}
              className="h-full"
            >
              <article className="flex h-full flex-col rounded-2xl border border-tf-border bg-tf-surface p-7">
                <span className="mb-5 inline-flex size-9 items-center justify-center rounded-lg bg-tf-green-light">
                  <Icon
                    className="size-4 text-tf-green-strong"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
                <h3 className="mb-2 text-[15px] font-semibold text-tf-text">
                  {title}
                </h3>
                <p className="text-[13px] leading-relaxed text-tf-muted">{desc}</p>
              </article>
            </Reveal>
          ))}
        </div>

        {/* Roadmap, stated as roadmap. The scorer handles phonemes today; the
            suprasegmental dimensions are designed but not shipped. */}
        <Reveal className="mt-10">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-tf-border px-6 py-6 sm:flex-row sm:justify-center">
            <span className="tf-eyebrow border-tf-green-strong/30 text-tf-green-strong">
              Roadmap
            </span>
            <ul className="flex flex-wrap items-center justify-center gap-2">
              {ROADMAP.map((item) => (
                <li
                  key={item}
                  className="rounded-full border border-tf-border px-3 py-1 text-[13px] text-tf-muted"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-center text-[13px] text-tf-muted sm:text-left">
              Scored today: per-sound accuracy. These three are next.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
