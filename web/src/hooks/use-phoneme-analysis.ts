// web/src/hooks/use-phoneme-analysis.ts
"use client";

import { useState, useCallback } from "react";
import { useApi } from "./use-api";

export interface PhonemeSegment {
  phoneme: string;
  expected: string;
  actual: string;
  accuracy: number;
  is_correct: boolean;
  feedback?: string;
  suggestions?: string[];
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

export interface SentencePhonemeAnalysis {
  sentence: string;
  words: WordPhonemeAnalysis[];
  overall_accuracy: number;
  problematic_phonemes: string[];
  mastered_phonemes: string[];
  most_common_errors: Array<[string, number]>;
}

export interface PhonemeAnalysisState {
  data: SentencePhonemeAnalysis | null;
  loading: boolean;
  error: string | null;
}

export function usePhonemeAnalysis() {
  const api = useApi();
  const [state, setState] = useState<PhonemeAnalysisState>({
    data: null,
    loading: false,
    error: null,
  });

  /**
   * Analyze phonemes in a sentence
   */
  const analyzeSentence = useCallback(
    async (sentence: string, userTranscript?: string) => {
      setState({ data: null, loading: true, error: null });
      
      try {
        const response = await api.post<SentencePhonemeAnalysis>(
          "/api/phonemes/analyze",
          {
            sentence,
            user_transcript: userTranscript,
          }
        );

        setState({ data: response, loading: false, error: null });
        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to analyze phonemes";
        setState({ data: null, loading: false, error: errorMessage });
        throw error;
      }
    },
    [api]
  );

  /**
   * Analyze a single word
   */
  const analyzeWord = useCallback(
    async (word: string, userTranscript?: string) => {
      setState({ data: null, loading: true, error: null });
      
      try {
        const params = new URLSearchParams();
        params.append("word", word);
        if (userTranscript) params.append("user_transcript", userTranscript);

        const response = await api.get<WordPhonemeAnalysis>(
          `/api/phonemes/analyze-word?${params}`
        );

        // Convert single word analysis to sentence format for consistency
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
        const errorMessage =
          error instanceof Error ? error.message : "Failed to analyze word";
        setState({ data: null, loading: false, error: errorMessage });
        throw error;
      }
    },
    [api]
  );

  /**
   * Get IPA representation of a word
   */
  const getIPA = useCallback(
    async (word: string) => {
      try {
        const response = await api.get<{
          word: string;
          ipa: string;
          phonemes: string[];
        }>(`/api/phonemes/ipa/${encodeURIComponent(word)}`);

        return response;
      } catch (error) {
        console.error("Failed to get IPA:", error);
        throw error;
      }
    },
    [api]
  );

  /**
   * Compare expected vs actual pronunciation
   */
  const comparePhonemes = useCallback(
    async (expected: string, actual: string) => {
      try {
        const params = new URLSearchParams();
        params.append("expected", expected);
        params.append("actual", actual);

        const response = await api.post(`/api/phonemes/compare?${params}`, {});

        return response;
      } catch (error) {
        console.error("Failed to compare phonemes:", error);
        throw error;
      }
    },
    [api]
  );

  /**
   * Clear analysis state
   */
  const clear = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  /**
   * Get accuracy percentage
   */
  const getAccuracyPercentage = useCallback(() => {
    if (!state.data) return 0;
    return Math.round(state.data.overall_accuracy * 100) / 100;
  }, [state.data]);

  /**
   * Get accuracy color based on score
   */
  const getAccuracyColor = useCallback((accuracy: number) => {
    if (accuracy >= 80) return "text-green-600";
    if (accuracy >= 60) return "text-yellow-600";
    return "text-red-600";
  }, []);

  /**
   * Get word accuracy color
   */
  const getWordAccuracyColor = useCallback((accuracy: number) => {
    if (accuracy >= 80) return "bg-green-100 text-green-800";
    if (accuracy >= 60) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  }, []);

  return {
    // State
    data: state.data,
    loading: state.loading,
    error: state.error,
    
    // Methods
    analyzeSentence,
    analyzeWord,
    getIPA,
    comparePhonemes,
    clear,
    
    // Utility methods
    getAccuracyPercentage,
    getAccuracyColor,
    getWordAccuracyColor,
  };
}
