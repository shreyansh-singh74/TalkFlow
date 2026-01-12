"use client";

import { useEffect, useRef, useState } from "react";

export default function Page(): any {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const constraints = {
    audio: true,
    video: { width: 1280, height: 720 },
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.error("Error playing video: ", err);
      });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [stream]);

  async function getMedia() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(
        constraints
      );
      setStream(mediaStream);
      setError(null);
      console.log("Media stream obtained: ", mediaStream);
    } catch (err: any) {
      console.error("Error accessing media devices:", err);
      setError(err.message || "Failed to access camera/microphone");
      setStream(null);
    }
  }

  function stopMedia() {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
    }
  }

  return (
    <div className="text-white flex justify-center items-center">
      <h1>Recording Page</h1>
      {!stream && (
        <button
          onClick={getMedia}
          className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"
        >
          Request Camera & Microphone Access
        </button>
      )}
      {error && <p className="text-red-500">Error: {error}</p>}
      {stream && (
        <div>
          <div className="relative w-full max-w-4xl">
            <video
              ref={videoRef}
              className="w-full rounded-lg border-2 border-gray-700"
              autoPlay
              playsInline
              muted
            />
          </div>
          <button
            onClick={stopMedia}
            className="px-4 py-2 bg-red-500 rounded hover:bg-red-600"
          >
            Stop Camera & MicroPhone
          </button>
        </div>
      )}
    </div>
  );
}
