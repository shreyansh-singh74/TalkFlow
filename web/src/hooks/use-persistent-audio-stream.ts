"use client";

import { useCallback, useRef, useState, useEffect } from "react";

/**
 * Audio constraints optimized for speech recognition
 * Note: Don't specify sampleRate - Firefox requires MediaStream and AudioContext
 * to have matching sample rates. We'll resample to 16kHz in the AudioChunker instead.
 */
const SPEECH_AUDIO_CONSTRAINTS: MediaTrackConstraints & {
  // Browser-specific and Chrome-specific audio constraints
  latency?: number;
  googEchoCancellation?: boolean;
  googNoiseSuppression?: boolean;
  googHighpassFilter?: boolean;
  googAutoGainControl?: boolean;
} = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // sampleRate omitted - use system default for Firefox compatibility
  channelCount: 1,
  latency: 0.01,
  googEchoCancellation: true,
  googNoiseSuppression: true,
  googHighpassFilter: true,
  googAutoGainControl: true,
};

export interface UsePersistentAudioStreamReturn {
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
  startStream: () => Promise<void>;
  stopStream: () => void;
  restartStream: () => Promise<void>;
}

/**
 * Manages a persistent audio stream that lives as long as needed
 * Unlike creating new streams for each recording, this keeps one stream alive
 * Similar to how Google Assistant maintains an open microphone
 */
export function usePersistentAudioStream(): UsePersistentAudioStreamReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

  /**
   * Start the persistent audio stream
   */
  const startStream = useCallback(async () => {
    // Prevent concurrent start attempts
    if (isStartingRef.current) {
      console.log("⏸️ Stream start already in progress");
      return;
    }

    if (streamRef.current) {
      console.log("⏸️ Stream already active");
      return;
    }

    isStartingRef.current = true;
    setError(null);

    try {
      console.log("🎤 Requesting persistent microphone stream...");
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: SPEECH_AUDIO_CONSTRAINTS,
      });

      console.log("✅ Microphone stream acquired:", {
        tracks: mediaStream.getTracks().length,
        active: mediaStream.active,
      });

      // Check if stream is still needed (user might have cancelled)
      if (!isStartingRef.current) {
        console.log("⏹️ Stream cancelled before activation");
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Set up track ended listener for error recovery
      mediaStream.getTracks().forEach((track) => {
        track.onended = () => {
          console.warn("⚠️ Audio track ended unexpectedly");
          setError("Microphone connection lost. Please restart.");
          setIsActive(false);
          streamRef.current = null;
          setStream(null);
        };
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
      
      console.log("✅ Persistent audio stream ready");
    } catch (err) {
      console.error("❌ Failed to start audio stream:", err);
      
      let errorMessage = "Could not access microphone.";
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          errorMessage = "Microphone access denied. Please allow microphone permissions.";
        } else if (err.name === "NotFoundError") {
          errorMessage = "No microphone found. Please connect a microphone.";
        } else if (err.name === "NotReadableError") {
          errorMessage = "Microphone is already in use by another application.";
        } else {
          errorMessage = `Microphone error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setIsActive(false);
      streamRef.current = null;
      setStream(null);
    } finally {
      isStartingRef.current = false;
    }
  }, []);

  /**
   * Stop the persistent audio stream
   */
  const stopStream = useCallback(() => {
    console.log("🛑 Stopping persistent audio stream");
    
    isStartingRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }

    setStream(null);
    setIsActive(false);
    setError(null);
    
    console.log("✅ Persistent audio stream stopped");
  }, []);

  /**
   * Restart the stream (useful for error recovery)
   */
  const restartStream = useCallback(async () => {
    console.log("🔄 Restarting persistent audio stream");
    stopStream();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Brief delay
    await startStream();
  }, [stopStream, startStream]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        console.log("🧹 Cleaning up persistent audio stream on unmount");
        streamRef.current.getTracks().forEach((track) => {
          track.onended = null;
          track.stop();
        });
      }
    };
  }, []);

  return {
    stream,
    isActive,
    error,
    startStream,
    stopStream,
    restartStream,
  };
}


