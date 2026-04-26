"use client";

import { useEffect, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  PhonemeAccuracyIndicator,
  PhonemeFeedback,
} from "@/components/phoneme-feedback";
import {
  SentencePhonemeAnalysis,
  WordPhonemeAnalysis,
} from "@/hooks/use-phoneme-analysis";

interface PhonemeRealTimeFeedbackProps {
  transcript: string;
  isLoading?: boolean;
  analysis?: SentencePhonemeAnalysis | null;
  className?: string;
}

export function PhonemeRealTimeFeedback({
  transcript,
  isLoading = false,
  analysis = null,
  className = "",
}: PhonemeRealTimeFeedbackProps) {
  const [displayedWord, setDisplayedWord] = useState<WordPhonemeAnalysis | null>(
    null,
  );

  useEffect(() => {
    if (!analysis || analysis.words.length === 0) {
      return;
    }
    const firstWithErrors = analysis.words.find((w) =>
      w.segments.some((s) => !s.is_correct),
    );
    setDisplayedWord(firstWithErrors ?? analysis.words[analysis.words.length - 1]);
  }, [analysis]);

  if (!transcript && !isLoading) {
    return (
      <Card
        className={`p-4 border-dashed text-center text-gray-500 ${className}`}
      >
        <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Speak to see pronunciation feedback...</p>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <Card className="p-4 bg-gray-50">
        <p className="text-xs text-gray-600 font-semibold mb-2">What you said:</p>
        <p className="text-lg font-medium text-gray-800 break-words">
          {transcript || "Listening..."}
        </p>
      </Card>

      {isLoading && (
        <Card className="p-4 flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Analyzing pronunciation...</span>
        </Card>
      )}

      {displayedWord && (
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-600 font-semibold mb-1">
                Current Word:
              </p>
              <p className="text-2xl font-bold">{displayedWord.word}</p>
            </div>
            <PhonemeAccuracyIndicator
              accuracy={displayedWord.word_accuracy}
              size="md"
            />
          </div>

          <p className="text-sm text-gray-700 font-mono mb-4">
            Expected: /{displayedWord.expected_ipa}/
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {displayedWord.segments.map((segment, idx) => (
              <Badge
                key={idx}
                variant={segment.is_correct ? "secondary" : "destructive"}
                className="font-mono text-xs"
              >
                {segment.phoneme}
                {!segment.is_correct && " ✗"}
              </Badge>
            ))}
          </div>

          {displayedWord.segments.some((s) => !s.is_correct) ? (
            <PhonemeFeedback word={displayedWord} />
          ) : (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">
                ✓ Perfect pronunciation of &quot;{displayedWord.word}&quot;
              </p>
            </div>
          )}
        </Card>
      )}

      {analysis && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600 font-semibold mb-2 uppercase">
            Session Summary
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {Math.round(analysis.overall_accuracy)}%
              </p>
              <p className="text-xs text-blue-700 mt-1">Overall Accuracy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {analysis.mastered_phonemes.length}
              </p>
              <p className="text-xs text-green-700 mt-1">Mastered Sounds</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {analysis.problematic_phonemes.length}
              </p>
              <p className="text-xs text-red-700 mt-1">Needs Work</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
