"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const user = session?.user;

  return (
    <header
      id="landing-nav"
      className="fixed top-0 left-0 right-0 z-50 flex justify-center"
      style={{ padding: "16px 24px" }}
    >
      {/* Pill-shaped nav container */}
      <nav
        className="w-full max-w-4xl flex items-center justify-between transition-all duration-300"
        style={{
          border: "1.5px solid #E4E4D0",
          borderRadius: "999px",
          padding: "10px 20px",
          backgroundColor: scrolled ? "rgba(255,255,235,0.92)" : "#FFFFEB",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          boxShadow: scrolled ? "0 2px 16px rgba(0,0,0,0.06)" : "none",
        }}
      >
        {/* Logo + wordmark */}
        <Link
          href="/"
          id="nav-logo-link"
          className="flex items-center gap-2 font-semibold"
          style={{ color: "#1A1A1A", fontSize: 15, letterSpacing: "-0.01em" }}
        >
          <Image
            src="/logo.svg"
            alt="TalkFlow logo"
            width={20}
            height={20}
            style={{ opacity: 0.85 }}
          />
          TalkFlow
        </Link>

        {/* Center: nav links */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="#pricing"
            id="nav-pricing-link"
            className="text-sm transition-colors duration-150 hover:text-green-700"
            style={{ color: "#1A1A1A" }}
          >
            Pricing
          </Link>
        </div>

        {/* Right: CTA */}
        {isPending ? (
          <div
            style={{
              width: 140,
              height: 36,
              borderRadius: 999,
              backgroundColor: "#E4E4D0",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ) : user ? (
          <Link
            href="/dashboard"
            id="nav-dashboard-btn"
            className="text-sm font-semibold transition-all duration-200 hover:scale-105"
            style={{
              border: "1.5px solid #1A1A1A",
              borderRadius: 999,
              padding: "8px 20px",
              color: "#1A1A1A",
              backgroundColor: "transparent",
            }}
          >
            Dashboard
          </Link>
        ) : (
          <Link
            href="/sign-up"
            id="nav-signup-btn"
            className="text-sm font-semibold transition-all duration-200 hover:opacity-80"
            style={{
              border: "1.5px solid #1A1A1A",
              borderRadius: 999,
              padding: "8px 20px",
              color: "#1A1A1A",
              backgroundColor: "transparent",
            }}
          >
            Start Practicing Free
          </Link>
        )}
      </nav>
    </header>
  );
}
