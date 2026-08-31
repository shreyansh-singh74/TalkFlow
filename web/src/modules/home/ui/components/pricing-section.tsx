"use client";

import { Check } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { authClient } from "@/lib/auth-client";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to start improving your pronunciation.",
    cta: "Start practicing free",
    ctaHref: "/sign-up",
    featured: false,
    features: [
      "AI conversation partner",
      "Per-word pronunciation scores",
      "IPA breakdown & fix cues",
      "Missed-words practice bar",
      "Session history",
      "US, UK & Indian reference voices",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    description: "Unlimited practice with priority scoring and deeper analytics.",
    cta: "Start 14-day free trial",
    ctaHref: "/sign-up",
    featured: true,
    badge: "Most popular",
    features: [
      "Everything in Free",
      "Unlimited practice sessions",
      "Advanced accuracy trends",
      "Weak-phoneme tracking",
      "Multi-accent scoring targets",
      "Priority voice server",
      "Export session data",
    ],
  },
];

export function PricingSection() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  return (
    <section
      id="pricing"
      className="scroll-mt-24 border-t border-tf-border bg-tf-bg px-6 py-24 md:py-32"
    >
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing."
            accent="No surprises."
            sub="Start free. Upgrade when you want more. Cancel anytime — that’s a promise, not a footnote."
          />
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          {PLANS.map(
            (
              {
                name,
                price,
                period,
                description,
                cta,
                ctaHref,
                featured,
                badge,
                features,
              },
              i,
            ) => (
              <Reveal key={name} delay={((i % 2) + 1) as 1 | 2} className="h-full">
                {/* The Pro card runs on the deep-forest brand colour so the
                    recommended plan reads as the product, not just a border. */}
                <article
                  className={cn(
                    "relative flex h-full flex-col overflow-hidden rounded-2xl border p-7 transition-all duration-300",
                    featured
                      ? "border-tf-deep bg-tf-deep shadow-[0_30px_70px_-30px_rgba(8,32,26,0.6)]"
                      : "border-tf-border bg-tf-surface hover:border-tf-green/40 hover:shadow-[0_18px_40px_-24px_rgba(8,32,26,0.3)]",
                  )}
                >
                  {featured ? (
                    <>
                      <span
                        className="tf-dots-deep pointer-events-none absolute inset-0 opacity-60"
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(24,164,75,0.32),transparent_70%)]"
                        aria-hidden="true"
                      />
                    </>
                  ) : null}

                  <div className="relative flex flex-1 flex-col">
                    {badge ? (
                      <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-tf-green px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                        {badge}
                      </span>
                    ) : (
                      /* Height-matched spacer: keeps both plan names and prices on
                         one baseline while the cards sit side by side. Dropped
                         entirely once they stack, where it would just be a gap. */
                      <span
                        className="mb-4 hidden w-fit items-center rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] md:invisible md:inline-flex"
                        aria-hidden="true"
                      >
                        &nbsp;
                      </span>
                    )}

                    <h3
                      className={cn(
                        "text-[17px] font-semibold",
                        featured ? "text-tf-deep-text" : "text-tf-text",
                      )}
                    >
                      {name}
                    </h3>

                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-[2.75rem] font-semibold tracking-[-0.04em]",
                          featured ? "text-tf-deep-text" : "text-tf-text",
                        )}
                      >
                        {price}
                      </span>
                      <span
                        className={cn(
                          "text-sm",
                          featured ? "text-tf-deep-muted" : "text-tf-subtle",
                        )}
                      >
                        {period}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "mt-3 text-[13.5px] leading-relaxed",
                        featured ? "text-tf-deep-muted" : "text-tf-muted",
                      )}
                    >
                      {description}
                    </p>

                    <div
                      className={cn(
                        "my-6 h-px",
                        featured ? "bg-tf-deep-line" : "bg-tf-border",
                      )}
                      aria-hidden="true"
                    />

                    <ul className="mb-8 flex flex-1 flex-col gap-3">
                      {features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <Check
                            className={cn(
                              "mt-0.5 size-4 shrink-0",
                              featured ? "text-tf-mint" : "text-tf-green",
                            )}
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              "text-[13.5px] leading-snug",
                              featured ? "text-tf-deep-text/85" : "text-tf-muted",
                            )}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={signedIn ? "/dashboard" : ctaHref}
                      className={cn(
                        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all active:scale-[0.98]",
                        featured
                          ? "bg-tf-green text-white shadow-[0_14px_34px_-12px_rgba(24,164,75,0.9)] hover:bg-tf-mint hover:text-tf-deep"
                          : "border border-tf-text/15 bg-tf-text text-white hover:bg-tf-green-strong",
                      )}
                    >
                      {signedIn ? "Go to dashboard" : cta}
                    </Link>
                  </div>
                </article>
              </Reveal>
            ),
          )}
        </div>

        <Reveal className="mt-8">
          <p className="text-center text-[12px] text-tf-subtle">
            No credit card required for the free plan. Upgrade or cancel anytime
            from your dashboard.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
