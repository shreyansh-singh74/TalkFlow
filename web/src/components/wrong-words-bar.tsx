"use client";

import { normalizeWord } from "@/lib/normalize-word";
import { cn } from "@/lib/utils";
import type { MisalignedWordPair } from "@/types/pronunciation";

type Props = {
  pairs: MisalignedWordPair[] | undefined;
  activeKey: string;
  onSelectExpected: (expected: string, fromWrongBar: boolean) => void;
};

/**
 * Strip of mispronounced words the user should practise.
 * Active word → emerald accent; inactive → amber tint.
 */
export function WrongWordsBar({ pairs, activeKey, onSelectExpected }: Props) {
  if (!pairs?.length) return null;

  const unique: MisalignedWordPair[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const e = (p.expected || "").trim();
    if (!e) continue;
    const n = normalizeWord(e);
    if (seen.has(n)) continue;
    seen.add(n);
    unique.push({ ...p, expected: e });
  }
  if (!unique.length) return null;

  return (
    <div className="w-full max-w-2xl space-y-2">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
        Practice these words
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {unique.map((p) => {
          const n = normalizeWord(p.expected);
          const isActive = n === activeKey;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSelectExpected(p.expected, true)}
              className={cn(
                "rounded-full px-3.5 py-1 text-sm font-semibold transition-all duration-200 border cursor-pointer",
                "hover:scale-105 active:scale-95 shadow-2xs",
                isActive
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-400/30"
                  : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
              )}
            >
              {p.expected}
            </button>
          );
        })}
      </div>
    </div>
  );
}
