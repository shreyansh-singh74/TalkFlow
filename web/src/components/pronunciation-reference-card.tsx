"use client";

import { Manrope } from "next/font/google";
import { useEffect, useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";
import { usePronunciationReference } from "@/hooks/use-pronunciation-reference";
import { DIALECTS, requestSpeechVoices, speakWord } from "@/lib/speak-word";
import type { PronunciationReferenceResponse } from "@/types/pronunciation";

const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "700"] });

type Props = {
  displayWord: string;
  activeWordKey: string;
  lang: string;
  onLangChange: (lang: string) => void;
};

export function PronunciationReferenceCard({
  displayWord,
  activeWordKey,
  lang,
  onLangChange,
}: Props) {
  const idSlow = useId();
  const [isSlow, setIsSlow] = useState(false);
  const { data, loading, error } = usePronunciationReference(activeWordKey);

  useEffect(() => {
    requestSpeechVoices();
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.getVoices();
  }, []);

  const play = (rate: number) => {
    const text = (data?.word || displayWord || activeWordKey || "").trim();
    if (!text) {
      return;
    }
    speakWord(text, { lang, rate });
  };

  return (
    <div
      className={`w-full max-w-2xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm ${manrope.className}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Pronunciation</h3>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only">Dialect</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
          >
            {DIALECTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">Sounds like</p>
          <h4 className="text-2xl font-semibold capitalize leading-tight tracking-tight sm:text-3xl">
            {displayWord}
          </h4>
          {loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {data && !loading && (
            <SyllableLine syllables={data.arpabet_syllables} />
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              onClick={() => play(isSlow ? 0.7 : 1)}
              title="Play"
            >
              <Volume2 className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                id={idSlow}
                checked={isSlow}
                onCheckedChange={setIsSlow}
              />
              <Label htmlFor={idSlow} className="text-sm text-muted-foreground">
                Slow
              </Label>
            </div>
          </div>
        </div>
        <MouthHint />
      </div>
    </div>
  );
}

function SyllableLine({ syllables }: { syllables: PronunciationReferenceResponse["arpabet_syllables"] }) {
  if (!syllables.length) {
    return null;
  }
  return (
    <p className="text-xl font-medium leading-snug sm:text-2xl">
      {syllables.map((s, i) => (
        <span key={i}>
          {i > 0 && <span className="text-muted-foreground"> · </span>}
          <span
            className={s.stressed ? "font-bold text-foreground" : "font-normal text-foreground"}
          >
            {s.display}
          </span>
        </span>
      ))}
    </p>
  );
}

function MouthHint() {
  return (
    <div className="flex w-full shrink-0 items-center justify-center sm:w-28">
      <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-sky-200/60 bg-sky-100/50 dark:border-sky-800/40 dark:bg-sky-950/30">
        <svg
          viewBox="0 0 64 64"
          className="h-16 w-16 text-sky-600 dark:text-sky-400"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M32 8c-8 0-14 5-16 12l4 1c1-4 5-7 9-7h6c4 0 8 3 9 7l4-1C46 13 40 8 32 8z"
            opacity="0.35"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M20 32c0 0 4 8 12 8s12-8 12-8"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M26 40h12"
            opacity="0.6"
          />
        </svg>
      </div>
    </div>
  );
}
