"use client";

import { Button } from "@/components/ui/button";
import { LogIn, Mic, X } from "lucide-react";
import Link from "next/link";

interface Props {
  onJoin: () => void;
}

export const CallLobby = ({ onJoin }: Props) => {
  return (
    <div
      className="flex h-full min-h-screen flex-col"
      style={{ background: "var(--background)" }}
    >
      <header
        className="flex h-14 shrink-0 items-center justify-end px-4 sm:px-6"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Button
          asChild
          variant="ghost"
          className="gap-2 rounded-full px-3 text-sm"
          style={{ color: "var(--primary)", border: "1px solid var(--primary)" }}
        >
          <Link href="/meetings">
            <X className="h-4 w-4" />
            Close
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        {/* Icon */}
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: "color-mix(in oklab, var(--primary) 14%, white)",
            border: "1.5px solid color-mix(in oklab, var(--primary) 40%, white)",
          }}
        >
          <Mic className="h-9 w-9" style={{ color: "var(--primary)" }} />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            Ready to practise?
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Microphone access is requested when you start speaking.
            Hold{" "}
            <kbd
              className="rounded px-1.5 py-0.5 text-xs font-mono"
              style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              SPACE
            </kbd>{" "}
            to talk; release to submit.
          </p>
        </div>

        {/* Info card */}
        <div
          className="w-full rounded-xl p-5 text-left space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {[
            { icon: "🎯", label: "Target sentence", desc: "Listen, then repeat it back." },
            { icon: "📊", label: "Arc score", desc: "Your pronunciation score on a dial after each attempt." },
            { icon: "🔬", label: "Phoneme diff", desc: "Expected vs heard — word by word, sound by sound." },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="text-lg leading-none pt-0.5">{icon}</span>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex w-full justify-center">
          <button
            type="button"
            onClick={onJoin}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 active:scale-95"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <LogIn className="h-4 w-4" />
            Start Practice
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
