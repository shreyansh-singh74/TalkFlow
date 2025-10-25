"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { usePersistentAudioStream } from "./use-persistent-audio-stream";
import {
  CircularAudioBuffer,
  RollingAverage,
  concatenateAudioBuffers,
  calculateAudioLevel,
} from "@/utils/audio-buffer-utils";

export interface TranscriptEntry {
  id: string;
  text: string;
  reply?: string;
  timestamp: Date;
}

export interface UseEnhancedAutoTranscriptionOptions {
  backendUrl?: string;
  // Speech Detection
  speechThreshold?: number; // Volume level (0-255)
  minSpeechFrames?: number; // Consecutive frames to confirm speech
  // Silence Detection (Adaptive)
  shortPauseMs?: number; // Ignore (user thinking)
  mediumPauseMs?: number; // Likely end of utterance
  longPauseMs?: number; // Definite end
  // Buffering
  preSpeechBufferMs?: number; // Capture before speech
  postSpeechBufferMs?: number; // Capture after speech ends
  // Quality
  smoothingWindowMs?: number; // Rolling average for stability
  minRecordingDurationMs?: number; // Ignore very short utterances
}

export interface UseEnhancedAutoTranscriptionReturn {
  isActive: boolean;
  isUserSpeaking: boolean;
  isProcessing: boolean;
  isAISpeaking: boolean;
  transcripts: TranscriptEntry[];
  error: string | null;
  currentAudioLevel: number;
  speechThreshold: number;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearTranscripts: () => void;
}

// State machine states
enum ListeningState {
  IDLE = "IDLE",
  LISTENING = "LISTENING", // Monitoring audio levels
  BUFFERING = "BUFFERING", // Speech detected, preparing to record
  RECORDING = "RECORDING", // Active speech capture
  WAITING = "WAITING", // Grace period after silence
  PROCESSING = "PROCESSING", // Sending to backend
}

export function useEnhancedAutoTranscription(
  options: UseEnhancedAutoTranscriptionOptions = {}
): UseEnhancedAutoTranscriptionReturn {
  const {
    backendUrl = typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      : "http://localhost:8000",
    speechThreshold = 22,              // MUCH lower (was 35)
    minSpeechFrames = 2,               // Faster detection (was 3)
    shortPauseMs = 500,
    mediumPauseMs = 2500,              // More patience (was 1500)
    longPauseMs = 3000,
    preSpeechBufferMs = 400,           // Longer pre-buffer (was 300)
    postSpeechBufferMs = 200,
    smoothingWindowMs = 100,           // Less smoothing (was 200)
    minRecordingDurationMs = 600,      // Shorter minimum (was 800)
  } = options;

  // Use persistent audio stream
  const {
    stream,
    isActive: streamActive,
    error: streamError,
    startStream,
    stopStream,
  } = usePersistentAudioStream();

  const [state, setState] = useState<ListeningState>(ListeningState.IDLE);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentAudioLevel, setCurrentAudioLevel] = useState(0);

  // Audio processing refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  // Buffer refs
  const preSpeechBufferRef = useRef<CircularAudioBuffer | null>(null);
  const rollingAverageRef = useRef<RollingAverage | null>(null);

  // State tracking refs
  const speechFrameCountRef = useRef(0);
  const silenceFrameCountRef = useRef(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationIdRef = useRef<string>(Date.now().toString());
  const turnNumberRef = useRef<number>(0);

  /**
   * Play audio from base64
   */
  const playAudio = useCallback((audioBase64: string) => {
    try {
      console.log("🔊 Playing AI audio response...");

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsAISpeaking(true);
        console.log("🔊 AI speaking...");
      };

      audio.onended = () => {
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        console.log("✅ AI finished speaking");
      };

      audio.onerror = (e) => {
        setIsAISpeaking(false);
        console.error("❌ Audio playback error:", e);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.play().catch((err) => {
        console.error("❌ Failed to play audio:", err);
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
      });
    } catch (err) {
      console.error("❌ Error playing audio:", err);
      setIsAISpeaking(false);
    }
  }, []);

  /**
   * Start recording with pre-speech buffer
   */
  const startRecording = useCallback(() => {
    if (!stream) {
      console.error("❌ No stream available for recording");
      return;
    }

    console.log("🎙️ Starting recording with pre-speech buffer");

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Capture every 100ms
      setState(ListeningState.RECORDING);
      console.log("✅ Recording started");
    } catch (err) {
      console.error("❌ Failed to start recording:", err);
      setState(ListeningState.LISTENING);
    }
  }, [stream]);

  /**
   * Stop recording and send to backend
   */
  const stopRecordingAndSend = useCallback(async () => {
    if (!mediaRecorderRef.current) {
      console.log("⏸️ No active recording to stop");
      setState(ListeningState.LISTENING);
      return;
    }

    const recordingDuration = Date.now() - recordingStartTimeRef.current;
    
    // Ignore very short recordings (likely false positives)
    if (recordingDuration < minRecordingDurationMs) {
      console.log(`⏸️ Recording too short (${recordingDuration}ms), ignoring`);
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      setState(ListeningState.LISTENING);
      return;
    }

    console.log(`🛑 Stopping recording (${recordingDuration}ms)`);

    setState(ListeningState.PROCESSING);
    setIsProcessing(true);

    // Stop the MediaRecorder
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    // Wait for final chunks
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      if (recordedChunksRef.current.length === 0) {
        console.warn("⚠️ No audio chunks recorded");
        setState(ListeningState.LISTENING);
        setIsProcessing(false);
        return;
      }

      const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
      console.log(`📤 Sending ${blob.size} bytes to backend`);

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("conversation_id", conversationIdRef.current);
      formData.append("turn_number", turnNumberRef.current.toString());

      const response = await fetch(`${backendUrl}/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Transcription response:", data);

      if (data.success && data.transcript) {
        const newTranscript: TranscriptEntry = {
          id: Date.now().toString(),
          text: data.transcript,
          reply: data.reply || undefined,
          timestamp: new Date(),
        };
        setTranscripts((prev) => [...prev, newTranscript]);
        turnNumberRef.current += 1;

        if (data.audio) {
          playAudio(data.audio);
        }
      } else if (data.error && data.error !== "No speech detected") {
        setError(data.error);
      }
    } catch (err) {
      console.error("❌ Upload error:", err);
      setError(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      recordedChunksRef.current = [];
      mediaRecorderRef.current = null;
      setIsProcessing(false);
      setState(ListeningState.LISTENING);
    }
  }, [backendUrl, minRecordingDurationMs, playAudio]);

  /**
   * Monitor audio levels and manage state machine
   */
  const monitorAudioLevels = useCallback(() => {
    if (!analyserRef.current || state === ListeningState.IDLE) {
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let frameCount = 0;

    const checkAudioLevel = () => {
      if (state === ListeningState.IDLE || state === ListeningState.PROCESSING) {
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      const rawLevel = calculateAudioLevel(dataArray);

      // Apply rolling average for smoothing
      const smoothedLevel = rollingAverageRef.current?.add(rawLevel) ?? rawLevel;
      setCurrentAudioLevel(smoothedLevel);

      // Log periodically
      if (frameCount % 60 === 0) {
        console.log(
          `🎚️ Audio: ${smoothedLevel.toFixed(1)} | Threshold: ${speechThreshold} | State: ${state}`
        );
      }
      frameCount++;

      // State machine logic with hysteresis
      if (state === ListeningState.LISTENING) {
        // SPEECH START: Use lower threshold (more sensitive)
        const speechStartThreshold = speechThreshold * 0.7; // 30% lower for easier start
        const isSpeech = smoothedLevel > speechStartThreshold;
        
        if (isSpeech) {
          speechFrameCountRef.current++;
          if (speechFrameCountRef.current >= minSpeechFrames) {
            console.log(`🎤 SPEECH START: ${smoothedLevel.toFixed(1)} > ${speechStartThreshold.toFixed(1)}`);
            setState(ListeningState.BUFFERING);
            setIsUserSpeaking(true);
            speechFrameCountRef.current = 0;
            silenceFrameCountRef.current = 0;
            startRecording();
          }
        } else {
          speechFrameCountRef.current = 0;
          // Keep filling pre-speech buffer
          // (handled by ScriptProcessorNode)
        }
      } else if (
        state === ListeningState.RECORDING ||
        state === ListeningState.WAITING
      ) {
        // SPEECH END: Use higher threshold + require sustained silence
        const speechEndThreshold = speechThreshold * 1.2; // 20% higher (hysteresis)
        const isSilence = smoothedLevel < speechEndThreshold;
        
        if (!isSilence) {
          // Still speaking, reset counters
          speechFrameCountRef.current++;
          silenceFrameCountRef.current = 0;

          if (state === ListeningState.WAITING) {
            console.log("🔄 Speech resumed, back to RECORDING");
            setState(ListeningState.RECORDING);
            setIsUserSpeaking(true);
          }

          // Clear any silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          // Silence detected
          silenceFrameCountRef.current++;
          speechFrameCountRef.current = 0;

          // Require sustained silence before transitioning
          const MIN_SILENCE_FRAMES = Math.floor(1000 / 16.67); // 1 second of silence at 60fps
          
          if (state === ListeningState.RECORDING && silenceFrameCountRef.current >= MIN_SILENCE_FRAMES) {
            console.log(`🔇 SUSTAINED SILENCE: ${silenceFrameCountRef.current} frames (${smoothedLevel.toFixed(1)} < ${speechEndThreshold.toFixed(1)})`);
            setState(ListeningState.WAITING);
            setIsUserSpeaking(false);

            // Start adaptive silence timer
            const silenceDuration = mediumPauseMs;

            silenceTimerRef.current = setTimeout(() => {
              console.log("⏰ Silence timeout reached, sending audio");
              stopRecordingAndSend();
              silenceTimerRef.current = null;
            }, silenceDuration);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }, [
    state,
    speechThreshold,
    minSpeechFrames,
    mediumPauseMs,
    startRecording,
    stopRecordingAndSend,
  ]);

  /**
   * Setup audio analysis when stream is available
   */
  useEffect(() => {
    if (!stream || state === ListeningState.IDLE) {
      return;
    }

    console.log("🔧 Setting up audio analysis pipeline");

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      analyserRef.current = analyser;

      // Initialize buffers
      const sampleRate = 16000;
      preSpeechBufferRef.current = new CircularAudioBuffer(
        sampleRate,
        preSpeechBufferMs
      );
      rollingAverageRef.current = new RollingAverage(5); // ~83ms window at 60fps (less smoothing)

      // Create script processor for pre-speech buffering
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        // Always fill the pre-speech buffer
        preSpeechBufferRef.current?.write(inputData);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log("✅ Audio analysis pipeline ready");

      // Start monitoring
      monitorAudioLevels();
    } catch (err) {
      console.error("❌ Failed to setup audio analysis:", err);
      setError("Failed to setup audio monitoring");
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, state, preSpeechBufferMs, monitorAudioLevels]);

  /**
   * Start listening
   */
  const startListening = useCallback(async () => {
    console.log("\n========================================");
    console.log("🎬 STARTING ENHANCED AUTO-TRANSCRIPTION");
    console.log("========================================\n");

    setError(null);
    conversationIdRef.current = Date.now().toString();
    turnNumberRef.current = 0;

    await startStream();
    setState(ListeningState.LISTENING);
    speechFrameCountRef.current = 0;
    silenceFrameCountRef.current = 0;

    console.log("✅ Enhanced listening started");
  }, [startStream]);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    console.log("\n========================================");
    console.log("🛑 STOPPING ENHANCED AUTO-TRANSCRIPTION");
    console.log("========================================\n");

    setState(ListeningState.IDLE);
    setIsUserSpeaking(false);

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsAISpeaking(false);
    }

    stopStream();

    preSpeechBufferRef.current?.clear();
    rollingAverageRef.current?.reset();
    recordedChunksRef.current = [];

    console.log("✅ Enhanced listening stopped");
  }, [stopStream]);

  /**
   * Clear transcripts
   */
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setError(null);
    conversationIdRef.current = Date.now().toString();
    turnNumberRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsAISpeaking(false);
    }
  }, []);

  // Sync error from persistent stream
  useEffect(() => {
    if (streamError) {
      setError(streamError);
    }
  }, [streamError]);

  return {
    isActive: streamActive && state !== ListeningState.IDLE,
    isUserSpeaking,
    isProcessing,
    isAISpeaking,
    transcripts,
    error,
    currentAudioLevel,
    speechThreshold,
    startListening,
    stopListening,
    clearTranscripts,
  };
}

