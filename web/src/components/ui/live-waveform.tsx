"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface LiveWaveformProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onError"> {
  active?: boolean;
  processing?: boolean;
  barWidth?: number;
  barHeight?: number;
  barGap?: number;
  barRadius?: number;
  barColor?: string;
  fadeEdges?: boolean;
  fadeWidth?: number;
  height?: string | number;
  sensitivity?: number;
  smoothingTimeConstant?: number;
  fftSize?: number;
  historySize?: number;
  updateRate?: number;
  mode?: "scrolling" | "static";
  onError?: (error: Error) => void;
  onStreamReady?: (stream: MediaStream) => void;
  onStreamEnd?: () => void;
  stream?: MediaStream | null;
}

export function LiveWaveform({
  active = false,
  processing = false,
  barWidth = 3,
  barHeight = 4,
  barGap = 2,
  barRadius = 1.5,
  barColor,
  fadeEdges = true,
  fadeWidth = 24,
  height = 64,
  sensitivity = 1.2,
  smoothingTimeConstant = 0.8,
  fftSize = 256,
  mode = "static",
  onError,
  onStreamReady,
  onStreamEnd,
  stream: externalStream,
  className,
  ...props
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const internalStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);

  // Setup Audio Context & Analyser
  useEffect(() => {
    let isSubscribed = true;

    async function initAudio() {
      if (!active) return;

      try {
        let streamToUse = externalStream || null;
        if (!streamToUse && !internalStreamRef.current) {
          try {
            streamToUse = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
            });
            internalStreamRef.current = streamToUse;
          } catch (micErr) {
            console.warn("[LiveWaveform] microphone access failed:", micErr);
          }
        }

        if (!isSubscribed || !streamToUse) return;
        onStreamReady?.(streamToUse);

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        let ctx = audioCtxRef.current;
        if (!ctx || ctx.state === "closed") {
          ctx = new AudioCtx();
          audioCtxRef.current = ctx;
        }
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const analyser = ctx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(streamToUse);
        source.connect(analyser);
      } catch (err) {
        if (isSubscribed) {
          onError?.(err instanceof Error ? err : new Error("Failed to initialize microphone"));
        }
      }
    }

    if (active) {
      void initAudio();
    } else {
      cleanupAudio();
    }

    function cleanupAudio() {
      if (internalStreamRef.current) {
        internalStreamRef.current.getTracks().forEach((track) => track.stop());
        internalStreamRef.current = null;
        onStreamEnd?.();
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
    }

    return () => {
      isSubscribed = false;
      cleanupAudio();
    };
  }, [active, externalStream, fftSize, smoothingTimeConstant, onError, onStreamReady, onStreamEnd]);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    function render() {
      if (!canvas || !ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const computedColor =
        barColor ||
        "#059669";

      const centerY = rect.height / 2;
      const totalBarSpace = barWidth + barGap;
      const numBars = Math.floor((rect.width - barGap) / totalBarSpace);

      if (active && analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute average volume for scrolling mode
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = (sum / bufferLength / 255) * sensitivity;

        if (mode === "scrolling") {
          historyRef.current.push(avg);
          if (historyRef.current.length > numBars) {
            historyRef.current.shift();
          }

          const barsToDraw = historyRef.current;
          const startX = rect.width - barsToDraw.length * totalBarSpace;

          barsToDraw.forEach((vol, i) => {
            const h = Math.max(barHeight, vol * rect.height * 0.85);
            const x = startX + i * totalBarSpace;
            const y = centerY - h / 2;

            drawRoundedBar(ctx, x, y, barWidth, h, barRadius, computedColor);
          });
        } else {
          // Static Mode - symmetric frequency bars
          const step = Math.floor(bufferLength / numBars) || 1;
          for (let i = 0; i < numBars; i++) {
            const index = Math.min(i * step, bufferLength - 1);
            const val = (dataArray[index] / 255) * sensitivity;
            const h = Math.max(barHeight, val * rect.height * 0.85);
            const x = i * totalBarSpace;
            const y = centerY - h / 2;

            drawRoundedBar(ctx, x, y, barWidth, h, barRadius, computedColor);
          }
        }
      } else if (processing) {
        // Fluid Processing Wave State
        phase += 0.08;
        for (let i = 0; i < numBars; i++) {
          const normX = i / numBars;
          const wave1 = Math.sin(normX * Math.PI * 4 + phase);
          const wave2 = Math.cos(normX * Math.PI * 2 - phase * 0.7);
          const amplitude = (wave1 * 0.5 + wave2 * 0.5) * 0.5 + 0.5;

          const h = Math.max(barHeight, amplitude * (rect.height * 0.65));
          const x = i * totalBarSpace;
          const y = centerY - h / 2;

          drawRoundedBar(ctx, x, y, barWidth, h, barRadius, computedColor, 0.9);
        }
      } else {
        // Idle State (subtle baseline bars)
        for (let i = 0; i < numBars; i++) {
          const x = i * totalBarSpace;
          const h = barHeight;
          const y = centerY - h / 2;

          drawRoundedBar(ctx, x, y, barWidth, h, barRadius, computedColor, 0.25);
        }
      }

      // Fade Edges gradient overlay
      if (fadeEdges && fadeWidth > 0) {
        const leftGrad = ctx.createLinearGradient(0, 0, fadeWidth, 0);
        leftGrad.addColorStop(0, "rgba(255,255,255,1)");
        leftGrad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, fadeWidth, rect.height);

        const rightGrad = ctx.createLinearGradient(rect.width - fadeWidth, 0, rect.width, 0);
        rightGrad.addColorStop(0, "rgba(255,255,255,0)");
        rightGrad.addColorStop(1, "rgba(255,255,255,1)");

        ctx.fillStyle = rightGrad;
        ctx.fillRect(rect.width - fadeWidth, 0, fadeWidth, rect.height);
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    }

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [active, processing, barWidth, barHeight, barGap, barRadius, barColor, fadeEdges, fadeWidth, mode, sensitivity]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden flex items-center justify-center", className)}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
      {...props}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}

function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  alpha = 1.0
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (r > 0 && ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.fill();
  ctx.restore();
}
