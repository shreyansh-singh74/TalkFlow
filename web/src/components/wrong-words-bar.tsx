"use client";

import { normalizeWord } from "@/lib/normalize-word";
import type { MisalignedWordPair } from "@/types/pronunciation";
import { Button } from "@/components/ui/button";

type Props = {
  pairs: MisalignedWordPair[] | undefined;
  activeKey: string;
  onSelectExpected: (expected: string, fromWrongBar: boolean) => void;
};

export function WrongWordsBar({ pairs, activeKey, onSelectExpected }: Props) {
  if (!pairs?.length) {
    return null;
  }
  const unique: MisalignedWordPair[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const e = (p.expected || "").trim();
    if (!e) {
      continue;
    }
    const n = normalizeWord(e);
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);
    unique.push({ ...p, expected: e });
  }
  if (!unique.length) {
    return null;
  }
  return (
    <div className="w-full max-w-2xl space-y-2">
      <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Practice these words
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {unique.map((p) => {
          const n = normalizeWord(p.expected);
          const isActive = n === activeKey;
          return (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              className="rounded-full"
              onClick={() => onSelectExpected(p.expected, true)}
            >
              {p.expected}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
