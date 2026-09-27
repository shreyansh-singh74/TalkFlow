"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Moon, Sun } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useTheme } from "@/components/theme-provider";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const { theme, toggleTheme } = useTheme();

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
        className={`flex w-full max-w-4xl items-center justify-between gap-3 rounded-full border px-3 py-2 transition-all duration-300 sm:px-4 ${
          scrolled
            ? "border-tf-border bg-tf-surface/85 shadow-[0_10px_30px_-14px_rgba(54,83,20,0.3)] backdrop-blur-xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <Link
          href="/"
          className="flex shrink-0 items-center pl-1"
        >
          <Image src="/Talkflow_logo.svg" alt="TalkFlow" width={44} height={44} className="h-11 w-11 object-contain" />
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

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            className="inline-flex size-9 items-center justify-center rounded-full text-tf-muted transition-colors hover:bg-tf-green-tint hover:text-tf-text"
          >
            {theme === "light" ? (
              <Moon className="size-4" strokeWidth={1.8} />
            ) : (
              <Sun className="size-4" strokeWidth={1.8} />
            )}
          </button>

          {isPending ? (
            <div className="h-9 w-[118px] animate-pulse rounded-full bg-tf-border" />
          ) : user ? (
            <Link
              href="/home"
              className="rounded-full bg-tf-green px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-tf-green-strong sm:px-5"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="inline-flex rounded-full px-2.5 py-2 text-[13.5px] font-medium text-tf-muted transition-colors hover:text-tf-text sm:px-3"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-full bg-tf-green px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition-colors hover:bg-tf-green-strong sm:px-5"
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
