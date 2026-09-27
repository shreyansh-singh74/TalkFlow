"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LandingNav } from "../components/landing-nav";
import { HeroSection } from "../components/hero-section";
import { PhonemeTicker } from "../components/phoneme-ticker";
import { FeaturesSection } from "../components/features-section";
import { HowItWorksSection } from "../components/how-it-works-section";
import { DemoSection } from "../components/demo-section";
import { TestimonialsSection } from "../components/testimonials-section";
import { PricingSection } from "../components/pricing-section";
import { FaqSection } from "../components/faq-section";
import { FooterSection } from "../components/footer-section";
import { authClient } from "@/lib/auth-client";

export function LandingView() {
  const { data: session } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  return (
    <div className="landing-page min-h-screen">
      <LandingNav />
      <HeroSection />
      <PhonemeTicker />
      <FeaturesSection />
      <HowItWorksSection />
      <DemoSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />

      {/* Final CTA */}
      <section className="relative isolate overflow-hidden border-t border-tf-border bg-tf-bg px-6 py-24 md:py-28">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(66,184,102,0.18),transparent_70%)]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-3xl space-y-6 text-center">
          <h2 className="text-balance text-[clamp(1.875rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-tf-text">
            Clarity, not accent.
          </h2>

          <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-tf-muted">
            Practice the sounds that make you clearer, and keep the accent that
            makes you you.
          </p>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
            <Link
              href={signedIn ? "/home" : "/sign-up"}
              className="group inline-flex w-full items-center justify-center rounded-full bg-tf-green px-7 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-tf-green-strong sm:w-auto"
            >
              {signedIn ? "Go to dashboard" : "Sign up for free"}
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#demo"
              className="inline-flex w-full items-center justify-center rounded-full border border-tf-border bg-tf-surface px-7 py-3.5 text-sm font-semibold text-tf-text transition-colors hover:bg-tf-green-tint sm:w-auto"
            >
              See a sample session
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
