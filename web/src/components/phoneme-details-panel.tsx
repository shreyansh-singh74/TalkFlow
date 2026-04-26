"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SentencePhonemeAnalysis } from "@/hooks/use-phoneme-analysis";

interface PhonemeDetailsPanelProps {
  analysis: SentencePhonemeAnalysis;
  className?: string;
}

export function PhonemeDetailsPanel({
  analysis,
  className = "",
}: PhonemeDetailsPanelProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-xs text-gray-600 font-semibold mb-1">
            Overall Accuracy
          </p>
          <p className="text-3xl font-bold text-blue-600">
            {Math.round(analysis.overall_accuracy)}%
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

      {analysis.most_common_errors.length > 0 && (
        <Card className="p-4 bg-amber-50 border-amber-200">
          <h4 className="font-semibold text-sm text-amber-900 mb-2">
            Focus Areas
          </h4>
          <ul className="space-y-1">
            {analysis.most_common_errors.map((err, idx) => (
              <li key={idx} className="text-sm text-amber-900">
                <span className="font-mono font-semibold">{err.phoneme}</span> — Error{" "}
                {err.count} time{err.count > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
