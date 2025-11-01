"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { AudioChunker } from "@/lib/audio-processing";
import { StreamingAudioPlayer } from "@/lib/streaming-audio-player";
import { v4 as uuidv4 } from "uuid";

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
  connect: () => Promise<void>;
  disconnect: () => void;
  startTalking: () => void;
  stopTalking: () => void;
  clearTranscripts: () => void;
}

export function usePushToTalk(
  backendUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL || "https://harmonious-heart-production.up.railway.app"
): UsePushToTalkReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [streamingAIText, setStreamingAIText] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkerRef = useRef<AudioChunker | null>(null);
  const audioPlayerRef = useRef<StreamingAudioPlayer | null>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
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
        console.error("Server error:", message.message);
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
      console.log("Already connected");
      return;
    }
    
    try {
      // Convert http:// to ws:// or https:// to wss://
      const wsUrl = backendUrl.replace(/^http/, "ws");
      console.log(`🔌 Connecting to ${wsUrl}/ws/voice`);
      
      const ws = new WebSocket(`${wsUrl}/ws/voice`);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
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
        console.error("❌ WebSocket error:", error);
        setError("Connection error");
      };
      
      ws.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        setIsConnected(false);
        
        // Auto-reconnect with exponential backoff
        if (reconnectAttemptsRef.current < 10) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms...`);
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
      console.error("Failed to connect:", err);
      setError("Failed to connect");
    }
  }, [backendUrl, handleMessage]);
  
  /**
   * Start talking (spacebar down)
   */
  const startTalking = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected");
      return;
    }
    
    if (isTalking) {
      return;
    }
    
    try {
      console.log("🎤 START TALKING");
      
      // Stop any AI audio
      audioPlayerRef.current?.stop();
      setIsAISpeaking(false);
      
      // Send INTERRUPT if AI was speaking
      wsRef.current.send(JSON.stringify({ type: "INTERRUPT" }));
      
      // Get microphone stream
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          }
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
      
      // Start chunking and sending audio
      chunkerRef.current = new AudioChunker(
        streamRef.current,
        (pcm16Chunk) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(pcm16Chunk.buffer);
          }
        },
        16000
      );
      
      setIsTalking(true);
      setError(null);
      
    } catch (err) {
      console.error("Failed to start talking:", err);
      setError("Microphone access denied");
    }
  }, [isTalking]);
  
  /**
   * Stop talking (spacebar up)
   */
  const stopTalking = useCallback(() => {
    if (!isTalking) {
      return;
    }
    
    console.log("🛑 STOP TALKING");
    
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
    currentTurnIdRef.current = null;
  }, [isTalking]);
  
  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    console.log("🔌 Disconnecting");
    
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
    connect,
    disconnect,
    startTalking,
    stopTalking,
    clearTranscripts
  };
}

