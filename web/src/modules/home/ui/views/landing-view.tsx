"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LandingNav } from "../components/landing-nav";
import { HeroSection } from "../components/hero-section";
import { PhonemeTicker } from "../components/phoneme-ticker";
import { FeaturesSection } from "../components/features-section";
import { DemoSection } from "../components/demo-section";
import { HowItWorksSection } from "../components/how-it-works-section";
import { TestimonialsSection } from "../components/testimonials-section";
import { PricingSection } from "../components/pricing-section";
import { FooterSection } from "../components/footer-section";
import { authClient } from "@/lib/auth-client";

export function LandingView() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  return (
    <div className="landing-page min-h-screen">
      <LandingNav />
      <HeroSection />

      {/* Deep-forest band: carries the motion out of the hero without competing
          with the headline the way the old curved marquees did. */}
      <PhonemeTicker />

      <FeaturesSection />
      <DemoSection />
      <HowItWorksSection />

      {/* Mid-page CTA — the second dark beat in the page rhythm. */}
      <section className="relative isolate overflow-hidden bg-tf-deep px-6 py-24 md:py-28">
        <div
          className="tf-dots-deep pointer-events-none absolute inset-0 opacity-50"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(24,164,75,0.28),transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-3xl space-y-6 text-center">
          <span className="tf-eyebrow tf-eyebrow-deep">Ready when you are</span>

          <h2 className="text-balance text-[clamp(1.875rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-tf-deep-text">
            Practice one sentence.{" "}
            <span className="h-accent text-tf-mint">
              Leave with one clearer sound.
            </span>
          </h2>

          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-tf-deep-muted">
            No vague scores, no accent shaming. TalkFlow turns real speech into a
            focused correction you can use in your next conversation.
          </p>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
            <Link
              href={signedIn ? "/dashboard" : "/sign-up"}
              className="group inline-flex w-full items-center justify-center rounded-full bg-tf-green px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-tf-mint hover:text-tf-deep sm:w-auto"
            >
              {signedIn ? "Go to dashboard" : "Sign up for free"}
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex w-full items-center justify-center rounded-full border border-tf-deep-line bg-white/5 px-7 py-3.5 text-sm font-semibold text-tf-deep-text backdrop-blur transition-colors hover:bg-white/10 sm:w-auto"
            >
              See a sample session
            </Link>
          </div>
        </div>
      </section>

      <TestimonialsSection />
      <PricingSection />
      <FooterSection />
    </div>
  );
}
