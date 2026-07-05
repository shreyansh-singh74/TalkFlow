import type { MisalignedWordPair } from "@/types/pronunciation";

function errorHeardSet(pairs: MisalignedWordPair[] | undefined): Set<string> {
  const s = new Set<string>();
  if (!pairs) return s;
  for (const p of pairs) {
    if (!p.heard) continue;
    if (p.expected.toLowerCase() === p.heard.toLowerCase()) continue;
    s.add(p.heard.toLowerCase());
  }
  return s;
}

type Props = {
  text: string;
  misalignedWords?: MisalignedWordPair[];
  className?: string;
};

/**
 * Renders the heard transcript with misaligned words styled in amber-warm
 * (the "actual/heard" accent) rather than destructive red.
 * Mismatched words get an underline + amber colour so the target→heard
 * contrast is clear even without colour vision (underline carries the signal).
 */
export function HeardTextHighlight({ text, misalignedWords, className }: Props) {
  const err = errorHeardSet(misalignedWords);
  if (!text.trim() || err.size === 0) {
    return <p className={className}>{text}</p>;
  }

  const parts = text.split(/([A-Za-z']+)/);
  return (
    <p className={className}>
      {parts.map((part, i) => {
        if (!/^[A-Za-z']+$/.test(part)) {
          return <span key={i}>{part}</span>;
        }
        if (err.has(part.toLowerCase())) {
          return (
            <span
              key={i}
              className="font-medium underline underline-offset-4 decoration-2"
              style={{ color: "var(--amber-warm)", textDecorationColor: "var(--amber-warm)" }}
              title="Mismatch — check phoneme breakdown"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
