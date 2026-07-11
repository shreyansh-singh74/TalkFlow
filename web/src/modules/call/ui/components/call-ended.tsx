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
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Button
          asChild
          variant="ghost"
          className="gap-2 rounded-full px-3 text-sm"
          style={{ color: "var(--primary)", border: "1px solid var(--primary)" }}
        >
          <Link href="/dashboard/meetings">
            <X className="h-4 w-4" />
            Close
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: "color-mix(in oklab, var(--primary) 14%, white)",
            border: "1.5px solid color-mix(in oklab, var(--primary) 40%, white)",
          }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: "var(--primary)" }} />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            Session complete
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Your phoneme data has been saved. A session summary will appear in your practice history shortly.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ background: "var(--border)" }} />

        {/* CTA */}
        <Link
          href="/dashboard/meetings"
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 active:scale-95"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          Close
        </Link>
      </div>
      </div>
    </div>
  );
};
