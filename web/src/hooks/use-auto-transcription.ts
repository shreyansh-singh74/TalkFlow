"use client";

import { useCallback, useRef, useState, useEffect } from "react";

export interface TranscriptEntry {
  id: string;
  text: string;
  reply?: string;
  timestamp: Date;
}

export interface UseAutoTranscriptionOptions {
  backendUrl?: string;
  silenceThreshold?: number;  // Audio level below this is considered silence (0-255)
  silenceDuration?: number;    // Milliseconds of silence before auto-sending
}

export interface UseAutoTranscriptionReturn {
  isActive: boolean;
  isUserSpeaking: boolean;
  isProcessing: boolean;
  isAISpeaking: boolean;
  transcripts: TranscriptEntry[];
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  clearTranscripts: () => void;
}

export function useAutoTranscription(
  options: UseAutoTranscriptionOptions = {}
): UseAutoTranscriptionReturn {
  const {
    backendUrl = typeof window !== "undefined" 
      ? process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      : "http://localhost:8000",
    silenceThreshold = 30,      // Adjust sensitivity (lower = more sensitive)
    silenceDuration = 1000,     // 1 second of silence
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef(false);
  const hasSpokenRef = useRef(false);  // Track if user has spoken in current session
  const isRecordingRef = useRef(false); // Track if currently recording

  // Play audio from base64
  const playAudio = useCallback((audioBase64: string) => {
    try {
      console.log("🔊 Preparing to play AI audio response...");
      
      if (audioRef.current) {
        console.log("⏸️ Pausing previous audio");
        audioRef.current.pause();
        audioRef.current = null;
      }

      console.log("🔄 Decoding base64 audio...");
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      console.log(`✅ Audio blob created: ${blob.size} bytes`);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => { 
        setIsAISpeaking(true);
        console.log("🔊 ▶️ AI SPEAKING...");
      };

      audio.onended = () => {
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        console.log("✅ 🎙️ AI FINISHED SPEAKING");
      };

      audio.onerror = (e) => {
        setIsAISpeaking(false);
        console.error("❌ Audio playback error:", e);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      console.log("▶️ Starting audio playback...");
      audio.play().catch(err => {
        console.error("❌ Failed to play audio:", err);
        setIsAISpeaking(false);
        URL.revokeObjectURL(audioUrl);
      });

    } catch (err) {
      console.error("❌ Error setting up audio playback:", err);
      setIsAISpeaking(false);
    }
  }, []);

  // Start recording when speech detected
  const startRecordingChunk = useCallback(() => {
    if (!streamRef.current) {
      console.error("❌ Cannot start recording: no stream available");
      return;
    }
    
    if (isRecordingRef.current) {
      console.log("⏸️ Already recording, skipping...");
      return;
    }

    console.log("🎙️ ▶️ STARTING RECORDING CHUNK");
    isRecordingRef.current = true;
    chunksRef.current = [];
    hasSpokenRef.current = true;

    const mediaRecorder = new MediaRecorder(streamRef.current, { 
      mimeType: "audio/webm;codecs=opus" 
    });
    
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
        console.log(`📊 Audio chunk received: ${event.data.size} bytes | Total chunks: ${chunksRef.current.length}`);
      }
    };

    mediaRecorder.onstart = () => {
      console.log("✅ MediaRecorder started successfully");
    };

    mediaRecorder.onstop = () => {
      console.log("⏹️ MediaRecorder stopped");
    };

    mediaRecorder.onerror = (event: any) => {
      console.error("❌ MediaRecorder error:", event.error);
    };

    try {
      mediaRecorder.start(100);
      console.log("✅ Recording started, capturing chunks every 100ms");
    } catch (err) {
      console.error("❌ Failed to start MediaRecorder:", err);
    }
  }, []);

  // Stop recording and send to backend
  const stopRecordingAndSend = useCallback(async () => {
    console.log(`\n🔍 Checking if should send: hasSpoken=${hasSpokenRef.current}, isProcessing=${isProcessingRef.current}, isRecording=${isRecordingRef.current}`);
    
    if (!hasSpokenRef.current) {
      console.log("⏸️ Skipping send - user hasn't spoken yet");
      return;
    }
    
    if (isProcessingRef.current) {
      console.log("⏸️ Skipping send - already processing previous request");
      return;
    }
    
    if (!isRecordingRef.current) {
      console.log("⏸️ Skipping send - not currently recording");
      return;
    }

    console.log("🛑 ⏹️ STOPPING RECORDING & SENDING TO BACKEND");
    isRecordingRef.current = false;

    // Stop the recording to get a complete WebM file
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log("⏹️ Stopping MediaRecorder...");
      mediaRecorderRef.current.stop();
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setError(null);

    // Wait for the final chunk
    console.log("⏳ Waiting 200ms for final audio chunk...");
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      if (chunksRef.current.length === 0) {
        console.warn("⚠️ No audio chunks collected!");
        return;
      }

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      console.log(`📤 Sending audio to backend: ${blob.size} bytes (${chunksRef.current.length} chunks)`);

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      console.log(`🌐 POST ${backendUrl}/transcribe`);
      const response = await fetch(`${backendUrl}/transcribe`, {
        method: "POST",
        body: formData,
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Backend error: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Transcription response:", data);

      if (data.success && data.transcript) {
        console.log(`📝 Transcript: "${data.transcript}"`);
        
        const newTranscript: TranscriptEntry = {
          id: Date.now().toString(),
          text: data.transcript,
          reply: data.reply || undefined,
          timestamp: new Date(),
        };
        setTranscripts((prev) => [...prev, newTranscript]);

        if (data.reply) {
          console.log(`💬 AI Reply: "${data.reply}"`);
        }

        if (data.audio) {
          console.log("🔊 Playing AI response audio...");
          playAudio(data.audio);
        } else {
          console.log("⚠️ No audio in response");
        }
      } else if (data.error) {
        console.warn(`⚠️ Backend returned error: ${data.error}`);
        if (data.error !== "No speech detected") {
          setError(data.error);
        }
      }
      
    } catch (err) {
      console.error("❌ Upload error:", err);
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      // Reset for next recording
      chunksRef.current = [];
      hasSpokenRef.current = false;
      setIsProcessing(false);
      isProcessingRef.current = false;
      
      console.log("✅ ✨ Ready for next speech segment!\n");
    }
  }, [backendUrl, playAudio]);

  // Monitor audio levels for silence detection
  const monitorAudioLevels = useCallback(() => {
    if (!analyserRef.current || !isActive) {
      console.log("⚠️ Cannot monitor: analyser or isActive not ready");
      return;
    }

    console.log("🎧 Audio monitoring started! Listening for speech...");
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let frameCount = 0;
    
    const checkAudioLevel = () => {
      if (!isActive) {
        console.log("🛑 Monitoring stopped (isActive = false)");
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      
      // Log audio level every 60 frames (~1 second) for debugging
      if (frameCount % 60 === 0) {
        console.log(`🎚️ Audio level: ${average.toFixed(2)} | Threshold: ${silenceThreshold} | Speaking: ${average > silenceThreshold}`);
      }
      frameCount++;
      
      const isSpeaking = average > silenceThreshold;

      if (isSpeaking) {
        // User is speaking
        if (!isUserSpeaking) {
          console.log(`🎤 SPEECH DETECTED! Audio level: ${average.toFixed(2)} > ${silenceThreshold}`);
          setIsUserSpeaking(true);
          
          // Start recording chunk if not already recording
          if (!isRecordingRef.current && !isProcessingRef.current) {
            console.log("🎙️ Starting recording for this speech segment...");
            startRecordingChunk();
          } else {
            console.log(`⏸️ Not starting recording: isRecording=${isRecordingRef.current}, isProcessing=${isProcessingRef.current}`);
          }
        }

        // Clear silence timer since user is still speaking
        if (silenceTimerRef.current) {
          console.log("🔄 User still speaking, clearing silence timer");
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        // Silence detected
        if (isUserSpeaking) {
          console.log(`🔇 SILENCE DETECTED! Audio level: ${average.toFixed(2)} <= ${silenceThreshold}`);
          setIsUserSpeaking(false);
        }

        // Start silence timer only if user has spoken and is currently recording
        if (!silenceTimerRef.current && hasSpokenRef.current && isRecordingRef.current && !isProcessingRef.current) {
          console.log(`⏱️ Starting ${silenceDuration}ms silence timer... (will send audio if silence continues)`);
          silenceTimerRef.current = setTimeout(() => {
            console.log("✅ ⏰ Silence duration reached! Sending audio to backend...");
            stopRecordingAndSend();
            silenceTimerRef.current = null;
          }, silenceDuration);
        }
      }

      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }, [isActive, isUserSpeaking, silenceThreshold, silenceDuration, startRecordingChunk, stopRecordingAndSend]);

  // Start listening
  const startListening = useCallback(async () => {
    try {
      console.log("\n========================================");
      console.log("🎬 STARTING AUTOMATIC TRANSCRIPTION");
      console.log("========================================\n");
      setError(null);
      
      // Get microphone access
      console.log("🎤 Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      console.log("✅ Microphone access granted");
      streamRef.current = stream;

      // Setup audio context for level monitoring
      console.log("🔧 Setting up audio analysis...");
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      analyserRef.current = analyser;
      console.log("✅ Audio analyser ready");

      // Don't start MediaRecorder here - it will start when speech is detected
      chunksRef.current = [];
      hasSpokenRef.current = false;
      isRecordingRef.current = false;
      
      console.log("🎯 Setting isActive = true (will trigger monitoring)");
      setIsActive(true);
      
      console.log("\n✅ ✨ AUTOMATIC TRANSCRIPTION STARTED!");
      console.log("💡 Speak naturally, and I'll automatically send your audio after 1s of silence\n");
      
    } catch (err) {
      console.error("❌ Error starting automatic transcription:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  }, []);

  // Stop listening
  const stopListening = useCallback(() => {
    console.log("\n========================================");
    console.log("🛑 STOPPING AUTOMATIC TRANSCRIPTION");
    console.log("========================================\n");
    
    console.log("⏹️ Setting isActive = false");
    setIsActive(false);
    setIsUserSpeaking(false);

    // Stop animation frame
    if (animationFrameRef.current) {
      console.log("🛑 Cancelling animation frame");
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Clear silence timer
    if (silenceTimerRef.current) {
      console.log("⏱️ Clearing silence timer");
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop media recorder if recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log("⏹️ Stopping MediaRecorder");
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Reset flags
    console.log("🔄 Resetting flags");
    hasSpokenRef.current = false;
    isRecordingRef.current = false;

    // Stop audio tracks
    if (streamRef.current) {
      console.log("🎤 Stopping microphone stream");
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      console.log("🔊 Closing audio context");
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop any playing audio
    if (audioRef.current) {
      console.log("🔇 Stopping AI audio playback");
      audioRef.current.pause();
      audioRef.current = null;
      setIsAISpeaking(false);
    }

    console.log("🧹 Cleaning up references");
    analyserRef.current = null;
    chunksRef.current = [];
    
    console.log("\n✅ ✨ AUTOMATIC TRANSCRIPTION STOPPED\n");
  }, []);

  // Start monitoring when active
  useEffect(() => {
    if (isActive) {
      console.log("🔔 isActive changed to true, starting audio monitoring...");
      monitorAudioLevels();
    } else {
      console.log("🔕 isActive changed to false, monitoring will stop");
    }
    
    return () => {
      if (animationFrameRef.current) {
        console.log("🧹 useEffect cleanup: cancelling animation frame");
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, monitorAudioLevels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsAISpeaking(false);
    }
  }, []);

  return {
    isActive,
    isUserSpeaking,
    isProcessing,
    isAISpeaking,
    transcripts,
    error,
    startListening,
    stopListening,
    clearTranscripts,
  };
}

