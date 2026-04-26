import { normalizeWord } from "@/lib/normalize-word";

export type TargetWord = {
  /** Original token with punctuation, e.g. "accident," */
  raw: string;
  norm: string;
};

export function splitTargetToWords(sentence: string): TargetWord[] {
  const out: TargetWord[] = [];
  for (const m of sentence.matchAll(/\S+/g)) {
    const raw = m[0];
    const norm = normalizeWord(raw);
    if (norm) {
      out.push({ raw, norm });
    }
  }
  return out;
}
