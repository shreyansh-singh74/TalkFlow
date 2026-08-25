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
    const originalBodyBg = document.body.style.backgroundColor;
    const originalBodyOverscroll = document.body.style.overscrollBehavior;
    const originalHtmlBg = document.documentElement.style.backgroundColor;
    const originalHtmlOverscroll =
      document.documentElement.style.overscrollBehavior;

    // Use the new warm cream background
    document.body.style.backgroundColor = "#FFFFEB";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.backgroundColor = "#FFFFEB";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.backgroundColor = originalBodyBg;
      document.body.style.overscrollBehavior = originalBodyOverscroll;
      document.documentElement.style.backgroundColor = originalHtmlBg;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, []);

  return (
    <div
      style={{ backgroundColor: "#FFFFEB", color: "#1A1A1A" }}
      className="min-h-screen"
    >
      <LandingNav />
      <HeroSection />

      {/* Remaining sections keep their own styling */}
      <CodeSection />
      <FeaturesSection />
      <HowItWorksSection />

      {/* Mid-page CTA banner */}
      <section
        className="py-24 px-6"
        style={{ borderTop: "1px solid #E4E4D0", backgroundColor: "#DDF5E6" }}
      >
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight"
            style={{ color: "#1A1A1A" }}
          >
            From speech to structured feedback.
          </h2>
          <p
            className="max-w-xl mx-auto text-[15px] leading-relaxed"
            style={{ color: "#3D3D3D" }}
          >
            Unpack every spoken sentence into what you actually said — and what
            to do next.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href={session?.user ? "/sign-in" : "/sign-in"}
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-medium transition-colors"
              style={{
                border: "1.5px solid #1A1A1A",
                color: "#1A1A1A",
                backgroundColor: "transparent",
              }}
            >
              {session?.user ? "Dashboard" : "Talk to us"}
            </Link>
            <Link
              href={session?.user ? "/dashboard" : "/sign-up"}
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-medium transition-all"
              style={{
                backgroundColor: "#18A44B",
                color: "#FFFFFF",
                boxShadow: "0 0 24px rgba(24,164,75,0.35)",
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
