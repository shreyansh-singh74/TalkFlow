"use client";

import { useCallback, useState } from "react";
import { getBackendUrl } from "@/lib/backend-config";

export interface PhonemeSegment {
  phoneme: string;
  expected: string;
  actual: string;
  accuracy: number;
  is_correct: boolean;
  feedback?: string | null;
  suggestions?: string[] | null;
}

export interface WordPhonemeAnalysis {
  word: string;
  expected_ipa: string;
  expected_phonemes: string[];
  actual_phonemes: string[];
  segments: PhonemeSegment[];
  word_accuracy: number;
  phoneme_matches: number;
  total_phonemes: number;
  suggestions: string[];
}

export interface PhonemeErrorCount {
  phoneme: string;
  count: number;
}

export interface SentencePhonemeAnalysis {
  sentence: string;
  words: WordPhonemeAnalysis[];
  overall_accuracy: number;
  problematic_phonemes: string[];
  mastered_phonemes: string[];
  most_common_errors: PhonemeErrorCount[];
}

export interface PhonemeCompareResult {
  expected: string;
  actual: string;
  expected_ipa: string;
  actual_ipa: string;
  accuracy_score: number;
  segments: PhonemeSegment[];
}

export interface IpaResult {
  word: string;
  ipa: string;
  phonemes: string[];
}

interface PhonemeAnalysisState {
  data: SentencePhonemeAnalysis | null;
  loading: boolean;
  error: string | null;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function usePhonemeAnalysis() {
  const [state, setState] = useState<PhonemeAnalysisState>({
    data: null,
    loading: false,
    error: null,
  });

  const analyzeSentence = useCallback(
    async (sentence: string, userTranscript?: string) => {
      setState({ data: null, loading: true, error: null });
      try {
        const response = await postJson<SentencePhonemeAnalysis>(
          `${getBackendUrl()}/api/phonemes/analyze`,
          { sentence, user_transcript: userTranscript ?? null },
        );
        setState({ data: response, loading: false, error: null });
        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to analyze phonemes";
        setState({ data: null, loading: false, error: message });
        throw error;
      }
    },
    [],
  );

  const analyzeWord = useCallback(
    async (word: string, userTranscript?: string) => {
      setState({ data: null, loading: true, error: null });
      try {
        const response = await postJson<WordPhonemeAnalysis>(
          `${getBackendUrl()}/api/phonemes/analyze-word`,
          { word, user_transcript: userTranscript ?? null },
        );
        const sentenceAnalysis: SentencePhonemeAnalysis = {
          sentence: word,
          words: [response],
          overall_accuracy: response.word_accuracy,
          problematic_phonemes: [],
          mastered_phonemes: [],
          most_common_errors: [],
        };
        setState({ data: sentenceAnalysis, loading: false, error: null });
        return sentenceAnalysis;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to analyze word";
        setState({ data: null, loading: false, error: message });
        throw error;
      }
    },
    [],
  );

  const getIPA = useCallback(async (word: string) => {
    return getJson<IpaResult>(
      `${getBackendUrl()}/api/phonemes/ipa/${encodeURIComponent(word)}`,
    );
  }, []);

  const comparePhonemes = useCallback(async (expected: string, actual: string) => {
    return postJson<PhonemeCompareResult>(
      `${getBackendUrl()}/api/phonemes/compare`,
      { expected, actual },
    );
  }, []);

  const setAnalysis = useCallback((analysis: SentencePhonemeAnalysis | null) => {
    setState({ data: analysis, loading: false, error: null });
  }, []);

  const clear = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    analyzeSentence,
    analyzeWord,
    getIPA,
    comparePhonemes,
    setAnalysis,
    clear,
  };
}

export function getAccuracyColorClass(accuracy: number): string {
  if (accuracy >= 80) return "text-green-600";
  if (accuracy >= 60) return "text-yellow-600";
  return "text-red-600";
}

export function getAccuracyBadgeClass(accuracy: number): string {
  if (accuracy >= 80) return "bg-green-100 text-green-800";
  if (accuracy >= 60) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}
