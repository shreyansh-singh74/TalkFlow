"use client";

import { Mic, MicOff, SkipForward, ArrowRight, ArrowLeft, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  isMicEnabled: boolean;
  isTalking: boolean;
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
  isMicEnabled,
  isTalking,
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

        {/* Center: Waveform + Mic */}
        <div className="flex items-center gap-3">
          {/* Left waveform */}
          <div className={cn("flex h-8 items-end gap-0.5", isTalking ? "opacity-100" : "opacity-30")}>
            {[3, 6, 10, 5, 8].map((h, i) => (
              <div
                key={i}
                className={cn("w-1 rounded-full", isTalking && "waveform-bar")}
                style={{
                  height: `${h * 3}px`,
                  background: isTalking ? "#059669" : "oklch(0.7 0 0)",
                  animationDelay: `${i * 120}ms`,
                }}
              />
            ))}
          </div>

          {/* Mic button — desktop hold */}
          <div className="relative hidden lg:block">
            {isTalking && (
              <span
                className="mic-pulse-ring absolute inset-0 rounded-full"
                style={{ background: "#059669", opacity: 0.3 }}
              />
            )}
            <button
              type="button"
              onPointerDown={onMicPress}
              onPointerUp={onMicRelease}
              onPointerCancel={onMicRelease}
              onPointerLeave={onMicRelease}
              disabled={micDisabled}
              className={cn(
                "relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-md",
                isMicEnabled ? "shadow-[0_0_24px_rgba(5,150,105,0.3)]" : ""
              )}
              style={{
                background: isMicEnabled
                  ? "linear-gradient(135deg, #059669, #0d9488)"
                  : "#f5f5f5",
                border: isMicEnabled
                  ? "2px solid rgba(5,150,105,0.5)"
                  : "2px solid oklch(0.85 0 0)",
                color: isMicEnabled ? "#fff" : "oklch(0.4 0 0)",
              }}
              title={!isMicEnabled ? "Enable mic" : "Hold to speak"}
            >
              {isMicEnabled ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
            </button>
          </div>

          {/* Mic button — mobile tap */}
          <div className="flex lg:hidden">
            {!isTalking ? (
              <button
                type="button"
                disabled={micDisabled}
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

          {/* Right waveform */}
          <div className={cn("flex h-8 items-end gap-0.5", isTalking ? "opacity-100" : "opacity-30")}>
            {[7, 4, 9, 6, 3].map((h, i) => (
              <div
                key={i}
                className={cn("w-1 rounded-full", isTalking && "waveform-bar")}
                style={{
                  height: `${h * 3}px`,
                  background: isTalking ? "#059669" : "oklch(0.7 0 0)",
                  animationDelay: `${(i + 5) * 120}ms`,
                }}
              />
            ))}
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
          Hold{" "}
          <kbd className="rounded px-1.5 py-0.5 font-mono text-[10px] bg-neutral-100 border border-neutral-300 text-neutral-700 font-semibold shadow-2xs">
            SPACE
          </kbd>
          {" "}to talk
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
