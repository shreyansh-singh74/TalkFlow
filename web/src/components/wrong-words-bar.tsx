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
    <div className="w-full border-b border-border pb-2">
      <div className="flex items-center gap-3 py-0.5">
        <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-warning">
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
                    ? "bg-success/10 text-primary border-success/40 ring-2 ring-success/30"
                    : "bg-warning/10 text-warning border-warning/40 hover:bg-warning/15"
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
