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
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Button
          asChild
          variant="ghost"
          className="gap-2 rounded-full px-3 text-sm"
          style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
        >
          <Link href="/dashboard/meetings">
            <X className="h-4 w-4" />
            Close
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          {/* Icon */}
          <div className="relative">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.12))",
                border: "2px solid rgba(16,185,129,0.2)",
                boxShadow: "0 0 40px rgba(16,185,129,0.1)",
              }}
            >
              <Mic className="h-10 w-10 text-emerald-400" />
            </div>
            {/* Animated ring */}
            <span
              className="mic-pulse-ring absolute inset-0 rounded-full"
              style={{ background: "rgba(16,185,129,0.2)" }}
            />
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h1
              className="text-3xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Ready to practise?
            </h1>
            <p className="text-sm leading-relaxed text-neutral-400">
              Microphone access is requested when you start speaking.
              Hold{" "}
              <kbd className="rounded px-1.5 py-0.5 text-xs font-mono bg-neutral-800 border border-neutral-700 text-neutral-300">
                SPACE
              </kbd>{" "}
              to talk; release to submit.
            </p>
          </div>

          {/* Info card */}
          <div className="w-full rounded-xl p-5 text-left space-y-3 glass-panel">
            {[
              { icon: "🎯", label: "Target sentence", desc: "Listen, then repeat it back." },
              { icon: "📊", label: "Arc score", desc: "Your pronunciation score on a dial after each attempt." },
              { icon: "🔬", label: "Phoneme diff", desc: "Expected vs heard — word by word, sound by sound." },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-lg leading-none pt-0.5">{icon}</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{label}</p>
                  <p className="text-xs text-neutral-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex w-full justify-center">
            <button
              type="button"
              onClick={onJoin}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 active:scale-95 cursor-pointer text-white"
              style={{
                background: "linear-gradient(135deg, #10b981, #14b8a6)",
                boxShadow: "0 4px 20px rgba(16,185,129,0.25)",
              }}
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
