import { BriefcaseBusiness, GraduationCap, MessageCircleMore } from "lucide-react";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const USE_CASES = [
  {
    icon: BriefcaseBusiness,
    title: "Sessions and standups",
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
            title="Practise English for"
            accent="the moments that matter."
            sub="Use TalkFlow before the call, session, class or interview where being understood changes the outcome."
          />
        </Reveal>

        <div className="mt-14 space-y-5">
          {USE_CASES.map(({ icon: Icon, title, desc, example, focus }, i) => (
            <Reveal key={title} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <article className="group grid gap-6 rounded-2xl border border-tf-border bg-tf-surface p-6 transition-colors hover:border-tf-green/40 md:grid-cols-2 md:items-center md:p-8">
                <div className="flex gap-4">
                  <span
                    className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-tf-green-light ring-1 ring-inset ring-tf-green/20"
                    aria-hidden="true"
                  >
                    <Icon className="size-[18px] text-tf-mint" strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3 className="mb-1.5 text-[15.5px] font-semibold tracking-[-0.01em] text-tf-text">
                      {title}
                    </h3>
                    <p className="max-w-md text-[13.5px] leading-relaxed text-tf-muted">
                      {desc}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-tf-border bg-tf-green-tint/60 p-4 md:justify-self-end md:p-5 md:text-right">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-tf-subtle">
                    Practice line
                  </p>
                  <p className="text-[14px] font-semibold leading-snug text-tf-text">
                    “{example}”
                  </p>
                  <p className="mt-2.5 flex items-center gap-1.5 font-mono text-[11.5px] text-tf-mint md:justify-end">
                    <span className="text-tf-subtle">{focus.word}</span>
                    <span className="text-tf-subtle" aria-hidden="true">
                      →
                    </span>
                    /{focus.ipa}/
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
