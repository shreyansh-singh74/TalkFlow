"use client";

import { Button } from "@/components/ui/button";
import {
  Bot,
  Mic,
  MicOff,
  PersonStanding,
  PhoneOff,
  Trash2,
  User,
} from "lucide-react";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { useSpacebarControl } from "@/hooks/use-spacebar-control";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PronunciationReferenceCard } from "@/components/pronunciation-reference-card";
import { WrongWordsBar } from "@/components/wrong-words-bar";
import { normalizeWord } from "@/lib/normalize-word";
import { speakWord } from "@/lib/speak-word";
import { splitTargetToWords } from "@/lib/split-target-words";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PhonemeRealTimeFeedback } from "./phoneme-real-time-feedback";
import { useUpdateMeeting } from "@/hooks/use-api";
import type {
  MeetingPhonemeDataPersisted,
  PronunciationResultPayload,
} from "@/types/pronunciation";
import { HeardTextHighlight } from "@/components/heard-text-highlight";
import { ChevronDown } from "lucide-react";

const WAVE_BARS = [
  "h-3", "h-6", "h-10", "h-5", "h-8", "h-12", "h-7", "h-4", "h-9", "h-4",
] as const;

interface Props {
  onLeave: () => void;
  meetingName: string;
  meetingId: string;
}

export const CallActive = ({
  onLeave,
  meetingName,
  meetingId,
}: Props) => {
  const updateMeeting = useUpdateMeeting();
  const phonemeEntriesRef = useRef<MeetingPhonemeDataPersisted["entries"]>([]);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isConnected,
    isTalking,
    isAISpeaking,
    transcripts,
    partialTranscript,
    streamingAIText,
    conversationStatus,
    error: transcriptionError,
    phonemeAnalysis,
    lastPronunciation,
    targetText,
    connect,
    disconnect,
    startTalking,
    stopTalking,
    clearTranscripts,
  } = usePushToTalk();

  const [isPhonemeOpen, setIsPhonemeOpen] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [activeWordKey, setActiveWordKey] = useState("");
  const [speechLang, setSpeechLang] = useState("en-IN");
  const lastUserTranscript = transcripts.length > 0 ? transcripts[transcripts.length - 1].text : "";

  const targetWords = useMemo(() => splitTargetToWords(targetText), [targetText]);
  const misExpectedNormSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of lastPronunciation?.misaligned_words || []) {
      if (p?.expected) {
        s.add(normalizeWord(p.expected));
      }
    }
    return s;
  }, [lastPronunciation?.misaligned_words]);

  const displayWord = useMemo(() => {
    const t = targetWords.find((w) => w.norm === activeWordKey);
    if (t) {
      return t.raw.replace(/[^a-zA-Z0-9']+$/g, "");
    }
    return activeWordKey;
  }, [targetWords, activeWordKey]);

  useEffect(() => {
    if (activeWordKey) {
      return;
    }
    const w = targetWords[0];
    if (w) {
      setActiveWordKey(normalizeWord(w.raw));
    }
  }, [targetText, targetWords, activeWordKey]);

  const lastPrRef = useRef(lastPronunciation);
  lastPrRef.current = lastPronunciation;

  useEffect(() => {
    const p = lastPrRef.current;
    if (!p) {
      return;
    }
    const m = p.misaligned_words;
    const w0 = targetWords[0];
    if (m?.length) {
      setActiveWordKey(normalizeWord(m[0].expected));
    } else if (w0) {
      setActiveWordKey(normalizeWord(w0.raw));
    }
  }, [lastPronunciation?.turn_id, targetWords]);

  const appendPronunciationEntry = useCallback(
    (p: PronunciationResultPayload) => {
      if (phonemeEntriesRef.current.some((e) => e.turn_id === p.turn_id)) {
        return;
      }
      const entry: MeetingPhonemeDataPersisted["entries"][number] = {
        at: new Date().toISOString(),
        turn_id: p.turn_id,
        target_text: p.target_text,
        heard_text: p.heard_text,
        score: p.score,
        feedback: p.feedback.slice(0, 5),
      };
      phonemeEntriesRef.current = [...phonemeEntriesRef.current, entry].slice(-50);
    },
    []
  );

  useEffect(() => {
    if (!lastPronunciation) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      appendPronunciationEntry(lastPronunciation);
      updateMeeting.mutate({
        id: meetingId,
        phonemeData: { entries: phonemeEntriesRef.current },
      });
    }, 2000);
    return () => {
      if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    };
  }, [lastPronunciation, meetingId, updateMeeting, appendPronunciationEntry]);

  useSpacebarControl({
    onSpaceDown: startTalking,
    onSpaceUp: stopTalking,
    enabled: isConnected && isMicEnabled,
  });

  useEffect(() => {
    if (isMicEnabled && !isConnected) {
      connect();
    } else if (!isMicEnabled && isConnected) {
      disconnect();
    }
  }, [isMicEnabled, isConnected, connect, disconnect]);

  const handleMicToggle = () => {
    setIsMicEnabled((c) => !c);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleLeaveWithPersist = () => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    if (lastPronunciation) {
      appendPronunciationEntry(lastPronunciation);
    }
    if (phonemeEntriesRef.current.length > 0) {
      updateMeeting.mutate({
        id: meetingId,
        phonemeData: { entries: phonemeEntriesRef.current },
      });
    }
    onLeave();
  };

  const mainMicPress = (e: React.PointerEvent) => {
    if (!isMicEnabled) {
      handleMicToggle();
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    startTalking();
  };

  const mainMicRelease = (e: React.PointerEvent) => {
    if (!isMicEnabled) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
    stopTalking();
  };

  const scoreDisplay = lastPronunciation
    ? Math.min(100, Math.max(0, Math.round(Number(lastPronunciation.score))))
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground font-sans">
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <h1 className="truncate text-sm font-semibold tracking-tight" title={meetingName}>
          {meetingName}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center space-y-10">
            <div className="space-y-2 text-center">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Repeat after me
              </span>
              <p className="text-[15px] text-muted-foreground">
                Listen carefully and repeat the sentence.
              </p>
            </div>

            <div className="flex min-h-[240px] w-full max-w-3xl flex-col items-stretch justify-center gap-3 rounded-xl border border-border/60 bg-card p-6 text-card-foreground shadow-sm sm:min-h-[300px] sm:p-10">
              <h2 className="max-w-3xl text-center text-2xl font-semibold leading-relaxed tracking-tight sm:text-3xl sm:leading-normal md:text-4xl">
                {targetText.split(/(\s+)/g).map((part, i) => {
                  if (!/\S/.test(part)) {
                    return <span key={i}>{part}</span>;
                  }
                  const norm = normalizeWord(part);
                  if (!norm) {
                    return <span key={i}>{part}</span>;
                  }
                  const wrong = misExpectedNormSet.has(norm);
                  const active = norm === activeWordKey;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={cn(
                        "inline p-0 align-baseline transition-colors",
                        "border-b-2 border-transparent bg-transparent",
                        "hover:text-primary",
                        active && "font-semibold text-primary",
                        !active && "text-foreground"
                      )}
                      onClick={() => {
                        setActiveWordKey(norm);
                      }}
                    >
                      {part}
                      {wrong && (
                        <span className="ml-0.5 inline text-destructive" aria-label="Mismatched">
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}
              </h2>
            </div>

            <PronunciationReferenceCard
              displayWord={displayWord}
              activeWordKey={activeWordKey}
              lang={speechLang}
              onLangChange={setSpeechLang}
            />

            {transcriptionError && (
              <div
                className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
                role="alert"
              >
                {transcriptionError}
              </div>
            )}

            <div className="mt-2 flex flex-col items-center space-y-6">
              <div
                className={`flex h-12 w-64 items-center justify-center space-x-1.5 ${
                  isTalking ? "opacity-100" : "opacity-50"
                }`}
              >
                {WAVE_BARS.map((h, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all ${h} ${
                      isTalking ? "animate-pulse" : ""
                    } bg-primary`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>

              <button
                type="button"
                onPointerDown={mainMicPress}
                onPointerUp={mainMicRelease}
                onPointerCancel={mainMicRelease}
                onPointerLeave={mainMicRelease}
                className="group relative hidden lg:flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 active:scale-95"
                title={!isMicEnabled ? "Enable microphone" : "Hold to speak"}
              >
                <span className="absolute inset-0 rounded-full bg-primary-foreground/0 opacity-0 transition-opacity group-hover:opacity-10" />
                {isMicEnabled ? <Mic className="h-9 w-9" /> : <MicOff className="h-9 w-9" />}
              </button>

              {/* Mobile / iPad controls: show on screens smaller than lg */}
              <div className="lg:hidden flex flex-col items-center gap-3">
                {!isTalking ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-48"
                    onClick={() => {
                      if (!isMicEnabled) {
                        setIsMicEnabled(true);
                        // ensure connection before starting
                        setTimeout(() => startTalking(), 250);
                      } else {
                        startTalking();
                      }
                    }}
                  >
                    Start Talking
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="lg"
                    variant="destructive"
                    className="w-48"
                    onClick={() => stopTalking()}
                  >
                    Stop
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMicToggle}
                  className="rounded-full"
                >
                  {isMicEnabled ? "Turn off mic" : "Turn on mic"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="rounded-full border border-border bg-muted/60 px-4 py-2">
                  <span className="hidden lg:inline">Hold{" "}</span>
                  <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                    SPACE
                  </kbd>
                  <span className="hidden lg:inline"> to talk</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMicToggle}
                  className="rounded-full"
                >
                  {isMicEnabled ? "Turn off mic" : "Turn on mic"}
                </Button>
              </div>

              {conversationStatus && (
                <p className="text-center text-xs text-muted-foreground">{conversationStatus}</p>
              )}

            <WrongWordsBar
              pairs={lastPronunciation?.misaligned_words}
              activeKey={activeWordKey}
              onSelectExpected={(expected, fromWrongBar) => {
                setActiveWordKey(normalizeWord(expected));
                if (fromWrongBar) {
                  speakWord(expected, { rate: 0.7, lang: speechLang });
                }
              }}
            />
            </div>
          </div>
        </section>

        <aside className="flex h-full min-h-0 w-full flex-col border-t border-border bg-muted/50 lg:w-[32%] lg:max-w-md lg:border-t-0 lg:border-l">
          <div className="z-10 flex shrink-0 items-start justify-between gap-3 border-b border-border/80 bg-muted/50 px-6 py-4 backdrop-blur-sm">
            <h2 className="text-xl font-medium tracking-tight">Voice Conversation</h2>
            <div className="flex shrink-0 items-center gap-2">
              {transcripts.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearTranscripts}
                  className="h-8 w-8 text-muted-foreground"
                  title="Clear conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLeaveWithPersist}
                className="gap-1.5 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                Leave
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pronunciation
                </h3>
                {scoreDisplay != null && (
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-3xl font-bold tabular-nums text-primary">
                      {scoreDisplay}
                    </span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                )}
              </div>

              {lastPronunciation ? (
                <div className="space-y-4 rounded-lg border border-border/60 bg-card p-4 text-card-foreground shadow-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Target
                    </div>
                    <p className="mt-1 text-base leading-relaxed">{lastPronunciation.target_text}</p>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Heard
                    </div>
                    <HeardTextHighlight
                      className="mt-1 text-base leading-relaxed"
                      text={lastPronunciation.heard_text || "—"}
                      misalignedWords={lastPronunciation.misaligned_words}
                    />
                  </div>
                  {lastPronunciation.feedback.slice(0, 3).map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                      {line}
                    </p>
                  ))}
                </div>
              ) : phonemeAnalysis ? (
                <Collapsible open={isPhonemeOpen} onOpenChange={setIsPhonemeOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-card-foreground"
                    >
                      <span>Live · {Math.round(phonemeAnalysis.overall_accuracy)}%</span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isPhonemeOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-card p-2">
                    <PhonemeRealTimeFeedback
                      transcript={lastUserTranscript}
                      analysis={phonemeAnalysis}
                    />
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Finish speaking to see your pronunciation score and feedback.
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conversation
              </h3>
              <ScrollArea className="h-[min(360px,40vh)] pr-2 lg:h-[min(400px,45vh)]">
                <div className="space-y-3 pb-2">
                  {isConnected &&
                    !isTalking &&
                    !isAISpeaking &&
                    !streamingAIText &&
                    isMicEnabled && (
                      <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card p-3 text-sm text-muted-foreground shadow-sm">
                        <span className="text-xs text-primary">Ready</span>
                        <p className="mt-1">Hold SPACE to talk.</p>
                      </div>
                    )}
                  {isTalking && (
                    <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card p-3 text-sm shadow-sm">
                      <span className="text-xs font-medium text-primary">Recording</span>
                      <p className="mt-1 text-foreground">Release SPACE when you are done.</p>
                    </div>
                  )}
                  {isAISpeaking && !streamingAIText && (
                    <div className="flex max-w-[90%] items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card p-3 text-sm text-muted-foreground shadow-sm">
                        Assistant is speaking…
                      </div>
                    </div>
                  )}
                  {streamingAIText && (
                    <div className="flex max-w-[90%] items-start gap-3 self-start">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card p-3 text-sm leading-relaxed text-foreground shadow-sm">
                        <p className="text-xs text-muted-foreground">Assistant is replying…</p>
                        <p className="mt-1">{streamingAIText}</p>
                      </div>
                    </div>
                  )}
                  {partialTranscript && (
                    <div className="flex w-full justify-end">
                      <div className="flex max-w-[90%] items-start gap-3 flex-row-reverse">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="rounded-2xl rounded-tr-sm border border-border/40 bg-muted p-3 text-sm italic text-foreground shadow-sm">
                          {partialTranscript}
                        </div>
                      </div>
                    </div>
                  )}
                  {transcripts.length === 0 && !partialTranscript && !streamingAIText ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center text-sm text-muted-foreground">
                      <PersonStanding className="mb-2 h-6 w-6 opacity-50" />
                      <p>
                        {isMicEnabled
                          ? "Your turns and AI replies will appear here."
                          : "Turn on the microphone to start."}
                      </p>
                    </div>
                  ) : (
                    transcripts.map((t) => (
                      <div key={t.id} className="space-y-3">
                        <div className="ml-auto flex max-w-[90%] items-start gap-3 flex-row-reverse">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="rounded-2xl rounded-tr-sm border border-border/40 bg-muted p-3 text-sm leading-relaxed text-foreground shadow-sm">
                            <p>{t.text}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {formatTime(t.timestamp)}
                            </p>
                          </div>
                        </div>
                        {t.reply && (
                          <div className="flex max-w-[90%] items-start gap-3 self-start">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card p-3 text-sm leading-relaxed text-foreground shadow-sm">
                              {t.reply}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
};
