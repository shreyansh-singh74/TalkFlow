"use client";

import { useEffect, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Volume2 } from "lucide-react";
import { usePronunciationReference } from "@/hooks/use-pronunciation-reference";
import { DIALECTS, requestSpeechVoices } from "@/lib/speak-word";
import { getBackendUrl } from "@/lib/backend-config";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [mouthFrame, setMouthFrame] = useState(0);
  const { data, loading, error } = usePronunciationReference(activeWordKey, lang);

  useEffect(() => {
    requestSpeechVoices();
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setMouthFrame(0);
      return;
    }
    const interval = setInterval(() => {
      setMouthFrame((f) => (f + 1) % 3);
    }, 120);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const play = () => {
    const text = (data?.word || displayWord || activeWordKey || "").trim();
    if (text) {
      setIsPlaying(true);
      // Use backend speech synthesis to guarantee audio output across all OS systems (including Linux/Chrome synthesis blocks)
      const url = `${getBackendUrl()}/api/phonemes/tts?text=${encodeURIComponent(text)}&lang=${lang}&rate=${isSlow ? 0.65 : 1.0}`;
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      audio.play().catch((err) => {
        console.error("Error playing word TTS:", err);
        setIsPlaying(false);
      });
    }
  };

  // Find the misaligned pair for the active word to show heard IPA
  const activePair = misalignedPairs?.find(
    (p) => p.expected?.toLowerCase() === displayWord?.toLowerCase()
  );

  return (
    <div className="w-full max-w-3xl rounded-2xl p-6 glass-panel shadow-xs">
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-neutral-200/80">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
          Phonetic Breakdown
        </span>
        <div className="flex items-center gap-3">
          {/* IPA toggle */}
          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-neutral-600">
            <Switch checked={showIPA} onCheckedChange={setShowIPA} className="scale-75" />
            IPA
          </label>
          {/* Dialect select */}
          <select
            className="rounded-md border px-2 py-1 text-xs font-semibold cursor-pointer bg-neutral-100 border-neutral-300 text-neutral-800 shadow-2xs"
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
          >
            {DIALECTS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Pronunciation Section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex-1 space-y-3 w-full">
          <div>
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Sounds like</p>
            <div className="flex items-center gap-3 mt-1">
              {loading ? (
                <p className="text-xl font-medium text-neutral-400">Loading phonetic breakdown…</p>
              ) : error ? (
                <p className="text-sm font-semibold text-amber-600">{error}</p>
              ) : data ? (
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold tracking-tight text-neutral-900">
                    <SyllableLine syllables={data.arpabet_syllables} />
                  </div>
                </div>
              ) : (
                <p className="text-3xl font-bold capitalize text-neutral-900">{displayWord}</p>
              )}
              
              {/* Play icon button directly next to sounds-like spelling */}
              <button
                type="button"
                onClick={play}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-2xs"
                title={isSlow ? "Play slow" : "Play"}
              >
                <Volume2 className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          {/* Slow toggle below the spelling */}
          <div className="flex items-center gap-2 mt-2">
            <Switch id={idSlow} checked={isSlow} onCheckedChange={setIsSlow} className="scale-75" />
            <Label htmlFor={idSlow} className="cursor-pointer text-xs font-semibold text-neutral-600">Slow speed</Label>
          </div>

          {/* Show expected vs heard comparison row if IPA toggle is on */}
          {showIPA && activePair && (
            <div className="pt-2 border-t border-dashed border-neutral-200">
              <HeardVsExpectedRow
                expected={activePair.expected}
                heard={activePair.heard}
              />
            </div>
          )}

          {/* Mismatch coaching note */}
          {activePair && (
            <p className="mt-3 rounded-lg px-3.5 py-2 text-xs leading-relaxed bg-blue-50 border border-blue-200 text-blue-800 font-medium">
              Expected <strong className="text-blue-950">&ldquo;{activePair.expected}&rdquo;</strong>, heard{" "}
              <span className="font-bold text-red-600">&ldquo;{activePair.heard}&rdquo;</span>.
            </p>
          )}
        </div>

        {/* Dynamic Mouth articulation animation SVG on the right */}
        <div
          className="flex flex-col items-center justify-center rounded-xl p-4 shrink-0 relative overflow-hidden h-28 w-28 bg-emerald-50/60 border border-emerald-200/80 shadow-2xs"
        >
          <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" style={{ color: "rgba(5,150,105,0.7)" }}>
            {/* Outline Face Profile */}
            <path
              d="M15,20 C15,80 85,80 85,20"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              className="opacity-40"
            />
            {/* Lips / Mouth outline */}
            <path
              d={
                mouthFrame === 0
                  ? "M25,50 Q50,42 75,50 Q50,58 25,50"
                  : mouthFrame === 1
                  ? "M25,50 Q50,32 75,50 Q50,68 25,50"
                  : "M25,50 Q50,22 75,50 Q50,78 25,50"
              }
              fill="rgba(5,150,105,0.1)"
              stroke="#059669"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-100 ease-in-out"
            />
            {/* Upper Teeth */}
            <path
              d={
                mouthFrame === 0
                  ? "M32,48 Q50,45 68,48"
                  : mouthFrame === 1
                  ? "M32,44 Q50,41 68,44"
                  : "M32,40 Q50,37 68,40"
              }
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="transition-all duration-100 ease-in-out"
            />
            {/* Tongue */}
            <path
              d={
                mouthFrame === 0
                  ? "M38,52 Q50,49 62,52 Q50,55 38,52"
                  : mouthFrame === 1
                  ? "M38,54 Q50,49 62,54 Q50,59 38,54"
                  : "M38,57 Q50,49 62,57 Q50,65 38,57"
              }
              fill="rgba(239,68,68,0.2)"
              stroke="rgba(220,38,38,0.7)"
              strokeWidth="1.2"
              className="transition-all duration-100 ease-in-out"
            />
          </svg>
          <span className="absolute bottom-2 text-[8px] font-bold text-emerald-800 uppercase tracking-widest">
            {isPlaying ? "Speaking..." : "Mouth Shape"}
          </span>
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
    <span
      className="text-3xl font-bold leading-snug text-neutral-900"
      style={{ fontFamily: "var(--font-phonetic)" }}
    >
      {syllables.map((s, i) => (
        <span key={i}>
          {i > 0 && (
            <span className="text-neutral-400"> · </span>
          )}
          <span style={{ fontWeight: s.stressed ? 800 : 500 }}>{s.display}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Simple two-chip row: expected word (emerald) vs heard word (amber).
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
    <div className="mt-1 flex items-center gap-2 text-sm font-semibold" style={{ fontFamily: "var(--font-phonetic)" }}>
      <span className="rounded px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
        {expected}
      </span>
      <span className="text-neutral-400">→</span>
      <span className="rounded px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200">
        {heard}
      </span>
    </div>
  );
}
