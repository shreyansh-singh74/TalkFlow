"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Developers", href: "#" },
  { label: "Resources", href: "#" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={
        scrolled
          ? {
              backgroundColor: "rgba(20, 22, 26, 0.9)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(239, 234, 225, 0.08)",
            }
          : { backgroundColor: "transparent" }
      }
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo + wordmark */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.svg" alt="TalkFlow" width={22} height={22} className="opacity-80" />
          <span className="font-semibold text-[15px] tracking-tight" style={{ color: "var(--parchment)" }}>
            TalkFlow
          </span>
        </Link>
        
        {/* Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-[13px] transition-colors hover:text-white"
              style={{ color: "rgba(239, 234, 225, 0.6)" }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Auth buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden sm:inline-flex text-[13px] transition-colors hover:text-white px-3 py-1.5"
            style={{ color: "rgba(239, 234, 225, 0.6)" }}
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center text-[13px] font-medium text-white px-4 py-2 rounded-md transition-all"
            style={{
              backgroundColor: "var(--emerald)",
              boxShadow: "0 0 16px rgba(0, 168, 120, 0.35)",
            }}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
