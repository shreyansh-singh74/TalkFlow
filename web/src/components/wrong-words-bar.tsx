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
 * Strip of mispronounced words the user should practise. Renders nothing when
 * there is nothing to practise. Always one row: the label is inline on the
 * left and a long chip list scrolls horizontally instead of wrapping.
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
    <div className="w-full border-b border-neutral-100 pb-2">
      <div className="flex items-center gap-3 py-0.5">
        <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
          Practice these words
        </p>
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto">
          {unique.map((p) => {
            const n = normalizeWord(p.expected);
            const isActive = n === activeKey;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onSelectExpected(p.expected, true)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1 text-sm font-semibold transition-all duration-200 border cursor-pointer",
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
    </div>
  );
}
