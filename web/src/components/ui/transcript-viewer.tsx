"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CharacterAlignmentResponseModel {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}

export interface TranscriptWord {
  word: string;
  startTime: number;
  endTime: number;
  index: number;
}

export interface TranscriptGap {
  text: string;
  index: number;
}

export interface TranscriptViewerContextType {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  audioSrc: string;
  words: TranscriptWord[];
  currentWordIndex: number;
  currentWord: TranscriptWord | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  isScrubbing: boolean;
  play: () => Promise<void>;
  pause: () => void;
  seekToTime: (time: number) => void;
  seekToWord: (index: number) => void;
  startScrubbing: () => void;
  endScrubbing: () => void;
  text: string;
}

const TranscriptViewerContext = createContext<TranscriptViewerContextType | null>(null);

export function useTranscriptViewerContext(): TranscriptViewerContextType {
  const ctx = useContext(TranscriptViewerContext);
  if (!ctx) {
    throw new Error("useTranscriptViewerContext must be used within TranscriptViewerContainer");
  }
  return ctx;
}

export interface TranscriptViewerContainerProps {
  audioSrc?: string;
  text?: string;
  audioType?: string;
  alignment?: CharacterAlignmentResponseModel;
  hideAudioTags?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onDurationChange?: (duration: number) => void;
  className?: string;
  children: ReactNode;
}

export function useTranscriptViewer({
  audioSrc: providedAudioSrc,
  text = "",
  alignment,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
}: {
  audioSrc?: string;
  text?: string;
  alignment?: CharacterAlignmentResponseModel;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onDurationChange?: (duration: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const rawWords = useMemo(() => {
    return text.trim().split(/\s+/).filter(Boolean);
  }, [text]);

  const words: TranscriptWord[] = useMemo(() => {
    if (rawWords.length === 0) return [];
    
    // If explicit character alignment is provided
    if (alignment?.character_start_times_seconds && alignment.character_start_times_seconds.length > 0) {
      const starts = alignment.character_start_times_seconds;
      const ends = alignment.character_end_times_seconds || starts;
      const totalChars = starts.length;
      const totalDur = ends[totalChars - 1] || 1;
      
      const charPerWord = totalChars / rawWords.length;
      return rawWords.map((w, idx) => {
        const startIdx = Math.floor(idx * charPerWord);
        const endIdx = Math.min(Math.floor((idx + 1) * charPerWord) - 1, totalChars - 1);
        return {
          word: w,
          startTime: starts[startIdx] ?? (idx / rawWords.length) * totalDur,
          endTime: ends[endIdx] ?? ((idx + 1) / rawWords.length) * totalDur,
          index: idx,
        };
      });
    }

    // Default proportional word timings across duration
    const dur = duration > 0 ? duration : Math.max(1, rawWords.length * 0.4);
    const step = dur / rawWords.length;
    return rawWords.map((w, idx) => ({
      word: w,
      startTime: idx * step,
      endTime: (idx + 1) * step,
      index: idx,
    }));
  }, [rawWords, alignment, duration]);

  const currentWordIndex = useMemo(() => {
    if (words.length === 0) return -1;
    if (currentTime <= 0) return -1;
    const found = words.findIndex((w) => currentTime >= w.startTime && currentTime <= w.endTime);
    if (found !== -1) return found;
    // Fallback based on relative current time
    const ratio = duration > 0 ? currentTime / duration : 0;
    return Math.min(Math.floor(ratio * words.length), words.length - 1);
  }, [currentTime, duration, words]);

  const currentWord = currentWordIndex >= 0 ? words[currentWordIndex] : null;

  const play = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        onPlay?.();
      } catch (err) {
        console.warn("[TranscriptViewer] play failed:", err);
      }
    }
  }, [onPlay]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    }
  }, [onPause]);

  const seekToTime = useCallback(
    (time: number) => {
      const validTime = Math.max(0, Math.min(time, duration));
      if (audioRef.current) {
        audioRef.current.currentTime = validTime;
      }
      setCurrentTime(validTime);
    },
    [duration]
  );

  const seekToWord = useCallback(
    (index: number) => {
      if (words[index]) {
        seekToTime(words[index].startTime);
        void play();
      }
    },
    [words, seekToTime, play]
  );

  const startScrubbing = useCallback(() => setIsScrubbing(true), []);
  const endScrubbing = useCallback(() => setIsScrubbing(false), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        setCurrentTime(audio.currentTime);
        onTimeUpdate?.(audio.currentTime);
      }
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
      onDurationChange?.(audio.duration || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [isScrubbing, onTimeUpdate, onDurationChange, onEnded]);

  return {
    audioRef,
    audioSrc: providedAudioSrc || "",
    words,
    currentWordIndex,
    currentWord,
    duration,
    currentTime,
    isPlaying,
    isScrubbing,
    play,
    pause,
    seekToTime,
    seekToWord,
    startScrubbing,
    endScrubbing,
    text,
  };
}

export function TranscriptViewerContainer({
  audioSrc,
  text = "",
  alignment,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
  className,
  children,
}: TranscriptViewerContainerProps) {
  const viewerState = useTranscriptViewer({
    audioSrc,
    text,
    alignment,
    onPlay,
    onPause,
    onTimeUpdate,
    onEnded,
    onDurationChange,
  });

  return (
    <TranscriptViewerContext.Provider value={viewerState}>
      <div className={cn("relative flex flex-col gap-3 w-full", className)}>
        {children}
      </div>
    </TranscriptViewerContext.Provider>
  );
}

export function TranscriptViewerAudio(props: React.AudioHTMLAttributes<HTMLAudioElement>) {
  const { audioRef, audioSrc } = useTranscriptViewerContext();
  return <audio ref={audioRef} src={audioSrc} className="hidden" preload="auto" {...props} />;
}

export interface TranscriptViewerWordsProps {
  renderWord?: (props: { word: TranscriptWord; status: "spoken" | "unspoken" | "current" }) => ReactNode;
  wordClassNames?: string;
  className?: string;
}

export function TranscriptViewerWords({
  renderWord,
  wordClassNames,
  className,
}: TranscriptViewerWordsProps) {
  const { words, currentWordIndex, seekToWord } = useTranscriptViewerContext();

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-center", className)}>
      {words.map((w, idx) => {
        let status: "spoken" | "unspoken" | "current" = "unspoken";
        if (idx === currentWordIndex) {
          status = "current";
        } else if (idx < currentWordIndex) {
          status = "spoken";
        }

        if (renderWord) {
          return <React.Fragment key={idx}>{renderWord({ word: w, status })}</React.Fragment>;
        }

        return (
          <span
            key={idx}
            onClick={() => seekToWord(idx)}
            className={cn(
              "cursor-pointer transition-all duration-150 rounded-md px-1.5 py-0.5 select-none",
              status === "current" &&
                "bg-emerald-100 text-emerald-900 font-extrabold scale-105 border-b-2 border-emerald-600 shadow-2xs",
              status === "spoken" && "text-neutral-900 font-bold",
              status === "unspoken" && "text-neutral-400 font-medium hover:text-neutral-600",
              wordClassNames
            )}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
}

export function TranscriptViewerPlayPauseButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { isPlaying, play, pause } = useTranscriptViewerContext();

  return (
    <button
      type="button"
      onClick={() => (isPlaying ? pause() : void play())}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0",
        className
      )}
      title={isPlaying ? "Pause audio" : "Play target sentence"}
      {...props}
    >
      {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
    </button>
  );
}

export interface TranscriptViewerScrubBarProps {
  showTimeLabels?: boolean;
  labelsClassName?: string;
  trackClassName?: string;
  progressClassName?: string;
}

export function TranscriptViewerScrubBar({
  showTimeLabels = true,
  labelsClassName,
  trackClassName,
  progressClassName,
}: TranscriptViewerScrubBarProps) {
  const { currentTime, duration, seekToTime, startScrubbing, endScrubbing } = useTranscriptViewerContext();

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seekToTime(time);
  };

  return (
    <div className="flex flex-1 items-center gap-2 w-full">
      {showTimeLabels && (
        <span className={cn("text-[10px] font-mono font-semibold text-neutral-400 w-8 text-right", labelsClassName)}>
          {formatTime(currentTime)}
        </span>
      )}

      <div className={cn("relative flex-1 flex items-center h-4 group cursor-pointer", trackClassName)}>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.05}
          value={currentTime}
          onMouseDown={startScrubbing}
          onTouchStart={startScrubbing}
          onMouseUp={endScrubbing}
          onTouchEnd={endScrubbing}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
        />
        <div className="w-full h-1.5 rounded-full bg-neutral-200 overflow-hidden relative">
          <div
            className={cn("h-full bg-emerald-600 transition-all duration-75", progressClassName)}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {showTimeLabels && (
        <span className={cn("text-[10px] font-mono font-semibold text-neutral-400 w-8", labelsClassName)}>
          {formatTime(duration)}
        </span>
      )}
    </div>
  );
}
