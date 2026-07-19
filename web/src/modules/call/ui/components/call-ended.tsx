"use client";

import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const CallEnded = () => {
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
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center animate-fade-in-up">
          {/* Icon */}
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full animate-float"
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.12))",
              border: "2px solid rgba(16,185,129,0.2)",
              boxShadow: "0 0 40px rgba(16,185,129,0.1)",
            }}
          >
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1
              className="text-2xl font-semibold"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Session complete
            </h1>
            <p className="text-sm text-neutral-400">
              Your phoneme data has been saved. A session summary will appear in your practice history shortly.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px w-full" style={{ background: "rgba(255,255,255,0.06)" }} />

          {/* CTA */}
          <Link
            href="/dashboard/meetings"
            className="flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 text-white"
            style={{
              background: "linear-gradient(135deg, #10b981, #14b8a6)",
              boxShadow: "0 4px 20px rgba(16,185,129,0.25)",
            }}
          >
            Close
          </Link>
        </div>
      </div>
    </div>
  );
};
