"use client";

interface CallActiveContextProps {
  text: string | null;
  position: "before" | "after";
  /** Segmenter hint, e.g. "continues in the next step". Only shown above. */
  note?: string | null;
}

/**
 * One neighbouring line of a pasted text, dimmed.
 *
 * Only populated for pasted-text sessions. Rehearsing a speech one line at a
 * time without seeing what comes before and after is what makes the delivery
 * sound disjointed — but the eye has to stay on the line actually being spoken,
 * hence the muted treatment.
 */
export function CallActiveContext({
  text,
  position,
  note,
}: CallActiveContextProps) {
  if (!text && !note) return null;

  return (
    <div className="w-full shrink-0 space-y-0.5 text-center">
      {text && (
        <p className="line-clamp-1 text-sm leading-snug text-neutral-400">
          {position === "before" ? `…${text}` : `${text}…`}
        </p>
      )}
      {note && position === "before" && (
        <p className="text-[11px] font-medium uppercase tracking-wider text-amber-600">
          {note}
        </p>
      )}
    </div>
  );
}
