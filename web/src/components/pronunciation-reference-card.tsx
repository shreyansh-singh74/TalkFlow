"use client";

import { useEffect, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Volume2 } from "lucide-react";
import { usePronunciationReference } from "@/hooks/use-pronunciation-reference";
import { DIALECTS, requestSpeechVoices, speakWord } from "@/lib/speak-word";
import type { PronunciationReferenceResponse } from "@/types/pronunciation";
import type { MisalignedWordPair } from "@/types/pronunciation";

type Props = {
  displayWord: string;
  activeWordKey: string;
  lang: string;
  onLangChange: (lang: string) => void;
  /** Misaligned pairs for the phoneme diff row */
  misalignedPairs?: MisalignedWordPair[];
};

/**
 * Merged phonetic breakdown panel.
 * Shows: word → target IPA (cobalt) → heard IPA (amber) in one aligned view.
 * Syllable respelling and IPA toggle so beginners and advanced users both win.
 */
export function PronunciationReferenceCard({
  displayWord,
  activeWordKey,
  lang,
  onLangChange,
  misalignedPairs,
}: Props) {
  const idSlow = useId();
  const [isSlow, setIsSlow] = useState(false);
  const [showIPA, setShowIPA] = useState(false);
  const { data, loading, error } = usePronunciationReference(activeWordKey);

  useEffect(() => {
    requestSpeechVoices();
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
  }, []);

  const play = () => {
    const text = (data?.word || displayWord || activeWordKey || "").trim();
    if (text) speakWord(text, { lang, rate: isSlow ? 0.65 : 1 });
  };

  // Find the misaligned pair for the active word to show heard IPA
  const activePair = misalignedPairs?.find(
    (p) => p.expected?.toLowerCase() === displayWord?.toLowerCase()
  );

  return (
    <div
      className="w-full max-w-2xl rounded-xl border p-5 shadow-sm"
      style={{
        background: "var(--parchment)",
        borderColor: "oklch(0.85 0.02 80)",
        color: "var(--ink)",
      }}
    >
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--cobalt)" }}
        >
          Phonetic Breakdown
        </span>
        <div className="flex items-center gap-3">
          {/* IPA toggle */}
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink)", opacity: 0.6 }}>
            <Switch checked={showIPA} onCheckedChange={setShowIPA} className="scale-75" />
            IPA
          </label>
          {/* Dialect select */}
          <select
            className="rounded-md border px-2 py-0.5 text-xs"
            style={{ borderColor: "oklch(0.85 0.02 80)", background: "transparent", color: "var(--ink)" }}
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
          >
            {DIALECTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Word + playback */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h4
            className="text-3xl font-semibold capitalize leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {displayWord}
          </h4>

          {loading && (
            <p className="mt-1 text-sm" style={{ opacity: 0.5 }}>Loading…</p>
          )}
          {error && (
            <p className="mt-1 text-sm" style={{ color: "var(--amber-warm)" }}>{error}</p>
          )}

          {data && !loading && (
            <div className="mt-3 space-y-2">
              {/* Syllable respelling — always visible */}
              <SyllableLine syllables={data.arpabet_syllables} />

              {/* Show "heard" word when there's a mismatch */}
              {showIPA && activePair && (
                <HeardVsExpectedRow
                  expected={activePair.expected}
                  heard={activePair.heard}
                />
              )}
            </div>
          )}

          {/* Mismatch coaching note */}
          {activePair && (
            <p
              className="mt-3 rounded-md px-3 py-2 text-sm leading-relaxed"
              style={{ background: "var(--cobalt-muted)", color: "var(--cobalt)" }}
            >
              Expected <strong>&ldquo;{activePair.expected}&rdquo;</strong>, heard{" "}
              <span style={{ color: "var(--amber-warm)" }}>&ldquo;{activePair.heard}&rdquo;</span>.
            </p>
          )}
        </div>

        {/* Play button */}
        <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
          <button
            type="button"
            onClick={play}
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-150 hover:scale-105 active:scale-95"
            style={{ borderColor: "var(--cobalt)", color: "var(--cobalt)" }}
            title={isSlow ? "Play slow" : "Play"}
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <label className="flex cursor-pointer flex-col items-center gap-0.5 text-[10px]" style={{ opacity: 0.6 }}>
            <Switch id={idSlow} checked={isSlow} onCheckedChange={setIsSlow} className="scale-75" />
            <Label htmlFor={idSlow} className="cursor-pointer text-[10px]">Slow</Label>
          </label>
        </div>
      </div>
    </div>
  );
}

function SyllableLine({
  syllables,
}: {
  syllables: PronunciationReferenceResponse["arpabet_syllables"];
}) {
  if (!syllables.length) return null;
  return (
    <p
      className="text-xl font-medium leading-snug"
      style={{ fontFamily: "var(--font-phonetic)", color: "var(--ink)" }}
    >
      {syllables.map((s, i) => (
        <span key={i}>
          {i > 0 && (
            <span style={{ opacity: 0.35 }}> · </span>
          )}
          <span style={{ fontWeight: s.stressed ? 700 : 400 }}>{s.display}</span>
        </span>
      ))}
    </p>
  );
}

/**
 * Simple two-chip row: expected word (cobalt) vs heard word (amber).
 * Shown when the user enables the IPA toggle and a mismatch pair exists.
 */
function HeardVsExpectedRow({
  expected,
  heard,
}: {
  expected: string;
  heard: string;
}) {
  return (
    <div className="mt-1 flex items-center gap-2 text-sm" style={{ fontFamily: "var(--font-phonetic)" }}>
      <span
        className="rounded px-2 py-0.5 font-medium"
        style={{ background: "var(--cobalt-muted)", color: "var(--cobalt)" }}
      >
        {expected}
      </span>
      <span style={{ opacity: 0.4 }}>→</span>
      <span
        className="rounded px-2 py-0.5 font-medium"
        style={{ background: "var(--amber-muted)", color: "var(--amber-warm)" }}
      >
        {heard}
      </span>
    </div>
  );
}
