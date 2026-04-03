// web/src/components/phoneme-feedback.tsx
"use client";

import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingUp,
} from "lucide-react";
import { PhonemeSegment, WordPhonemeAnalysis } from "@/hooks/use-phoneme-analysis";

interface PhonemeFeedbackProps {
  word: WordPhonemeAnalysis;
  className?: string;
}

export function PhonemeFeedback({
  word,
  className = "",
}: PhonemeFeedbackProps) {
  const hasErrors = word.segments.some((seg) => !seg.is_correct);

  if (!hasErrors) {
    return (
      <Alert className={`border-green-200 bg-green-50 ${className}`}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle>Excellent!</AlertTitle>
        <AlertDescription className="text-green-700">
          Great pronunciation of "{word.word}". Keep up the good work!
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {word.segments.map((segment, idx) => (
        segment.is_correct ? null : (
          <PhonemeErrorCard key={idx} segment={segment} word={word.word} />
        )
      ))}
    </div>
  );
}

interface PhonemeErrorCardProps {
  segment: PhonemeSegment;
  word: string;
}

function PhonemeErrorCard({ segment, word }: PhonemeErrorCardProps) {
  return (
    <Alert className="border-red-200 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertTitle className="text-red-900">
        Pronunciation Issue in "{word}"
      </AlertTitle>
      <AlertDescription className="text-red-800 space-y-2">
        <p>
          <span className="font-semibold">Expected:</span>{" "}
          <span className="font-mono text-lg">{segment.expected}</span>
        </p>
        {segment.actual && (
          <p>
            <span className="font-semibold">You said:</span>{" "}
            <span className="font-mono text-lg">{segment.actual}</span>
          </p>
        )}
        {segment.feedback && (
          <p>
            <span className="font-semibold">What it is:</span> {segment.feedback}
          </p>
        )}
        {segment.suggestions && segment.suggestions.length > 0 && (
          <div className="mt-2 p-2 bg-white rounded border border-red-200">
            <p className="font-semibold text-sm mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              {segment.suggestions.map((suggestion, idx) => (
                <li key={idx} className="text-sm">
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface PhonemeAccuracyIndicatorProps {
  accuracy: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PhonemeAccuracyIndicator({
  accuracy,
  showLabel = true,
  size = "md",
  className = "",
}: PhonemeAccuracyIndicatorProps) {
  const sizeClasses = {
    sm: "w-12 h-12 text-xs",
    md: "w-16 h-16 text-sm",
    lg: "w-20 h-20 text-base",
  };

  const color =
    accuracy >= 80
      ? "text-green-600"
      : accuracy >= 60
        ? "text-yellow-600"
        : "text-red-600";

  const bgColor =
    accuracy >= 80
      ? "bg-green-100"
      : accuracy >= 60
        ? "bg-yellow-100"
        : "bg-red-100";

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        className={`rounded-full flex items-center justify-center font-bold ${sizeClasses[size]} ${bgColor} ${color}`}
      >
        {Math.round(accuracy)}%
      </div>
      {showLabel && (
        <span className="text-xs text-gray-600 font-medium">Accuracy</span>
      )}
    </div>
  );
}

interface PhonemeProgressProps {
  current: number;
  target?: number;
  label?: string;
  className?: string;
}

export function PhonemeProgress({
  current,
  target = 100,
  label,
  className = "",
}: PhonemeProgressProps) {
  const percentage = (current / target) * 100;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <p className="text-sm font-medium text-gray-700">{label}</p>}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            percentage >= 80
              ? "bg-green-500"
              : percentage >= 60
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-600 text-right">
        {Math.round(percentage)}% ({current}/{target})
      </p>
    </div>
  );
}

interface PhonemeComparisonProps {
  expected: string;
  actual: string;
  ipaExpected: string;
  ipaActual: string;
  className?: string;
}

export function PhonemeComparison({
  expected,
  actual,
  ipaExpected,
  ipaActual,
  className = "",
}: PhonemeComparisonProps) {
  const isMatch = ipaExpected === ipaActual;

  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-xs text-gray-600 font-semibold mb-2">Expected</p>
        <p className="text-lg font-semibold mb-1">{expected}</p>
        <p className="text-sm text-gray-700 font-mono">/{ipaExpected}/</p>
      </Card>

      <Card className={`p-4 ${isMatch ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        <p className="text-xs text-gray-600 font-semibold mb-2">Your Pronunciation</p>
        <p className="text-lg font-semibold mb-1">{actual}</p>
        <p className="text-sm text-gray-700 font-mono">/{ipaActual}/</p>
      </Card>
    </div>
  );
}
