"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Play, Square } from "lucide-react";

interface AudioRecorderProps {
  onTranscript?: (transcript: string) => void;
  onReply?: (reply: string) => void;
}

export default function AudioRecorder({ onTranscript, onReply }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  async function startRecording() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { 
        mimeType: "audio/webm;codecs=opus" 
      });
      
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      mr.start();
      setRecording(true);
      console.log("Recording started");
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current || !recording) return;
    
    return new Promise<void>((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        try {
          setProcessing(true);
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          console.log(`Recording stopped, blob size: ${blob.size} bytes`);
          
          await uploadAndProcess(blob);
        } catch (err) {
          console.error("Error processing recording:", err);
          setError("Error processing audio. Please try again.");
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
  }

  async function uploadAndProcess(audioBlob: Blob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");

    try {
      const response = await fetch(`${BACKEND_URL}/transcribe_and_reply`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response:", data);

      if (data.success) {
        setTranscript(data.transcript);
        setReply(data.reply);
        setError("");
        
        // Call callbacks if provided
        if (onTranscript) onTranscript(data.transcript);
        if (onReply) onReply(data.reply);
      } else {
        setError(data.error || "Processing failed");
        setTranscript(data.transcript || "");
        setReply(data.reply || "");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Audio Recorder
          </CardTitle>
          <CardDescription>
            Record your speech to get pronunciation feedback from AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <Button
              onClick={recording ? stopRecording : startRecording}
              disabled={processing}
              size="lg"
              className={`w-32 h-32 rounded-full ${
                recording 
                  ? "bg-red-500 hover:bg-red-600" 
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {processing ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
              ) : recording ? (
                <Square className="h-8 w-8" />
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </Button>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {processing 
                ? "Processing your audio..." 
                : recording 
                  ? "Recording... Click to stop" 
                  : "Click to start recording"
              }
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Transcript
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm bg-gray-50 p-3 rounded-md">{transcript}</p>
          </CardContent>
        </Card>
      )}

      {reply && (
        <Card>
          <CardHeader>
            <CardTitle>AI Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm bg-blue-50 p-3 rounded-md">
                {reply}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

