import { BriefcaseBusiness, GraduationCap, MessageCircleMore } from "lucide-react";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const USE_CASES = [
  {
    icon: BriefcaseBusiness,
    title: "Meetings and standups",
    desc: "Practise the sentences you actually say at work: updates, questions, blockers, timelines and handoffs.",
    example: "I’ll check the data and update the schedule.",
    focus: { word: "schedule", ipa: "ˈskɛ.dʒuːl" },
  },
  {
    icon: MessageCircleMore,
    title: "Everyday conversation",
    desc: "Build confidence with small talk, travel, phone calls and the everyday phrases that need to land quickly.",
    example: "Could you send me the address again?",
    focus: { word: "address", ipa: "əˈdrɛs" },
  },
  {
    icon: GraduationCap,
    title: "Interviews and presentations",
    desc: "Rehearse answers out loud and fix unclear sounds before they distract from what you’re saying.",
    example: "My biggest project improved onboarding speed.",
    focus: { word: "project", ipa: "ˈprɒdʒ.ɛkt" },
  },
];

export function TestimonialsSection() {
  return (
    <section className="border-t border-tf-border bg-tf-bg px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHeading
            eyebrow="Where it helps"
            title="Practise English for"
            accent="the moments that matter."
            sub="Use TalkFlow before the call, meeting, class or interview where being understood changes the outcome."
          />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {USE_CASES.map(({ icon: Icon, title, desc, example, focus }, i) => (
            <Reveal key={title} delay={((i % 3) + 1) as 1 | 2 | 3} className="h-full">
              <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-tf-border bg-tf-surface p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-tf-green/40 hover:shadow-[0_18px_40px_-24px_rgba(8,32,26,0.35)] sm:p-7">
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
                  <p className="flex-1 text-[13.5px] leading-relaxed text-tf-muted">
                    {desc}
                  </p>

                  <div className="mt-6 rounded-xl border border-tf-border bg-tf-green-tint/60 p-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
                      Practice line
                    </p>
                    <p className="text-[14px] font-semibold leading-snug text-tf-text">
                      “{example}”
                    </p>
                    <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11.5px] text-tf-green-strong">
                      <span className="text-tf-subtle">{focus.word}</span>
                      <span className="text-tf-subtle" aria-hidden="true">
                        →
                      </span>
                      /{focus.ipa}/
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
