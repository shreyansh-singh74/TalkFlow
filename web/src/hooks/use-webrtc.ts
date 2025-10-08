"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseWebRTCOptions {
  video?: boolean;
  audio?: boolean;
}

export interface UseWebRTCReturn {
  localStream: MediaStream | null;
  isCameraOn: boolean;
  isMicOn: boolean;
  isFetching: boolean;
  error: string | null;
  requestMedia: () => Promise<void>;
  attachLocalStream: (videoEl: HTMLVideoElement | null) => void;
  toggleCamera: () => void;
  toggleMic: () => void;
  stopAll: () => void;
}

export function useWebRTC(options: UseWebRTCOptions = {}): UseWebRTCReturn {
  const { video = true, audio = true } = options;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(!!video);
  const [isMicOn, setIsMicOn] = useState<boolean>(!!audio);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const constraints = useMemo<MediaStreamConstraints>(() => ({
    video: isCameraOn,
    audio: isMicOn,
  }), [isCameraOn, isMicOn]);

  const stopTracks = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((t) => {
      try { t.stop(); } catch { /* no-op */ }
    });
  }, []);

  const refreshStream = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    try {
      // Stop old stream first
      stopTracks(streamRef.current);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;
      setLocalStream(newStream);
      // Attach to element if present
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Play needs to be called in some browsers after setting srcObject
        await videoRef.current.play().catch(() => {/* ignore */});
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to get media";
      setError(message);
    } finally {
      setIsFetching(false);
    }
  }, [constraints, stopTracks]);

  // Do not auto-request on mount; require explicit user action
  useEffect(() => {
    return () => {
      stopTracks(streamRef.current);
    };
  }, [stopTracks]);

  // Do NOT re-request media on toggle; only (re)request when explicitly asked

  const requestMedia = useCallback(async () => {
    await refreshStream();
  }, [refreshStream]);

  const attachLocalStream = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && localStream) {
      el.srcObject = localStream;
      el.play().catch(() => {/* ignore */});
    }
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    setIsCameraOn((v) => {
      const next = !v;
      const stream = streamRef.current;
      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.enabled = next;
        });
      }
      return next;
    });
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicOn((v) => {
      const next = !v;
      const stream = streamRef.current;
      if (stream) {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = next;
        });
      }
      return next;
    });
  }, []);

  const stopAll = useCallback(() => {
    stopTracks(localStream);
    setLocalStream(null);
  }, [localStream, stopTracks]);

  return {
    localStream,
    isCameraOn,
    isMicOn,
    isFetching,
    error,
    requestMedia,
    attachLocalStream,
    toggleCamera,
    toggleMic,
    stopAll,
  };
}


