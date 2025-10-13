"use client";

import { useCallback, useRef, useState } from "react";

export interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: Date;
}

export interface UseCallTranscriptionOptions {
  backendUrl?: string;
}

export interface UseCallTranscriptionReturn {
  recording: boolean;
  processing: boolean;
  transcripts: TranscriptEntry[];
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  clearTranscripts: () => void;
}

export function useCallTranscription(
  options: UseCallTranscriptionOptions = {}
): UseCallTranscriptionReturn {
  const {
    backendUrl = typeof window !== "undefined" 
      ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      : "http://localhost:8000"
  } = options;

  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: "audio/webm;codecs=opus" 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setRecording(true);
      console.log("Transcription recording started");
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !recording) return;
    
    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        try {
          setProcessing(true);
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          console.log(`Recording stopped, blob size: ${blob.size} bytes`);
          
          // Upload and transcribe
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const response = await fetch(`${backendUrl}/transcribe`, {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();
          console.log("Transcription response:", data);

          if (data.success && data.transcript) {
            // Add new transcript to history
            const newTranscript: TranscriptEntry = {
              id: Date.now().toString(),
              text: data.transcript,
              timestamp: new Date(),
            };
            setTranscripts((prev) => [...prev, newTranscript]);
            setError(null);
          } else {
            setError(data.error || "Transcription failed");
          }
        } catch (err) {
          console.error("Upload error:", err);
          setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
          setProcessing(false);
          setRecording(false);
          resolve();
        }
      };
      
      mediaRecorderRef.current!.stop();
      
      // Stop all tracks to release microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    });
  }, [recording, backendUrl]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setError(null);
  }, []);

  return {
    recording,
    processing,
    transcripts,
    error,
    startRecording,
    stopRecording,
    clearTranscripts,
  };
}

