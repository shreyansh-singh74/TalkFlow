// web/src/modules/call/ui/components/phoneme-real-time-feedback.tsx
"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PhonemeAccuracyIndicator,
  PhonemeFeedback,
} from "@/components/phoneme-feedback";
import {
  SentencePhonemeAnalysis,
  WordPhonemeAnalysis,
} from "@/hooks/use-phoneme-analysis";
import { Loader2, Volume2 } from "lucide-react";

interface PhonemeRealTimeFeedbackProps {
  transcript: string;
  isLoading?: boolean;
  analysis?: SentencePhonemeAnalysis | null;
  className?: string;
}

/**
 * Real-time phoneme feedback component for call interface
 * Displays pronunciation feedback as user speaks
 */
export function PhonemeRealTimeFeedback({
  transcript,
  isLoading = false,
  analysis = null,
  className = "",
}: PhonemeRealTimeFeedbackProps) {
  const [displayedWord, setDisplayedWord] = useState<WordPhonemeAnalysis | null>(
    null
  );

  // Update displayed word when analysis changes
  useEffect(() => {
    if (analysis && analysis.words.length > 0) {
      // Show the last analyzed word
      const lastWord = analysis.words[analysis.words.length - 1];
      setDisplayedWord(lastWord);
    }
  }, [analysis]);

  if (!transcript && !isLoading) {
    return (
      <Card className={`p-4 border-dashed text-center text-gray-500 ${className}`}>
        <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Speak to see pronunciation feedback...</p>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Transcript Display */}
      <Card className="p-4 bg-gray-50">
        <p className="text-xs text-gray-600 font-semibold mb-2">What you said:</p>
        <p className="text-lg font-medium text-gray-800 break-words">
          {transcript || "Listening..."}
        </p>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card className="p-4 flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">Analyzing pronunciation...</span>
        </Card>
      )}

      {/* Word Analysis */}
      {displayedWord && (
        <div className="space-y-3">
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

            {/* IPA Display */}
            <p className="text-sm text-gray-700 font-mono mb-4">
              Expected: /{displayedWord.expected_ipa}/
            </p>

            {/* Phoneme Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {displayedWord.segments.map((segment, idx) => (
                <Badge
                  key={idx}
                  variant={segment.is_correct ? "secondary" : "destructive"}
                  className="font-mono text-xs"
                >
                  {segment.phoneme}
                  {!segment.is_correct && ` ✗`}
                </Badge>
              ))}
            </div>

            {/* Feedback */}
            {!displayedWord.segments.every((s) => s.is_correct) && (
              <PhonemeFeedback word={displayedWord} />
            )}

            {/* Positive Feedback */}
            {displayedWord.segments.every((s) => s.is_correct) && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-medium">
                  ✓ Perfect pronunciation of "{displayedWord.word}"!
                </p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Overall Analysis Summary */}
      {analysis && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <p className="text-xs text-blue-600 font-semibold mb-2 uppercase">
            Session Summary
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-900">
                {Math.round(analysis.overall_accuracy * 100)}%
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

interface PhonemeDetailsPanelProps {
  analysis: SentencePhonemeAnalysis;
  className?: string;
}

/**
 * Detailed phoneme analysis panel for post-call review
 */
export function PhonemeDetailsPanel({
  analysis,
  className = "",
}: PhonemeDetailsPanelProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-600 font-semibold mb-1">
            Overall Accuracy
          </p>
          <p className="text-3xl font-bold text-blue-600">
            {Math.round(analysis.overall_accuracy * 100)}%
          </p>
        </Card>

        <Card className="p-4 text-center">
          <p className="text-xs text-gray-600 font-semibold mb-1">
            Words Analyzed
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {analysis.words.length}
          </p>
        </Card>

        <Card className="p-4 text-center">
          <p className="text-xs text-gray-600 font-semibold mb-1">
            Mastered Sounds
          </p>
          <p className="text-3xl font-bold text-green-600">
            {analysis.mastered_phonemes.length}
          </p>
        </Card>
      </div>

      {/* Word Details */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Word-by-Word Analysis</h4>
        {analysis.words.map((word, idx) => (
          <Card key={idx} className="p-3">
            <div className="flex justify-between items-center mb-2">
              <p className="font-semibold">{word.word}</p>
              <Badge
                variant={
                  word.word_accuracy >= 80
                    ? "secondary"
                    : word.word_accuracy >= 60
                      ? "outline"
                      : "destructive"
                }
              >
                {Math.round(word.word_accuracy)}%
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {word.segments.map((seg, segIdx) => (
                <Badge
                  key={segIdx}
                  variant={seg.is_correct ? "outline" : "destructive"}
                  className="text-xs font-mono"
                >
                  {seg.phoneme}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Problem Areas */}
      {analysis.problematic_phonemes.length > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <h4 className="font-semibold text-sm text-red-900 mb-2">
            Sounds That Need Practice
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.problematic_phonemes.map((phoneme, idx) => (
              <Badge key={idx} variant="destructive" className="font-mono">
                {phoneme}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {analysis.most_common_errors.length > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <h4 className="font-semibold text-sm text-amber-900 mb-2">
            Focus Areas
          </h4>
          <ul className="space-y-1">
            {analysis.most_common_errors.map(([phoneme, count], idx) => (
              <li key={idx} className="text-sm text-amber-900">
                <span className="font-mono font-semibold">{phoneme}</span> — Error{" "}
                {count} time{count > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
