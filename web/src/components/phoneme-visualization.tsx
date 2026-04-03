// web/src/components/phoneme-visualization.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import {
  PhonemeSegment,
  SentencePhonemeAnalysis,
  WordPhonemeAnalysis,
} from "@/hooks/use-phoneme-analysis";

interface PhonemeVisualizationProps {
  analysis: SentencePhonemeAnalysis;
  className?: string;
}

export function PhonemeVisualization({
  analysis,
  className = "",
}: PhonemeVisualizationProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Accuracy */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Overall Accuracy</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              Pronunciation Accuracy
            </span>
            <span className="text-2xl font-bold text-blue-600">
              {Math.round(analysis.overall_accuracy * 100)}%
            </span>
          </div>
          <Progress
            value={analysis.overall_accuracy * 100}
            className="h-2"
          />
        </div>
      </Card>

      {/* Word-by-Word Analysis */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Word-by-Word Breakdown</h3>
        {analysis.words.map((word, wordIdx) => (
          <WordPhonemeCard key={wordIdx} word={word} />
        ))}
      </div>

      {/* Problematic and Mastered Phonemes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Problematic Phonemes */}
        {analysis.problematic_phonemes.length > 0 && (
          <Card className="p-4 bg-red-50">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-900">Needs Improvement</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.problematic_phonemes.map((phoneme, idx) => (
                <Badge
                  key={idx}
                  variant="destructive"
                  className="font-mono text-sm"
                >
                  {phoneme}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Mastered Phonemes */}
        {analysis.mastered_phonemes.length > 0 && (
          <Card className="p-4 bg-green-50">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-900">Well Pronounced</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.mastered_phonemes.map((phoneme, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="font-mono text-sm border-green-600 text-green-600"
                >
                  {phoneme}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Most Common Errors */}
      {analysis.most_common_errors.length > 0 && (
        <Card className="p-4 bg-yellow-50">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h4 className="font-semibold text-yellow-900">Most Common Errors</h4>
          </div>
          <ul className="space-y-2">
            {analysis.most_common_errors.map(([phoneme, count], idx) => (
              <li key={idx} className="flex justify-between items-center text-sm">
                <span className="font-mono font-semibold">{phoneme}</span>
                <span className="text-gray-600">{count} error{count > 1 ? 's' : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface WordPhonemeCardProps {
  word: WordPhonemeAnalysis;
}

function WordPhonemeCard({ word }: WordPhonemeCardProps) {
  const accuracyColor =
    word.word_accuracy >= 80
      ? "bg-green-100 text-green-800"
      : word.word_accuracy >= 60
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <Card className="p-4">
      <div className="mb-3">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-semibold text-lg">{word.word}</h4>
            <p className="text-sm text-gray-600 font-mono">
              IPA: /{word.expected_ipa}/
            </p>
          </div>
          <Badge className={`text-base ${accuracyColor}`}>
            {Math.round(word.word_accuracy)}%
          </Badge>
        </div>
        <Progress value={word.word_accuracy} className="h-1.5" />
      </div>

      {/* Phoneme Segments */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500 font-semibold">Phoneme Details:</p>
        <div className="flex flex-wrap gap-2">
          {word.segments.map((segment, idx) => (
            <PhonemeSegmentBadge key={idx} segment={segment} />
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {word.suggestions.length > 0 && (
        <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex gap-2 items-start">
            <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900">
              {word.suggestions.map((suggestion, idx) => (
                <p key={idx} className="mb-1">
                  {suggestion}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface PhonemeSegmentBadgeProps {
  segment: PhonemeSegment;
}

function PhonemeSegmentBadge({ segment }: PhonemeSegmentBadgeProps) {
  if (segment.is_correct) {
    return (
      <div className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
        <CheckCircle2 className="w-3 h-3" />
        <span className="font-mono">{segment.phoneme}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
      <XCircle className="w-3 h-3" />
      <span className="font-mono">{segment.expected}</span>
    </div>
  );
}
