"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Demo", href: "#demo" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const user = session?.user;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 py-3 sm:px-6 sm:py-4">
      <nav
        className={`flex w-full max-w-4xl items-center justify-between gap-4 rounded-full border px-3 py-2 transition-all duration-300 sm:px-4 ${
          scrolled
            ? "border-tf-border bg-tf-surface/85 shadow-[0_10px_30px_-14px_rgba(8,32,26,0.28)] backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        {/* Logo + wordmark. The mark ships white, so it needs a green chip. */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 pl-1 text-[15px] font-semibold tracking-[-0.015em] text-tf-text"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-tf-green shadow-[0_4px_12px_-4px_rgba(24,164,75,0.8)]">
            <Image src="/logo.svg" alt="" width={16} height={16} aria-hidden="true" />
          </span>
          TalkFlow
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-1.5 text-[13.5px] text-tf-muted transition-colors hover:bg-tf-green-tint hover:text-tf-text"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isPending ? (
            <div className="h-9 w-[132px] animate-pulse rounded-full bg-tf-border" />
          ) : user ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-tf-green px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-tf-green-strong sm:px-5"
            >
              Dashboard
            </Link>
          ) : (
            <>
              {/* Kept visible on mobile: the nav links collapse below md, so this
                  is the only route back to an existing account from the phone. */}
              <Link
                href="/sign-in"
                className="inline-flex rounded-full px-2.5 py-2 text-[13.5px] font-medium text-tf-muted transition-colors hover:text-tf-text sm:px-3"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-tf-green px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-tf-green-strong sm:px-5"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
