"use client";

import { useEffect } from "react";
import Link from "next/link";
import { LandingNav } from "../components/landing-nav";
import { HeroSection } from "../components/hero-section";
import { CodeSection } from "../components/code-section";
import { FeaturesSection } from "../components/features-section";
import { HowItWorksSection } from "../components/how-it-works-section";
import { FooterSection } from "../components/footer-section";
import { authClient } from "@/lib/auth-client";

export function LandingView() {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    // Prevent browser overscroll bounce (sliding down) and white background reveal
    const originalBodyBg = document.body.style.backgroundColor;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.backgroundColor = "var(--ink)";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.backgroundColor = "var(--ink)";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, []);

  return (
    // TalkFlow Palette ink and parchment
    <div style={{ backgroundColor: "var(--ink)", color: "var(--parchment)" }} className="min-h-screen">
      <LandingNav />
      <HeroSection />
      <CodeSection />
      <FeaturesSection />
      <HowItWorksSection />

      {/* Mid-page CTA banner */}
      <section
        className="py-24 px-6"
        style={{ borderTop: "1px solid rgba(239, 234, 225, 0.08)" }}
      >
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight" style={{ color: "var(--parchment)" }}>
            From speech to structured feedback.
          </h2>
          <p className="max-w-xl mx-auto text-[15px] leading-relaxed" style={{ color: "rgba(239, 234, 225, 0.6)" }}>
            Unpack every spoken sentence into what you actually said — and what
            to do next.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href={session?.user ? "/dashboard" : "/sign-in"}
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium transition-colors"
              style={{ border: "1px solid rgba(239, 234, 225, 0.15)", color: "var(--parchment)" }}
            >
              {session?.user ? "Dashboard" : "Talk to us"}
            </Link>
            <Link
              href={session?.user ? "/dashboard" : "/sign-up"}
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-white text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--emerald)",
                boxShadow: "0 0 24px rgba(0, 168, 120, 0.4)",
              }}
            >
              {session?.user ? "Go to Dashboard" : "Sign up for free"}
            </Link>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
