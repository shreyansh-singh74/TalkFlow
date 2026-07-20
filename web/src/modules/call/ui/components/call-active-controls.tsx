"use client";

import { Mic, MicOff, SkipForward, ArrowRight, ArrowLeft, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveWaveform } from "@/components/ui/live-waveform";

type UIState =
  | "Level Ready"
  | "Recording"
  | "Evaluating"
  | "Level Complete"
  | "Level Failed"
  | "Transitioning"
  | "Practice Complete";

interface CallActiveControlsProps {
  uiState: UIState;
  isConnected?: boolean;
  isMicEnabled: boolean;
  isTalking: boolean;
  micStream?: MediaStream | null;
  isTransitioning: boolean;
  isEvaluating: boolean;
  scoreDisplay: number | null;
  transcriptionError: string | null;
  conversationStatus: string;
  onMicPress: (e: React.PointerEvent) => void;
  onMicRelease: (e: React.PointerEvent) => void;
  onMobileTalkStart: () => void;
  onMobileTalkStop: () => void;
  onMicToggle: () => void;
  onSkip: () => void;
  onNextLevel: () => void;
  onPrevLevel?: () => void;
  canGoBack?: boolean;
  onCancelEvaluating?: () => void;
}

export function CallActiveControls({
  uiState,
  isConnected = true,
  isMicEnabled,
  isTalking,
  micStream,
  isTransitioning,
  isEvaluating,
  scoreDisplay,
  transcriptionError,
  conversationStatus,
  onMicPress,
  onMicRelease,
  onMobileTalkStart,
  onMobileTalkStop,
  onMicToggle,
  onSkip,
  onNextLevel,
  onPrevLevel,
  canGoBack = false,
  onCancelEvaluating,
}: CallActiveControlsProps) {
  const micDisabled = isTransitioning || isEvaluating || uiState === "Level Complete";

  return (
    <div className="control-bar relative z-20 shrink-0 px-4 pb-4 pt-3 sm:px-6">
      {/* Error banner */}
      {transcriptionError && (
        <div
          className="mb-3 mx-auto max-w-md rounded-lg px-3.5 py-2 text-center text-sm font-semibold bg-red-50 text-red-700 border border-red-200"
          role="alert"
        >
          {transcriptionError}
        </div>
      )}

      {/* Connection warning banner if offline */}
      {!isConnected && !transcriptionError && (
        <div
          className="mb-3 mx-auto max-w-md rounded-lg px-3.5 py-2 text-center text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center gap-2"
        >
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
          <span>Connecting to voice server... (Make sure FastAPI backend is running on port 8000)</span>
        </div>
      )}

      {/* State banner */}
      <div className="mb-3 flex justify-center">
        {uiState === "Transitioning" && (
          <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-neutral-600 bg-neutral-100 border border-neutral-200">
            <RotateCcw className="h-3.5 w-3.5 animate-spin text-neutral-500" />
            Loading next level...
          </div>
        )}

        {uiState === "Evaluating" && (
          <div className="flex items-center gap-3 rounded-full px-4 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span>Evaluating pronunciation...</span>
            </div>
            {onCancelEvaluating && (
              <button
                type="button"
                onClick={onCancelEvaluating}
                className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 hover:bg-amber-200 transition-all cursor-pointer"
                title="Cancel evaluation"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            )}
          </div>
        )}

        {uiState === "Level Complete" && (
          <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 shadow-2xs">
            🎉 Level Complete! (Score: {scoreDisplay}%)
          </div>
        )}

        {uiState === "Level Failed" && (
          <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 shadow-2xs">
            Score: {scoreDisplay}% — Goal: 95%
          </div>
        )}
      </div>

      {/* Main control row */}
      <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
        {/* Left Bottom: Back Level + Skip Level (in Yellow/Amber) */}
        <div className="flex-1 flex justify-start items-center gap-2">
          {canGoBack && onPrevLevel && (
            <button
              type="button"
              onClick={onPrevLevel}
              disabled={isTransitioning}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-all duration-150 active:scale-95 disabled:opacity-40 cursor-pointer shadow-2xs"
              title="Go to previous level"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back Level</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSkip}
            disabled={isTransitioning}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all duration-150 active:scale-95 disabled:opacity-40 cursor-pointer shadow-2xs bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
            title="Skip sentence"
          >
            <SkipForward className="h-3.5 w-3.5 text-amber-700" />
            <span>Skip Level</span>
          </button>
        </div>

        {/* Center: Live Audio Waveform + Mic */}
        <div className="flex items-center gap-2 sm:gap-4 justify-center">
          {/* Left Live Waveform canvas */}
          <div className="w-20 sm:w-28 h-10 flex items-center justify-end">
            <LiveWaveform
              active={isTalking}
              processing={isEvaluating || isTransitioning}
              stream={micStream}
              mode="static"
              height={36}
              barWidth={3}
              barGap={2}
              barRadius={1.5}
              barColor={isTalking ? "#059669" : isEvaluating ? "#3b82f6" : "#9ca3af"}
              fadeEdges={true}
              fadeWidth={12}
            />
          </div>

          {/* Mic button — desktop click or hold */}
          <div className="relative hidden lg:block">
            {isTalking && (
              <span
                className="mic-pulse-ring absolute inset-0 rounded-full"
                style={{ background: "#dc2626", opacity: 0.3 }}
              />
            )}
            <button
              type="button"
              onClick={() => {
                if (!isTalking) {
                  onMobileTalkStart();
                } else {
                  onMobileTalkStop();
                }
              }}
              onPointerDown={(e) => {
                onMicPress(e);
              }}
              onPointerUp={(e) => {
                onMicRelease(e);
              }}
              disabled={micDisabled || !isConnected}
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-md",
                isTalking ? "ring-4 ring-red-400" : isMicEnabled ? "shadow-[0_0_24px_rgba(5,150,105,0.3)]" : ""
              )}
              style={{
                background: isTalking
                  ? "#dc2626"
                  : isMicEnabled
                  ? "linear-gradient(135deg, #059669, #0d9488)"
                  : "#f5f5f5",
                border: isTalking
                  ? "2px solid #ef4444"
                  : isMicEnabled
                  ? "2px solid rgba(5,150,105,0.5)"
                  : "2px solid oklch(0.85 0 0)",
                color: isMicEnabled ? "#fff" : "oklch(0.4 0 0)",
              }}
              title={isTalking ? "Click to stop recording" : !isMicEnabled ? "Enable mic" : "Click mic or Hold SPACE to talk"}
            >
              {isTalking ? <MicOff className="h-7 w-7 text-white" /> : isMicEnabled ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
            </button>
          </div>

          {/* Mic button — mobile tap */}
          <div className="flex lg:hidden">
            {!isTalking ? (
              <button
                type="button"
                disabled={micDisabled || !isConnected}
                className="flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-40 cursor-pointer shadow-sm"
                style={{
                  background: "linear-gradient(135deg, #059669, #0d9488)",
                  color: "#fff",
                }}
                onClick={onMobileTalkStart}
              >
                <Mic className="h-6 w-6" />
              </button>
            ) : (
              <button
                type="button"
                className="flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-90 cursor-pointer shadow-sm"
                style={{
                  background: "#dc2626",
                  color: "#fff",
                }}
                onClick={onMobileTalkStop}
              >
                <MicOff className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Right Live Waveform canvas */}
          <div className="w-20 sm:w-28 h-10 flex items-center justify-start">
            <LiveWaveform
              active={isTalking}
              processing={isEvaluating || isTransitioning}
              stream={micStream}
              mode="static"
              height={36}
              barWidth={3}
              barGap={2}
              barRadius={1.5}
              barColor={isTalking ? "#059669" : isEvaluating ? "#3b82f6" : "#9ca3af"}
              fadeEdges={true}
              fadeWidth={12}
            />
          </div>
        </div>

        {/* Right Bottom: Next button */}
        <div className="flex-1 flex justify-end">
          <button
            type="button"
            onClick={onNextLevel}
            disabled={isTransitioning}
            className="flex items-center gap-1.5 rounded-full px-4.5 py-2 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-md bg-emerald-600 hover:bg-emerald-700"
            title="Next level"
          >
            <span>Next Level</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom hint row */}
      <div className="mt-2 flex items-center justify-center gap-3 text-[11px] font-medium text-neutral-500">
        <span className="hidden lg:inline">
          Click mic or Hold{" "}
          <kbd className="rounded px-1.5 py-0.5 font-mono text-[10px] bg-neutral-100 border border-neutral-300 text-neutral-700 font-semibold shadow-2xs">
            SPACE
          </kbd>
          {" "}to talk
        </span>
        <span className="text-neutral-300">·</span>
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold", isConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
          {isConnected ? "Voice Ready" : "Connecting..."}
        </span>
        <span className="text-neutral-300">·</span>
        <button
          type="button"
          onClick={onMicToggle}
          disabled={micDisabled}
          className="rounded-full px-2.5 py-0.5 transition-colors hover:bg-neutral-100 text-neutral-600 disabled:opacity-40 cursor-pointer border border-neutral-200"
        >
          {isMicEnabled ? "Mic on" : "Mic off"}
        </button>
        {conversationStatus && !isTalking && (
          <>
            <span className="text-neutral-300">·</span>
            <span className="text-neutral-500">{conversationStatus}</span>
          </>
        )}
      </div>
    </div>
  );
}
