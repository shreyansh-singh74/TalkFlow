"use client";

import { normalizeWord } from "@/lib/normalize-word";
import type { MisalignedWordPair } from "@/types/pronunciation";

type Props = {
  pairs: MisalignedWordPair[] | undefined;
  activeKey: string;
  onSelectExpected: (expected: string, fromWrongBar: boolean) => void;
};

/**
 * Strip of mispronounced words the user should practise.
 * Active word → cobalt accent; inactive → amber tint (the "heard/actual" side).
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
      <p
        className="text-center text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--amber-warm)", opacity: 0.8 }}
      >
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
              className="rounded-full px-3 py-1 text-sm font-medium transition-all duration-150 border"
              style={
                isActive
                  ? {
                      background: "var(--cobalt)",
                      color: "#fff",
                      borderColor: "var(--cobalt)",
                    }
                  : {
                      background: "var(--amber-muted)",
                      color: "var(--amber-warm)",
                      borderColor: "var(--amber-warm)",
                    }
              }
            >
              {p.expected}
            </button>
          );
        })}
      </div>
    </div>
  );
}
