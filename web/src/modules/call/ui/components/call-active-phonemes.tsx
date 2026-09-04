"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { PerPhonemeDetail } from "@/types/pronunciation";

interface CallActivePhonemesProps {
  perPhoneme: PerPhonemeDetail[] | null | undefined;
}

/**
 * Per-phone scores from the acoustic scorer.
 *
 * `expected` is already an IPA symbol (see `_ipa()` in the backend's
 * `scoring.py`), so it doubles as the display label.
 *
 * The scoring method label is shown once, in the "Heard" panel header
 * (`CallActiveFeedback`), not repeated here.
 */
export function CallActivePhonemes({ perPhoneme }: CallActivePhonemesProps) {
  const phones = useMemo(
    () => (perPhoneme ?? []).filter((p) => p.expected),
    [perPhoneme]
  );

  // The text-proxy scorer has no acoustic model behind it, so it emits no
  // per-phone data. Render nothing rather than an empty rail.
  if (phones.length === 0) return null;

  const weakest = phones.reduce(
    (worst, p) => (p.accuracy < worst.accuracy ? p : worst),
    phones[0]
  );

  return (
    <div className="w-full border-t border-neutral-200 pt-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
        Sounds
      </p>

      <div className="flex flex-nowrap gap-1 overflow-x-auto">
        {phones.map((phone, i) => (
          <span
            key={`${phone.expected}-${i}`}
            title={
              phone.actual && phone.actual !== phone.expected
                ? `Expected ${phone.expected}, heard ${phone.actual} — ${Math.round(phone.accuracy)}%`
                : `${phone.expected} — ${Math.round(phone.accuracy)}%`
            }
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-xs tabular-nums",
              phone.accuracy >= 80
                ? "bg-emerald-50 text-emerald-800"
                : phone.accuracy >= 55
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-800",
              phone === weakest && phone.accuracy < 80 && "ring-1 ring-red-300"
            )}
          >
            {phone.expected}
          </span>
        ))}
      </div>

      {weakest.accuracy < 80 && (
        <p className="mt-2 text-xs font-medium text-neutral-600">
          Weakest sound: <span className="font-mono">{weakest.expected}</span> at{" "}
          {Math.round(weakest.accuracy)}%
          {weakest.actual && weakest.actual !== weakest.expected
            ? ` — heard as ${weakest.actual}.`
            : "."}
        </p>
      )}
    </div>
  );
}
