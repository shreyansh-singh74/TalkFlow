"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionType = typeof window extends never
  ? any
  : (typeof window & {
      webkitSpeechRecognition?: any;
      SpeechRecognition?: any;
    })["SpeechRecognition"];

interface UseSpeechToTextOptions {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  endpoint?: string; // FastAPI endpoint for final text submission
}

interface UseSpeechToTextReturn {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => Promise<{ response?: string; error?: string }>;
  lastResponse: string | null;
}

export function useSpeechToText(
  options: UseSpeechToTextOptions = {},
): UseSpeechToTextReturn {
  const {
    lang = "en-US",
    interimResults = true,
    continuous = true,
    endpoint = typeof window !== "undefined"
      ? `${window.location.origin.replace(/\/$/, "")}/api/respond`
      : "/api/respond",
  } = options;

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [listening, setListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = interimResults;
    rec.continuous = continuous;

    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript((prev) => {
        const merged = final ? `${prev} ${final}`.trim() : prev;
        return interim ? `${merged} ${interim}`.trim() : merged;
      });
    };

    rec.onerror = (e: any) => {
      setError(e?.error || "Speech recognition error");
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    setSupported(true);

    return () => {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        // @ts-ignore
        rec.abort?.();
        // @ts-ignore
        rec.stop?.();
      } catch (_) {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [lang, interimResults, continuous]);

  const start = useCallback(() => {
    setError(null);
    setLastResponse(null);
    if (!recognitionRef.current) return;
    setTranscript("");
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (e: any) {
      setError(e?.message || "Failed to start recognition");
    }
  }, []);

  const stop = useCallback(async () => {
    if (!recognitionRef.current) return { error: "Recognition not initialized" };
    try {
      recognitionRef.current.stop();
    } catch (_) {
      // ignore
    }
    setListening(false);

    const finalText = transcript.trim();
    if (!finalText) {
      return { error: "No speech recognized" };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalText }),
      });
      if (!res.ok) {
        const body = await res.text();
        setLastResponse(null);
        return { error: `Backend error: ${res.status} ${body}` };
      }
      const data = (await res.json()) as { response?: string };
      setLastResponse(data.response ?? null);
      return { response: data.response };
    } catch (e: any) {
      setLastResponse(null);
      return { error: e?.message || "Network error" };
    }
  }, [endpoint, transcript]);

  return { supported, listening, transcript, error, start, stop, lastResponse };
}


