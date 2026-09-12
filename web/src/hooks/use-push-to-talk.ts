"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { AudioChunker } from "@/lib/audio-processing";
import { StreamingAudioPlayer } from "@/lib/streaming-audio-player";
import { getWebSocketUrl } from "@/lib/backend-config";
import { fetchVoiceToken } from "@/lib/voice-token";
import { SentencePhonemeAnalysis } from "@/types/pronunciation";
import type { PracticeTargetPayload, PronunciationResultPayload, SessionAnalysisReport } from "@/types/pronunciation";
import type { Difficulty, PracticeStep, SessionSource } from "@/types/practice";
import { v4 as uuidv4 } from "uuid";

/**
 * Shown only until the first PRACTICE_TARGET lands. The script decides the real
 * content — this is a placeholder for the connecting frame, not a fallback.
 */
const PLACEHOLDER_TARGET_TEXT = "Connecting…";

export interface TranscriptEntry {
  id: string;
  text: string;
  reply?: string;
  timestamp: Date;
  isPartial?: boolean;
}

export interface UsePushToTalkReturn {
  isConnected: boolean;
  isTalking: boolean;
  isAISpeaking: boolean;
  transcripts: TranscriptEntry[];
  partialTranscript: string;
  streamingAIText: string;
  conversationStatus: string;
  error: string | null;
  phonemeAnalysis: SentencePhonemeAnalysis | null;
  lastPronunciation: PronunciationResultPayload | null;
  targetText: string;
  practiceMode: "word" | "sentence";
  practiceSentence: string;
  practiceProgress: { current: number; total: number };
  /** Score the current step must reach to advance. Comes from the script. */
  passThreshold: number;
  /** Zero-based cursor into the script's steps. */
  stepIndex: number;
  /** Surrounding lines of a pasted text. Null for coach-backed sessions. */
  contextBefore: string | null;
  contextAfter: string | null;
  /** Segmenter hint for the current step, e.g. "continues in the next step". */
  stepNote: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  startTalking: () => void;
  stopTalking: () => void;
  clearTranscripts: () => void;
  sessionReport: SessionAnalysisReport | null;
  sendNextSentence: () => void;
  sendSkipSentence: () => void;
  sendPrevSentence: () => void;
  /**
   * Ask the server to summarise the session now. Sent when the learner leaves,
   * so an abandoned session still produces the report it earned instead of the
   * end-of-call screen promising one that never arrives.
   */
  finalizeSession: () => void;
  isTransitioning: boolean;
  restartSession: () => void;
  /** Set when the server refused to move on, e.g. the score was below the bar. */
  gateMessage: string | null;
  /**
   * The next step, held back until the learner is ready for it.
   *
   * When a pass advances the cursor the server sends the new step immediately,
   * but the learner is still reading the feedback they just earned. Holding it
   * here means the sentence they are looking at doesn't change under them.
   */
  pendingTarget: PracticeTargetPayload | null;
  /** Reveal the held-back step. */
  acceptPendingTarget: () => void;
  micStream?: MediaStream | null;
}

interface UsePushToTalkOptions {
  sessionId: string;
  coachName: string;
  coachInstructions: string;
  /**
   * The full script, resolved at session-creation time and persisted. The
   * backend engine executes this list verbatim — it picks no content of its
   * own, so an empty array means the session degrades to a generic bank.
   */
  steps: PracticeStep[];
  difficulty: Difficulty;
  source: SessionSource;
  passThreshold: number;
  accent?: string;
  topic?: string;
  /**
   * The learner's first language. Coaching hint only: the backend uses it to
   * bias which sounds the coach names. It never changes how a turn is scored.
   */
  l1?: string;
  /**
   * The learner's recorded consent to raw audio retention. The backend still
   * requires its own PERSIST_TURN_AUDIO switch; both must agree before a turn is
   * written to disk.
   */
  retainAudio?: boolean;
}

export function usePushToTalk({
  sessionId,
  coachName,
  coachInstructions,
  steps,
  difficulty,
  source,
  passThreshold: configuredThreshold,
  accent = "en-US",
  topic = "",
  l1 = "",
  retainAudio = false,
}: UsePushToTalkOptions): UsePushToTalkReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [streamingAIText, setStreamingAIText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phonemeAnalysis, setPhonemeAnalysis] = useState<SentencePhonemeAnalysis | null>(null);
  const [lastPronunciation, setLastPronunciation] =
    useState<PronunciationResultPayload | null>(null);
  const [targetText, setTargetText] = useState(PLACEHOLDER_TARGET_TEXT);
  const [practiceMode, setPracticeMode] = useState<"word" | "sentence">("sentence");
  const [practiceSentence, setPracticeSentence] = useState(PLACEHOLDER_TARGET_TEXT);
  const [practiceProgress, setPracticeProgress] = useState({
    current: 1,
    total: Math.max(1, steps.length),
  });
  const [passThreshold, setPassThreshold] = useState(configuredThreshold);
  const [stepIndex, setStepIndex] = useState(0);
  const [contextBefore, setContextBefore] = useState<string | null>(null);
  const [contextAfter, setContextAfter] = useState<string | null>(null);
  const [stepNote, setStepNote] = useState<string | null>(null);
  const [sessionReport, setSessionReport] = useState<SessionAnalysisReport | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<PracticeTargetPayload | null>(
    null
  );

  const targetTextRef = useRef(targetText);
  useEffect(() => {
    targetTextRef.current = targetText;
  }, [targetText]);

  /**
   * The config is rebuilt on every send rather than memoised, so a script that
   * loads after the socket opens is still picked up by `restartSession`.
   */
  const configRef = useRef({
    sessionId,
    coachName,
    coachInstructions,
    steps,
    difficulty,
    source,
    passThreshold: configuredThreshold,
    accent,
    topic,
    l1,
    retainAudio,
  });
  configRef.current = {
    sessionId,
    coachName,
    coachInstructions,
    steps,
    difficulty,
    source,
    passThreshold: configuredThreshold,
    accent,
    topic,
    l1,
    retainAudio,
  };

  const buildSessionConfig = useCallback(() => {
    const config = configRef.current;
    return {
      type: "SESSION_CONFIG",
      session_id: config.sessionId,
      coach_name: config.coachName,
      coach_instructions: config.coachInstructions,
      topic: config.topic,
      difficulty: config.difficulty,
      accent: config.accent,
      l1: config.l1 || null,
      retain_audio: config.retainAudio,
      pass_threshold: config.passThreshold,
      source: config.source,
      steps: config.steps.map((step) => ({
        index: step.index,
        text: step.text,
        note: step.note ?? null,
      })),
    };
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkerRef = useRef<AudioChunker | null>(null);
  const audioPlayerRef = useRef<StreamingAudioPlayer | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  // Ref-backed talking flag so startTalking/stopTalking closures are never stale.
  const isTalkingRef = useRef(false);
  
  /**
   * Handle incoming WebSocket messages
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case "PARTIAL_TRANSCRIPT":
        setPartialTranscript(message.text);
        break;
        
      case "FINAL_TRANSCRIPT":
        setPartialTranscript("");
        setTranscripts(prev => [
          ...prev,
          {
            id: uuidv4(),
            text: message.text,
            timestamp: new Date(),
            isPartial: false
          }
        ]);
        break;
        
      case "LLM_TEXT_CHUNK":
        setStreamingAIText(prev => prev + message.text);
        break;
        
      case "AI_RESPONSE":
        setStreamingAIText(""); // Clear streaming text
        setTranscripts(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last) {
            last.reply = message.text;
          }
          return updated;
        });
        // Don't set isAISpeaking here - wait for first TTS chunk
        break;

      // There is no PHONEME_ANALYSIS case: the backend has never emitted that
      // message. `SentencePhonemeAnalysis` is still the shape /api/phonemes/*
      // returns for the HTTP analysis endpoints.

      case "PRONUNCIATION_RESULT": {
        const p = message as PronunciationResultPayload;
        const normalizeForMatching = (text: string) => {
          return text.toLowerCase().replace(/[^a-z0-9]/g, "");
        };
        const cleanResultText = normalizeForMatching(p.target_text || "");
        const cleanCurrentText = normalizeForMatching(targetTextRef.current || "");
        if (cleanResultText !== cleanCurrentText) {
          console.warn("Ignored stale pronunciation result for target:", p.target_text);
          break;
        }
        setLastPronunciation(p);
        setPhonemeAnalysis(null);
        if (p.target_text) {
          setTargetText(p.target_text);
        }
        break;
      }

      case "PRACTICE_TARGET": {
        const target = message as PracticeTargetPayload;
        // A step reached by passing is held back one click, so the feedback for
        // the turn just scored stays on screen. A step reached by skipping or
        // navigating replaces what's on screen immediately.
        if (target.advanced_from_pass) {
          setPendingTarget(target);
          setGateMessage(null);
          setIsTransitioning(false);
          break;
        }
        setLastPronunciation(null);
        setPendingTarget(null);
        setGateMessage(target.gate_message ?? null);
        setTargetText(target.target_text);
        setPracticeMode(target.mode);
        setPracticeSentence(target.sentence || target.target_text);
        setPracticeProgress(target.progress || { current: 1, total: 1 });
        setStepIndex(target.step_index ?? 0);
        // The server is authoritative: it resolves the tier default when the
        // client sends no threshold, so trust its value over the prop.
        if (typeof target.pass_threshold === "number") {
          setPassThreshold(target.pass_threshold);
        }
        setContextBefore(target.context_before ?? null);
        setContextAfter(target.context_after ?? null);
        setStepNote(target.note ?? null);
        setIsTransitioning(false);
        break;
      }

      case "SESSION_COMPLETE": {
        setSessionReport(message.report);
        setIsTransitioning(false);
        break;
      }
        
      case "TTS_CHUNK":
        // Binary chunk will arrive separately
        // Set isAISpeaking when first TTS chunk arrives
        if (message.seq === 0) {
          setIsAISpeaking(true);
        }
        if (message.is_final) {
          // Keep isAISpeaking until audio finishes playing
          setTimeout(() => setIsAISpeaking(false), 1000);
        }
        break;
        
      case "ERROR":
        setError(message.message);
        break;
        
      case "PING":
        wsRef.current?.send(JSON.stringify({ type: "PONG" }));
        break;
    }
  }, []);
  
  /**
   * Connect to WebSocket
   */
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    try {
      // A fresh token per attempt: it is short-lived, and `connect` is also the
      // reconnect path, so a token fetched once at mount would expire mid-usage
      // and turn every retry into a rejected handshake.
      const token = await fetchVoiceToken(configRef.current.sessionId);
      const wsUrl = token
        ? `${getWebSocketUrl()}?token=${encodeURIComponent(token)}`
        : getWebSocketUrl();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify(buildSessionConfig()));
        // Pre-warm the mic stream so that getUserMedia permission is handled
        // before the user presses the button. This ensures startTalking on the
        // first press has no async gap before creating AudioContext.
        if (!streamRef.current) {
          navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
          }).then((stream) => {
            streamRef.current = stream;
          }).catch((err) => {
            console.warn('[usePushToTalk] mic pre-warm failed:', err);
          });
        }
      };
      
      ws.onmessage = async (event) => {
        if (typeof event.data === "string") {
          // JSON message
          const message = JSON.parse(event.data);
          handleMessage(message);
        } else if (event.data instanceof Blob) {
          // Binary TTS chunk
          const arrayBuffer = await event.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          await audioPlayerRef.current?.addChunk(uint8Array, false);
        }
      };
      
      ws.onerror = (error) => {
        void error;
        setError("Connection error");
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          setError(`Reconnecting in ${delay / 1000}s...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          setError("Connection lost. Please refresh.");
        }
      };
      
      // Initialize audio player
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new StreamingAudioPlayer();
      }
      
      // Keep-alive pong
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PONG" }));
        }
      }, 20000);
      
      ws.addEventListener("close", () => clearInterval(pingInterval));
      
    } catch (err) {
      void err;
      setError("Failed to connect");
    }
  }, [buildSessionConfig, handleMessage]);
  
  /**
   * Start talking (spacebar down)
   */
  const startTalking = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected");
      return;
    }
    
    // Use ref so this guard is never stale regardless of render cycle.
    if (isTalkingRef.current) {
      return;
    }
    
    try {
      // Stop any AI audio
      audioPlayerRef.current?.stop();
      setIsAISpeaking(false);
      
      // Send INTERRUPT if AI was speaking
      wsRef.current.send(JSON.stringify({ type: "INTERRUPT" }));
      
      // ── Get microphone stream ────────────────────────────────────────────
      // If we already have a stream from a previous turn, reuse it — this
      // avoids the async gap entirely and keeps us in the user-gesture stack.
      // On first call we must await, but subsequent calls are synchronous.
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      }
      
      // Generate turn ID
      currentTurnIdRef.current = uuidv4();
      
      // Send START_TURN
      wsRef.current.send(JSON.stringify({
        type: "START_TURN",
        turn_id: currentTurnIdRef.current,
        timestamp: Date.now()
      }));
      
      // Start chunking and sending audio.
      // AudioChunker creates an AudioContext and resumes it here.
      // On the first call this is after an await (getUserMedia), but the
      // browser still allows it because we're inside a user-gesture handler.
      // On subsequent calls streamRef is already set so there is no await
      // and we stay fully synchronous — context.resume() is guaranteed.
      chunkerRef.current = new AudioChunker(
        streamRef.current,
        (pcm16Chunk) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            // Send the exact bytes — buffer.slice creates a copy so the
            // data is not affected if the engine reuses the backing store.
            wsRef.current.send(
              pcm16Chunk.buffer.slice(
                pcm16Chunk.byteOffset,
                pcm16Chunk.byteOffset + pcm16Chunk.byteLength
              )
            );
          }
        },
        16000
      );
      
      setIsTalking(true);
      isTalkingRef.current = true;
      setError(null);
      
    } catch (err) {
      console.error('[startTalking] error:', err);
      setError(err instanceof Error && err.name === 'NotAllowedError'
        ? "Microphone access denied"
        : "Failed to start recording");
    }
  }, []);
  
  /**
   * Stop talking (spacebar up)
   */
  const stopTalking = useCallback(() => {
    if (!isTalkingRef.current) {
      return;
    }
    
    // Stop audio chunking
    chunkerRef.current?.stop();
    chunkerRef.current = null;
    
    // Send END_TURN
    if (wsRef.current?.readyState === WebSocket.OPEN && currentTurnIdRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "END_TURN",
        turn_id: currentTurnIdRef.current,
        timestamp: Date.now()
      }));
    }
    
    setIsTalking(false);
    isTalkingRef.current = false;
    currentTurnIdRef.current = null;
  }, []);
  
  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    chunkerRef.current?.stop();
    audioPlayerRef.current?.stop();
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsTalking(false);
    setIsAISpeaking(false);
  }, []);
  
  /**
   * Clear transcripts
   */
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setPartialTranscript("");
    setStreamingAIText("");
    setError(null);
    setPhonemeAnalysis(null);
    setLastPronunciation(null);
    setGateMessage(null);
  }, []);
  
  /**
   * Get current conversation status
   */
  const getConversationStatus = useCallback((): string => {
    if (!isConnected) return "";
    if (isAISpeaking) return "AI Speaking...";
    if (streamingAIText) return "Processing...";
    if (isTalking) return "Recording...";
    return "Hold SPACE to talk";
  }, [isConnected, isAISpeaking, streamingAIText, isTalking]);
  
  const acceptPendingTarget = useCallback(() => {
    setPendingTarget((target) => {
      if (target) {
        setLastPronunciation(null);
        setTargetText(target.target_text);
        setPracticeMode(target.mode);
        setPracticeSentence(target.sentence || target.target_text);
        setPracticeProgress(target.progress || { current: 1, total: 1 });
        setStepIndex(target.step_index ?? 0);
        setContextBefore(target.context_before ?? null);
        setContextAfter(target.context_after ?? null);
        setStepNote(target.note ?? null);
      }
      return null;
    });
  }, []);

  const sendNextSentence = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTransitioning(true);
      wsRef.current.send(JSON.stringify({ type: "NEXT_SENTENCE" }));
    }
  }, []);

  /**
   * Skip this step without passing it. The server records the step as skipped,
   * so the session report cannot claim a step was completed when it wasn't.
   */
  const sendSkipSentence = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTransitioning(true);
      wsRef.current.send(JSON.stringify({ type: "SKIP_SENTENCE" }));
    }
  }, []);

  const finalizeSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "FINALIZE_SESSION" }));
    }
  }, []);

  const sendPrevSentence = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsTransitioning(true);
      wsRef.current.send(JSON.stringify({ type: "PREV_SENTENCE" }));
    }
  }, []);

  const restartSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      clearTranscripts();
      setSessionReport(null);
      setStepIndex(0);
      setGateMessage(null);
      setPendingTarget(null);
      setIsTransitioning(true);
      wsRef.current.send(JSON.stringify(buildSessionConfig()));
    }
  }, [buildSessionConfig, clearTranscripts]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    isConnected,
    isTalking,
    isAISpeaking,
    transcripts,
    partialTranscript,
    streamingAIText,
    conversationStatus: getConversationStatus(),
    error,
    phonemeAnalysis,
    lastPronunciation,
    targetText,
    practiceMode,
    practiceSentence,
    practiceProgress,
    passThreshold,
    stepIndex,
    contextBefore,
    contextAfter,
    stepNote,
    connect,
    disconnect,
    startTalking,
    stopTalking,
    clearTranscripts,
    sessionReport,
    sendNextSentence,
    sendSkipSentence,
    sendPrevSentence,
    finalizeSession,
    isTransitioning,
    gateMessage,
    pendingTarget,
    acceptPendingTarget,
    restartSession,
    micStream: streamRef.current,
  };
}
