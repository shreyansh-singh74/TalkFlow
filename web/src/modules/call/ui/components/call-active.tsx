"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Mic, MicOff, PhoneOff, RotateCcw, Trash2, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PronunciationReferenceCard } from "@/components/pronunciation-reference-card";
import { WrongWordsBar } from "@/components/wrong-words-bar";
import { HeardTextHighlight } from "@/components/heard-text-highlight";
import { normalizeWord } from "@/lib/normalize-word";
import { speakWord } from "@/lib/speak-word";
import { splitTargetToWords } from "@/lib/split-target-words";
import { cn } from "@/lib/utils";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { useSpacebarControl } from "@/hooks/use-spacebar-control";
import { useUpdateMeeting } from "@/hooks/use-api";
import { MeetingStatus } from "@/modules/meetings/types";
import { useRouter } from "next/navigation";
import type {
  MeetingPhonemeDataPersisted,
  PronunciationResultPayload,
} from "@/types/pronunciation";

/** Arc progress dial — tuning-meter metaphor for the pronunciation score. */
function ArcDial({ score }: { score: number | null }) {
  const radius = 40;
  const stroke = 5;
  const cx = 54;
  const cy = 54;
  const circumference = Math.PI * radius; // half-circle arc
  const progress = score != null ? Math.min(100, Math.max(0, score)) / 100 : 0;
  const offset = circumference * (1 - progress);
  const colorStyle = score == null
    ? "var(--muted-foreground)"
    : score >= 80
    ? "var(--primary)"
    : score >= 50
    ? "color-mix(in oklab, var(--primary) 70%, black)"
    : "var(--destructive)";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="108" height="62" viewBox="0 0 108 62" aria-hidden>
        {/* Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={colorStyle}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
        />
        {/* Score numeral */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fill={score != null ? "var(--foreground)" : "var(--muted-foreground)"}
          fontFamily="var(--font-display)"
        >
          {score != null ? score : "—"}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)" fontFamily="sans-serif">
          / 100
        </text>
      </svg>
      <span
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "var(--muted-foreground)" }}
      >
        Score
      </span>
    </div>
  );
}
/** Mini sparkline of last-5 scores. */
function ScoreSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const h = 20;
  const w = 60;
  const max = 100;
  const pts = scores.slice(-5);
  const step = w / (pts.length - 1);
  const points = pts
    .map((s, i) => `${i * step},${h - (s / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Score trend">
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

function CoachPanel({
  isConnected,
  isTalking,
  isAISpeaking,
  streamingAIText,
  isMicEnabled,
  partialTranscript,
  transcripts,
  startTalking,
  formatTime,
  practiceMode,
}: {
  isConnected: boolean;
  isTalking: boolean;
  isAISpeaking: boolean;
  streamingAIText: string;
  isMicEnabled: boolean;
  partialTranscript: string;
  transcripts: Array<{
    id: string;
    text: string;
    timestamp: Date;
    reply?: string;
  }>;
  startTalking: () => void;
  formatTime: (date: Date) => string;
  practiceMode: "word" | "sentence";
}) {
  return (
    <section
      className="flex h-full w-full flex-col rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--sidebar)",
        border: "1px solid color-mix(in oklab, var(--sidebar-accent) 45%, black)",
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--sidebar-accent-foreground)" }}
        >
          Coach
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 pr-3">
          {isConnected && !isTalking && !isAISpeaking && !streamingAIText && isMicEnabled && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "var(--sidebar-accent)", border: "1px solid var(--sidebar-accent)", color: "var(--sidebar-accent-foreground)" }}
            >
              <p className="font-medium">
                {practiceMode === "word" ? "Repeat the word" : "Repeat the sentence"}
              </p>
              <p className="mt-0.5 text-xs opacity-80">Hold SPACE to speak, release to submit.</p>
            </div>
          )}

          {isTalking && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "var(--sidebar-accent)", border: "1px solid var(--sidebar-accent)", color: "var(--sidebar-accent-foreground)" }}
            >
              <p className="font-medium">Listening…</p>
              <p className="mt-0.5 text-xs opacity-80">Release SPACE when done.</p>
            </div>
          )}

          {(isAISpeaking || streamingAIText) && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--sidebar-accent-foreground)" }}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" style={{ color: "var(--sidebar-accent-foreground)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--sidebar-accent-foreground)" }}>
                  {streamingAIText ? "Replying…" : "Speaking…"}
                </span>
              </div>
              {streamingAIText && <p className="leading-relaxed">{streamingAIText}</p>}
            </div>
          )}

          {partialTranscript && (
            <div className="flex justify-end">
              <p
                className="max-w-[85%] rounded-lg px-3 py-2 text-sm italic"
                style={{ background: "rgba(255,255,255,0.08)", color: "var(--sidebar-foreground)" }}
              >
                {partialTranscript}
              </p>
            </div>
          )}

          {transcripts.length === 0 && !partialTranscript && !streamingAIText && !isTalking && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                <Mic className="h-5 w-5" style={{ color: "var(--sidebar-foreground)" }} />
              </div>
              <p className="text-xs" style={{ color: "var(--sidebar-foreground)" }}>
                {isMicEnabled
                  ? "Your turns and coach replies will appear here."
                  : "Turn on the mic to start."}
              </p>
            </div>
          )}

          {transcripts.map((t) => (
            <div key={t.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "rgba(255,255,255,0.08)", color: "var(--sidebar-foreground)" }}
                >
                  <User className="h-3 w-3" />
                </div>
                <div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--sidebar-accent-foreground)" }}>
                    {t.text}
                  </p>
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--sidebar-foreground)" }}>
                    {formatTime(t.timestamp)}
                  </p>
                </div>
              </div>

              {t.reply && (
                <div
                  className="ml-4 rounded-r-lg rounded-bl-lg px-3 py-2.5 text-sm leading-relaxed"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderLeft: "3px solid var(--primary)",
                    color: "var(--sidebar-accent-foreground)",
                  }}
                >
                  <div className="mb-1 flex items-center gap-1">
                    <Bot className="h-3 w-3" style={{ color: "var(--primary)" }} />
                    <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--primary)" }}>
                      Coach
                    </span>
                  </div>
                  {t.reply.toLowerCase().startsWith("sorry") || t.reply.toLowerCase().includes("couldn't generate") ? (
                    <div className="flex items-center justify-between gap-2">
                      <p style={{ color: "var(--sidebar-foreground)" }}>
                        Didn&apos;t catch that clearly — try again.
                      </p>
                      <button
                        type="button"
                        className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors hover:bg-white/10"
                        style={{ color: "var(--primary)", border: "1px solid var(--primary)" }}
                        onClick={startTalking}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <p>{t.reply}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
}

/**
 * Phonetic staff — target sentence rendered word-by-word with IPA beneath.
 * After an attempt, "heard" IPA appears under each word in amber.
 * Mismatched words get an underline bridge instead of a red ×.
 */
function PhoneticStaff({
  targetText,
  misExpectedNormSet,
  activeWordKey,
  onWordClick,
}: {
  targetText: string;
  misExpectedNormSet: Set<string>;
  activeWordKey: string;
  onWordClick: (norm: string) => void;
}) {
  const words = targetText.split(/(\s+)/g);
  return (
    <div
      className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4 px-2"
      aria-label="Target sentence"
    >
      {words.map((part, i) => {
        if (!/\S/.test(part)) return <span key={i} className="w-2" />;
        const norm = normalizeWord(part);
        if (!norm) return <span key={i}>{part}</span>;
        const wrong = misExpectedNormSet.has(norm);
        const active = norm === activeWordKey;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onWordClick(norm)}
            className="group flex flex-col items-center gap-1 focus:outline-none"
          >
            {/* Target word */}
            <span
              className="text-3xl font-semibold leading-tight tracking-tight transition-colors sm:text-4xl"
              style={{
                fontFamily: "var(--font-display)",
                color: active ? "var(--foreground)" : "var(--muted-foreground)",
                borderBottom: wrong
                  ? "2px solid var(--destructive)"
                  : active
                  ? "2px solid var(--primary)"
                  : "2px solid transparent",
                paddingBottom: "2px",
              }}
            >
              {part}
            </span>
          </button>
        );
      })}
    </div>
  );
}
interface Props {
  onLeave: () => void;
  meetingName: string;
  meetingId: string;
  agentName: string;
  agentInstructions: string;
}

export const CallActive = ({
  onLeave,
  meetingName,
  meetingId,
  agentName,
  agentInstructions,
}: Props) => {
  const updateMeeting = useUpdateMeeting();
  const phonemeEntriesRef = useRef<MeetingPhonemeDataPersisted["entries"]>([]);
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreHistoryRef = useRef<number[]>([]);

  const router = useRouter();
  const {
    isConnected, isTalking, isAISpeaking, transcripts, partialTranscript,
    streamingAIText, conversationStatus, error: transcriptionError,
    lastPronunciation, targetText,
    practiceMode, practiceSentence, practiceProgress,
    connect, disconnect, startTalking, stopTalking, clearTranscripts,
    sessionReport, sendNextSentence,
  } = usePushToTalk({ meetingId, agentName, agentInstructions });

  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [activeWordKey, setActiveWordKey] = useState("");
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);

  const targetWords = useMemo(() => splitTargetToWords(targetText), [targetText]);

  const misExpectedNormSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of lastPronunciation?.misaligned_words || []) {
      if (p?.expected) s.add(normalizeWord(p.expected));
    }
    return s;
  }, [lastPronunciation?.misaligned_words]);

  const displayWord = useMemo(() => {
    const t = targetWords.find((w) => w.norm === activeWordKey);
    return t ? t.raw.replace(/[^a-zA-Z0-9']+$/g, "") : activeWordKey;
  }, [targetWords, activeWordKey]);

  const scoreDisplay = lastPronunciation
    ? Math.min(100, Math.max(0, Math.round(Number(lastPronunciation.score))))
    : null;

  // Seed first active word when target changes
  useEffect(() => {
    const w = targetWords[0];
    if (w) setActiveWordKey(normalizeWord(w.raw));
  }, [targetText, targetWords]);

  // Auto-focus first wrong word after attempt
  const lastPrRef = useRef(lastPronunciation);
  lastPrRef.current = lastPronunciation;
  useEffect(() => {
    const p = lastPrRef.current;
    if (!p) return;
    const m = p.misaligned_words;
    const w0 = targetWords[0];
    if (m?.length) setActiveWordKey(normalizeWord(m[0].expected));
    else if (w0) setActiveWordKey(normalizeWord(w0.raw));
  }, [lastPronunciation?.turn_id, targetWords]);

  // Track score history
  useEffect(() => {
    if (scoreDisplay == null) return;
    scoreHistoryRef.current = [...scoreHistoryRef.current, scoreDisplay].slice(-10);
    setScoreHistory([...scoreHistoryRef.current]);
  }, [scoreDisplay]);

  const appendPronunciationEntry = useCallback((p: PronunciationResultPayload) => {
    if (phonemeEntriesRef.current.some((e) => e.turn_id === p.turn_id)) return;
    phonemeEntriesRef.current = [
      ...phonemeEntriesRef.current,
      {
        at: new Date().toISOString(),
        turn_id: p.turn_id,
        target_text: p.target_text,
        heard_text: p.heard_text,
        score: p.score,
        mode: practiceMode,
        agent_name: agentName,
        feedback: p.feedback.slice(0, 5),
      },
    ].slice(-50);
  }, [agentName, practiceMode]);

  useEffect(() => {
    if (!lastPronunciation) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      appendPronunciationEntry(lastPronunciation);
      updateMeeting.mutate({ id: meetingId, phonemeData: { entries: phonemeEntriesRef.current } });
    }, 2000);
    return () => { if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current); };
  }, [lastPronunciation, meetingId, updateMeeting, appendPronunciationEntry]);

  useSpacebarControl({ onSpaceDown: startTalking, onSpaceUp: stopTalking, enabled: isConnected && isMicEnabled });

  useEffect(() => {
    if (isMicEnabled && !isConnected) connect();
    else if (!isMicEnabled && isConnected) disconnect();
  }, [isMicEnabled, isConnected, connect, disconnect]);

  // Redirect when session report is received from websocket
  useEffect(() => {
    if (sessionReport) {
      if (persistDebounceRef.current) {
        clearTimeout(persistDebounceRef.current);
        persistDebounceRef.current = null;
      }
      
      if (lastPronunciation) {
        appendPronunciationEntry(lastPronunciation);
      }
      
      updateMeeting.mutate({
        id: meetingId,
        status: MeetingStatus.Completed,
        endedAt: new Date().toISOString(),
        phonemeData: {
          entries: phonemeEntriesRef.current,
          report: sessionReport
        }
      }, {
        onSuccess: () => {
          router.push(`/dashboard/analysis/${meetingId}`);
        }
      });
    }
  }, [sessionReport, meetingId, lastPronunciation, appendPronunciationEntry, router, updateMeeting]);

  const handleLeaveWithPersist = () => {
    if (persistDebounceRef.current) { clearTimeout(persistDebounceRef.current); persistDebounceRef.current = null; }
    if (lastPronunciation) appendPronunciationEntry(lastPronunciation);
    if (phonemeEntriesRef.current.length > 0) {
      updateMeeting.mutate({ id: meetingId, phonemeData: { entries: phonemeEntriesRef.current } });
    }
    onLeave();
  };

  const mainMicPress = (e: React.PointerEvent) => {
    if (!isMicEnabled) {
      setIsMicEnabled(true);
      // startTalking will be called by the useEffect that watches isMicEnabled→connect,
      // but we also kick it here after a short delay to ensure the WS is open.
      setTimeout(() => { void startTalking(); }, 300);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    void startTalking();
  };
  const mainMicRelease = (e: React.PointerEvent) => {
    if (!isMicEnabled) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    stopTalking();
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      {/* ── Header bar ── */}
      <header
        className="flex h-11 shrink-0 items-center justify-between px-4 gap-2"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--background)" }}
      >
        <h1
          className="truncate text-sm font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          title={meetingName}
        >
          {meetingName}
        </h1>
        <div className="flex items-center gap-2">
          {transcripts.length > 0 && (
            <button
              type="button"
              onClick={clearTranscripts}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              title="Clear conversation"
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
          <button
            type="button"
            onClick={handleLeaveWithPersist}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors hover:bg-white/10"
            style={{ color: "var(--primary)", border: "1px solid var(--primary)" }}
          >
            <PhoneOff className="h-3 w-3" />
            Leave
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <section className="relative flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto p-6 gap-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8">
            {/*<p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--muted-foreground)" }}
            >
              Repeat after me
            </p>*/}

            {/* ── Arc score dial + sparkline ── */}
            <div className="flex flex-col items-center gap-2">
              <ArcDial score={scoreDisplay} />
              <ScoreSparkline scores={scoreHistory} />
            </div>

            {/* ── Phonetic staff — target sentence ── */}
            <div
              className="w-full rounded-2xl px-6 py-8"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-xs">
                <span
                  className="rounded-full px-3 py-1 font-medium"
                  style={{ background: "var(--muted)", color: "var(--foreground)" }}
                >
                  {practiceMode === "word" ? "Word Practice" : "Sentence Practice"}
                </span>
                <span style={{ color: "var(--muted-foreground)" }}>
                  {practiceMode === "word"
                    ? `Word ${practiceProgress.current} of ${practiceProgress.total}`
                    : "Full sentence"}
                </span>
              </div>
              <PhoneticStaff
                targetText={targetText}
                misExpectedNormSet={misExpectedNormSet}
                activeWordKey={activeWordKey}
                onWordClick={setActiveWordKey}
              />
              {practiceMode === "word" && practiceSentence !== targetText && (
                <p className="mt-4 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Sentence: {practiceSentence}
                </p>
              )}

              {/* Feedback line: heard text */}
              {lastPronunciation && (
                <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                    Heard
                  </p>
                  <HeardTextHighlight
                    className="text-base leading-relaxed"
                    text={lastPronunciation.heard_text || "—"}
                    misalignedWords={lastPronunciation.misaligned_words}
                  />
                  {lastPronunciation.feedback.slice(0, 2).map((line, i) => (
                    <p key={i} className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* ── Wrong words bar ── */}
            <WrongWordsBar
              pairs={lastPronunciation?.misaligned_words}
              activeKey={activeWordKey}
              onSelectExpected={(expected, fromWrongBar) => {
                setActiveWordKey(normalizeWord(expected));
                if (fromWrongBar) speakWord(expected, { rate: 0.7, lang: speechLang });
              }}
            />

            {/* ── Merged phonetic breakdown card ── */}
            <PronunciationReferenceCard
              displayWord={displayWord}
              activeWordKey={activeWordKey}
              lang={speechLang}
              onLangChange={setSpeechLang}
              misalignedPairs={lastPronunciation?.misaligned_words}
            />

            {/* ── Navigation / Progress controls ── */}
            {lastPronunciation && (
              <div className="w-full max-w-md mt-2">
                {scoreDisplay !== null && scoreDisplay >= 95 ? (
                  <div className="flex flex-col items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 rounded-xl px-6 py-4 w-full text-center">
                    <p className="text-sm font-semibold text-emerald-500 flex items-center gap-1.5 justify-center">
                      ✓ Correct pronunciation! (Score: {scoreDisplay}%)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      You are ready to advance to the next sentence.
                    </p>
                    <button
                      type="button"
                      onClick={sendNextSentence}
                      className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 active:scale-98 transition-all text-white font-medium py-2 rounded-lg text-sm shadow-md"
                    >
                      Next Sentence
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 border border-amber-500/20 bg-amber-500/5 rounded-xl px-6 py-4 w-full text-center">
                    <p className="text-sm font-semibold text-amber-500 flex items-center gap-1.5 justify-center">
                      ⚠ Score: {scoreDisplay}% (Goal: 95%)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pronunciation was slightly off. Repeat the sentence to improve!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Mic controls ── */}
            {transcriptionError && (
              <div
                className="w-full max-w-md rounded-lg px-3 py-2 text-center text-sm"
                style={{ background: "color-mix(in oklab, var(--destructive) 12%, white)", color: "var(--destructive)", border: "1px solid color-mix(in oklab, var(--destructive) 35%, white)" }}
                role="alert"
              >
                {transcriptionError}
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              <div className={cn("flex h-10 items-center gap-1", isTalking ? "opacity-100" : "opacity-25")}>
                {[3,6,10,5,8,12,7,4,9,4].map((h, i) => (
                  <div
                    key={i}
                    className={cn("w-1.5 rounded-full", isTalking && "animate-pulse")}
                    style={{
                      height: `${h * 4}px`,
                      background: isTalking ? "var(--primary)" : "var(--muted-foreground)",
                      animationDelay: `${i * 80}ms`,
                    }}
                  />
                ))}
              </div>

              {/* Desktop hold-to-talk button */}
              <div className="relative hidden lg:block">
                {isTalking && (
                  <span
                    className="mic-pulse-ring absolute inset-0 rounded-full"
                    style={{ background: "var(--primary)", opacity: 0.3 }}
                  />
                )}
                <button
                  type="button"
                  onPointerDown={mainMicPress}
                  onPointerUp={mainMicRelease}
                  onPointerCancel={mainMicRelease}
                  onPointerLeave={mainMicRelease}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-150 active:scale-95"
                  style={{
                    background: isMicEnabled ? "var(--primary)" : "var(--card)",
                    border: `2px solid ${isMicEnabled ? "var(--primary)" : "var(--border)"}`,
                    color: isMicEnabled ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}
                  title={!isMicEnabled ? "Enable mic" : "Hold to speak"}
                >
                  {isMicEnabled ? <Mic className="h-8 w-8" /> : <MicOff className="h-8 w-8" />}
                </button>
              </div>

              {/* Mobile tap controls */}
              <div className="flex flex-col items-center gap-2 lg:hidden">
                {!isTalking ? (
                  <button
                    type="button"
                    className="rounded-lg px-8 py-2.5 text-sm font-semibold transition-all active:scale-95"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                    onClick={() => {
                      if (!isMicEnabled) { setIsMicEnabled(true); setTimeout(() => startTalking(), 250); }
                      else startTalking();
                    }}
                  >
                    Start Talking
                  </button>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg px-8 py-2.5 text-sm font-semibold transition-all active:scale-95"
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                    onClick={stopTalking}
                  >
                    Stop
                  </button>
                )}
              </div>

              {/* SPACE hint + mic toggle */}
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span className="hidden lg:inline">
                  Hold{" "}
                  <kbd
                    className="rounded px-1.5 py-0.5 font-mono"
                    style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                  >
                    SPACE
                  </kbd>
                  {" "}to talk
                </span>
                <button
                  type="button"
                  onClick={() => setIsMicEnabled((c) => !c)}
                  className="rounded-full px-3 py-1 transition-colors hover:bg-white/10"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {isMicEnabled ? "Turn off mic" : "Turn on mic"}
                </button>
              </div>

              {conversationStatus && (
                <p className="text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {conversationStatus}
                </p>
              )}
            </div>

          </div>
        </section>

        <aside className="flex min-h-0 h-[300px] lg:h-full w-full shrink-0 lg:w-[340px]">
          <div className="flex min-h-0 flex-1 p-4 lg:py-4 lg:pl-0 lg:pr-4">
            <CoachPanel
              isConnected={isConnected}
              isTalking={isTalking}
              isAISpeaking={isAISpeaking}
              streamingAIText={streamingAIText}
              isMicEnabled={isMicEnabled}
              partialTranscript={partialTranscript}
              transcripts={transcripts}
              startTalking={startTalking}
              formatTime={formatTime}
              practiceMode={practiceMode}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};
