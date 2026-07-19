"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { User, LayoutDashboard } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Developers", href: "#" },
  { label: "Resources", href: "#" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const user = session?.user;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-8 w-24 animate-pulse rounded-md bg-white/5" />
          ) : user ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/10 hover:border-white/25 shadow-xs"
            >
              <Avatar className="h-5 w-5">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name || "User"} />
                ) : null}
                <AvatarFallback className="bg-emerald-500/20 text-[10px] text-emerald-300 font-bold">
                  {user.name ? getInitials(user.name) : <User className="h-3 w-3" />}
                </AvatarFallback>
              </Avatar>
              <span>Dashboard</span>
              <LayoutDashboard className="h-3.5 w-3.5 opacity-70" />
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
