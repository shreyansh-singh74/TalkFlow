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
 * Renders the heard transcript with misaligned words styled in amber/red.
 */
export function HeardTextHighlight({ text, misalignedWords, className }: Props) {
  const err = errorHeardSet(misalignedWords);
  if (!text.trim() || err.size === 0) {
    return <p className={className} style={{ color: "#14161A" }}>{text}</p>;
  }

  const parts = text.split(/([A-Za-z']+)/);
  return (
    <p className={className} style={{ color: "#14161A" }}>
      {parts.map((part, i) => {
        if (!/^[A-Za-z']+$/.test(part)) {
          return <span key={i}>{part}</span>;
        }
        if (err.has(part.toLowerCase())) {
          return (
            <span
              key={i}
              className="font-bold underline underline-offset-4 decoration-wavy decoration-2 rounded px-1 py-0.5"
              style={{
                color: "#b45309",
                textDecorationColor: "#d97706",
                background: "rgba(254, 243, 199, 0.8)",
              }}
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
