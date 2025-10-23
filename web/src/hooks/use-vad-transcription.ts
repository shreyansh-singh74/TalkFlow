"use client";

import { useCallback, useRef, useState } from "react";
import { useMicVAD } from "@ricky0123/vad-react";

export interface TranscriptEntry {
  id: string;
  text: string;
  reply?: string;  // AI response
  timestamp: Date;
}

export interface UseVADTranscriptionOptions {
  backendUrl?: string;
}

export interface UseVADTranscriptionReturn {
  micActive: boolean;
  isUserSpeaking: boolean;
  isProcessing: boolean;
  isAISpeaking: boolean;
  transcripts: TranscriptEntry[];
  error: string | null;
  vadLoading: boolean;
  startVAD: () => void;
  stopVAD: () => void;
  clearTranscripts: () => void;
}

export function useVADTranscription(
  options: UseVADTranscriptionOptions = {}
): UseVADTranscriptionReturn {
  const {
    backendUrl = typeof window !== "undefined" 
      ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      : "http://localhost:8000"
  } = options;

  const [micActive, setMicActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);

  // Play audio from base64 encoded string
  const playAudio = useCallback((audioBase64: string) => {
    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Convert base64 to blob
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      // Create and play audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsAISpeaking(true);
        console.log("AI speaking...");
      };

      audio.onended = () => {
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        console.log("AI finished speaking");
      };

      audio.onerror = (e) => {
        setIsAISpeaking(false);
        console.error("Audio playback error:", e);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.play().catch(err => {
        console.error("Failed to play audio:", err);
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
      });

    } catch (err) {
      console.error("Error playing audio:", err);
      setIsAISpeaking(false);
    }
  }, []);

  // Process audio chunk when VAD detects silence
  const processAudioChunk = useCallback(async (audioData: Float32Array) => {
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      console.log("⏸️ Already processing, skipping this chunk");
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    try {
      console.log("🔄 Processing audio chunk, size:", audioData.length, "samples");

      // Convert Float32Array to WAV blob
      const wavBlob = await convertToWav(audioData);
      
      console.log("📦 WAV blob created, size:", wavBlob.size, "bytes");
      
      if (wavBlob.size === 0) {
        console.log("⚠️ Empty audio chunk, skipping");
        return;
      }

      // Upload and transcribe
      const formData = new FormData();
      formData.append("audio", wavBlob, "recording.wav");

      console.log("📡 Sending to backend:", `${backendUrl}/transcribe`);
      
      const response = await fetch(`${backendUrl}/transcribe`, {
        method: "POST",
        body: formData,
      });

      console.log("📥 Response received, status:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Transcription response:", data);

      if (data.success && data.transcript) {
        // Add new transcript with AI reply to history
        const newTranscript: TranscriptEntry = {
          id: Date.now().toString(),
          text: data.transcript,
          reply: data.reply || undefined,
          timestamp: new Date(),
        };
        setTranscripts((prev) => [...prev, newTranscript]);
        
        // Log the AI reply if present
        if (data.reply) {
          console.log("AI Reply:", data.reply);
        }

        // Play audio if available
        if (data.audio) {
          console.log("Playing AI response audio");
          playAudio(data.audio);
        } else {
          console.log("No audio available in response");
        }
      } else {
        if (data.error && data.error !== "No speech detected") {
          setError(data.error || "Transcription failed");
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, [backendUrl, playAudio]);

  // Initialize VAD
  const vad = useMicVAD({
    startOnLoad: false,
    onSpeechStart: () => {
      console.log("🎤 VAD: Speech started - user is speaking");
      setIsUserSpeaking(true);
    },
    onSpeechEnd: (audio) => {
      console.log("🔇 VAD: Speech ended - silence detected, audio length:", audio.length);
      setIsUserSpeaking(false);
      if (audio && audio.length > 0) {
        console.log("📤 VAD: Processing audio chunk...");
        processAudioChunk(audio);
      } else {
        console.warn("⚠️ VAD: Audio chunk is empty, skipping");
      }
    },
    onVADMisfire: () => {
      console.log("⚡ VAD: Misfire detected (false positive)");
      setIsUserSpeaking(false);
    },
    positiveSpeechThreshold: 0.6,
    negativeSpeechThreshold: 0.35,
    redemptionFrames: 8,  // ~0.5 second of silence before considering speech ended
    minSpeechFrames: 3,   // Minimum frames to consider as speech
    preSpeechPadFrames: 1,
  });

  const startVAD = useCallback(() => {
    console.log("Starting VAD, loading status:", vad.loading, "userSpeaking:", vad.userSpeaking);
    setMicActive(true);
    setError(null);
    try {
      vad.start();
      console.log("VAD started successfully");
    } catch (err) {
      console.error("Error starting VAD:", err);
      setError("Failed to start voice detection. Please try again.");
      setMicActive(false);
    }
  }, [vad]);

  const stopVAD = useCallback(() => {
    console.log("Stopping VAD");
    setMicActive(false);
    setIsUserSpeaking(false);
    try {
      vad.pause();
      console.log("VAD stopped successfully");
    } catch (err) {
      console.error("Error stopping VAD:", err);
    }
    
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsAISpeaking(false);
    }
  }, [vad]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setError(null);
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsAISpeaking(false);
    }
  }, []);

  return {
    micActive,
    isUserSpeaking,
    isProcessing,
    isAISpeaking,
    transcripts,
    error,
    vadLoading: vad.loading,
    startVAD,
    stopVAD,
    clearTranscripts,
  };
}

// Helper function to convert Float32Array to WAV blob
async function convertToWav(audioData: Float32Array): Promise<Blob> {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  
  // Create WAV header
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);
  
  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(view, 8, 'WAVE');
  
  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);
  
  // Data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, audioData.length * 2, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

