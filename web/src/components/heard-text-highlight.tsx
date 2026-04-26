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
        const isErr = err.has(part.toLowerCase());
        if (isErr) {
          return (
            <span
              key={i}
              className="font-medium text-destructive underline decoration-destructive/30 underline-offset-4"
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
