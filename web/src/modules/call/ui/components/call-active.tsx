"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PhoneOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PronunciationReferenceCard } from "@/components/pronunciation-reference-card";
import { WrongWordsBar } from "@/components/wrong-words-bar";
import { normalizeWord } from "@/lib/normalize-word";
import { speakWord } from "@/lib/speak-word";
import { splitTargetToWords } from "@/lib/split-target-words";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { useSpacebarControl } from "@/hooks/use-spacebar-control";
import { useUpdatePracticeSession } from "@/hooks/use-api";
import { SessionStatus } from "@/modules/sessions/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCardIcon, ListIcon } from "lucide-react";
import {
  DIFFICULTY_PASS_THRESHOLDS,
  type Difficulty,
  type PracticeScript,
  type SessionSource,
} from "@/types/practice";
import type {
  SessionAnalysisReport,
  SessionPhonemeDataPersisted,
  PronunciationResultPayload,
} from "@/types/pronunciation";

import { CallActiveHeader } from "./call-active-header";
import { CallActiveControls } from "./call-active-controls";
import { CallActiveCoach } from "./call-active-coach";
import { CallActiveComplete } from "./call-active-complete";
import { CallConnecting } from "./call-connecting";
import { CallActiveSentence } from "./call-active-sentence";
import { CallActiveFeedback } from "./call-active-feedback";
import { CallActiveScorePill } from "./call-active-score-pill";

interface Props {
  onLeave: () => void;
  sessionName: string;
  sessionId: string;
  coachName: string;
  coachInstructions: string;
  script: PracticeScript | null;
  source: SessionSource;
  difficulty: Difficulty;
  topic: string;
  accent: string;
  /** Learner's first language, from settings. Coaching bias only. */
  l1?: string;
  /** Learner's audio-retention consent, from settings. */
  retainAudio?: boolean;
  /** Learner's listening speed, from settings. */
  listeningRate?: number;
  initialPhonemeData?: SessionPhonemeDataPersisted | null;
}

export const CallActive = ({
  onLeave,
  sessionName,
  sessionId,
  coachName,
  coachInstructions,
  script,
  source,
  difficulty,
  topic,
  accent,
  l1 = "",
  retainAudio = false,
  listeningRate = 1,
  initialPhonemeData,
}: Props) => {
  // `mutate` (not the whole mutation result): the result object gets a new
  // identity on every render/mutation-state change, and using it in effect
  // deps re-armed the persist timers after every save -- each completed PUT
  // scheduled another append+PUT of the same turn, forever. That loop is how
  // one spoken turn became 100 identical transcript rows.
  const { mutate: persistSession } = useUpdatePracticeSession();
  // Turn ids already recorded. Second line of defence against duplicate rows:
  // even if a persist path runs twice for one turn, the entry is stored once.
  const recordedTurnIdsRef = useRef<Set<string>>(new Set());
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const router = useRouter();

  const scriptSteps = useMemo(() => script?.steps ?? [], [script]);

  /**
   * Leave from the completion screen: the report effect has already persisted
   * status + analysis, so a confirmation dialog (and the second "session
   * complete" screen it led to) only added clicks. Mid-session — no report yet
   * — the confirm still matters, because leaving there is what saves progress.
   */
  const requestLeave = () => {
    if (sessionReport) {
      router.push(`/sessions/${sessionId}`);
      return;
    }
    setShowLeaveConfirm(true);
  };

  const {
    isConnected, isTalking, isAISpeaking, transcripts, partialTranscript,
    streamingAIText, conversationStatus, error: transcriptionError, fatalError,
    hasTarget, retryConnection,
    lastPronunciation, targetText,
    practiceMode, practiceSentence, practiceProgress,
    passThreshold, stepIndex, contextBefore, contextAfter, stepNote,
    connect, disconnect, startTalking, stopTalking,
    sessionReport, sendSkipSentence, sendPrevSentence,
    finalizeSession, isTransitioning, gateMessage, pendingTarget,
    acceptPendingTarget, restartSession,
    micStream,
  } = usePushToTalk({
    sessionId,
    coachName,
    coachInstructions,
    steps: scriptSteps,
    difficulty,
    source,
    passThreshold:
      script?.pass_threshold ?? DIFFICULTY_PASS_THRESHOLDS[difficulty],
    accent,
    topic,
    l1,
    retainAudio,
  });

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set());
  // Best score per step index, so the header can mark a step passed or failed
  // rather than merely "behind the cursor".
  const [scoreByStep, setScoreByStep] = useState<Record<number, number>>({});

  const handleSkipSentence = () => {
    setSkippedSteps((prev) => new Set(prev).add(stepIndex));
    // The engine records the skip too, so the report can never present a
    // skipped step as completed.
    sendSkipSentence();
  };

  const handleCancelEvaluating = () => {
    setIsEvaluating(false);
  };

  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  useEffect(() => {
    if (lastPronunciation?.score == null) return;
    const score = lastPronunciation.score;
    setScoreHistory((prev) => [...prev, score]);
    setScoreByStep((prev) =>
      score > (prev[stepIndex] ?? -1) ? { ...prev, [stepIndex]: score } : prev
    );
    // `stepIndex` is deliberately excluded: a result always belongs to the step
    // that was current when it arrived, and re-running on a step change would
    // re-attribute the previous score to the new step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPronunciation]);

  const scoreDisplay = useMemo(() => {
    if (lastPronunciation?.score != null) {
      return lastPronunciation.score;
    }
    // Scope the fallback to the current step. Advancing clears
    // `lastPronunciation`, and the global `scoreHistory` would otherwise leak
    // the previous step's score into the new one, holding the UI in
    // "Level Complete" and keeping the mic disabled.
    return scoreByStep[stepIndex] ?? null;
  }, [lastPronunciation, scoreByStep, stepIndex]);

  const uiState = useMemo(() => {
    if (sessionReport) return "Practice Complete";
    if (isTransitioning) return "Transitioning";
    if (isEvaluating) return "Evaluating";
    if (isTalking) return "Recording";
    if (scoreDisplay !== null) {
      return scoreDisplay >= passThreshold ? "Level Complete" : "Level Failed";
    }
    return "Level Ready";
  }, [sessionReport, isTransitioning, isEvaluating, isTalking, scoreDisplay, passThreshold]);

  // Auto-advance past a passed step. `pendingTarget` is set only on a pass, so
  // the feedback for the turn just scored can stay on screen for a beat before
  // the next step reveals itself. The "Continue" button remains as a "reveal
  // now" shortcut; both paths clear the same timer so it can't double-fire.
  const pendingAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pendingTarget || sessionReport) return;
    pendingAdvanceTimerRef.current = setTimeout(() => acceptPendingTarget(), 1500);
    return () => {
      if (pendingAdvanceTimerRef.current) clearTimeout(pendingAdvanceTimerRef.current);
    };
  }, [pendingTarget, sessionReport, acceptPendingTarget]);

  const handleContinue = useCallback(() => {
    if (pendingAdvanceTimerRef.current) {
      clearTimeout(pendingAdvanceTimerRef.current);
      pendingAdvanceTimerRef.current = null;
    }
    acceptPendingTarget();
  }, [acceptPendingTarget]);

  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  // The coach's configured accent wins; the instruction sniffing below only
  // survives for coaches created before `accent` existed as a field.
  const defaultSpeechLang = useMemo(() => {
    if (accent) return accent;
    const i = (coachInstructions || "").toLowerCase();
    if (i.includes("uk") || i.includes("british")) return "en-GB";
    if (i.includes("australia")) return "en-AU";
    if (i.includes("india")) return "en-IN";
    return "en-US";
  }, [accent, coachInstructions]);

  const speechLang = selectedLang || defaultSpeechLang;

  const [activeWordKey, setActiveWordKey] = useState<string>("");

  const targetWords = useMemo(() => splitTargetToWords(targetText), [targetText]);

  useEffect(() => {
    const mis = lastPronunciation?.misaligned_words || [];
    const firstMis = mis[0]?.expected?.trim();
    if (firstMis) {
      setActiveWordKey(normalizeWord(firstMis));
    } else if (targetWords.length > 0) {
      setActiveWordKey(targetWords[0].norm);
    } else {
      setActiveWordKey("");
    }
  }, [lastPronunciation, targetText, targetWords]);

  const misExpectedNormSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of lastPronunciation?.misaligned_words || []) {
      if (p.expected) s.add(normalizeWord(p.expected));
    }
    return s;
  }, [lastPronunciation]);

  const displayWord = useMemo(() => {
    if (!activeWordKey) return targetText;
    const match = targetWords.find((w) => w.norm === activeWordKey);
    return match ? match.raw : activeWordKey;
  }, [activeWordKey, targetWords, targetText]);

  const [isMicEnabled, setIsMicEnabled] = useState(true);

  const handleStartTalking = useCallback(() => {
    if (!isMicEnabled) return;
    setIsEvaluating(false);
    startTalking();
  }, [isMicEnabled, startTalking]);

  const handleStopTalking = useCallback(() => {
    if (!isMicEnabled) return;
    const wasTalking = isTalking;
    stopTalking();
    if (wasTalking) {
      setIsEvaluating(true);
    }
  }, [isMicEnabled, stopTalking, isTalking]);

  useEffect(() => {
    if (lastPronunciation || transcriptionError) {
      setIsEvaluating(false);
    }
  }, [lastPronunciation, transcriptionError]);

  // Typed as the persisted shape, not `Record<string, unknown>`.
  //
  // This ref used to be untyped, and the entry written here used
  // `{ timestamp, overall_score }` while every reader used `{ at, score }` --
  // so the session timeline rendered "Score: 0%" for every turn and the
  // dashboard's average-accuracy maths divided NaN. An untyped bag is what let
  // the writer and the readers disagree without anyone noticing; this type is
  // the fix.
  const phonemeEntriesRef = useRef<SessionPhonemeDataPersisted["entries"]>([]);
  useEffect(() => {
    if (initialPhonemeData?.entries && Array.isArray(initialPhonemeData.entries)) {
      phonemeEntriesRef.current = [...initialPhonemeData.entries];
      for (const e of initialPhonemeData.entries) {
        if (e.turn_id) recordedTurnIdsRef.current.add(e.turn_id);
      }
    }
  }, [initialPhonemeData]);

  const appendPronunciationEntry = useCallback((payload: PronunciationResultPayload) => {
    const turnId = payload.turn_id ?? "";
    if (turnId && recordedTurnIdsRef.current.has(turnId)) return;
    if (turnId) recordedTurnIdsRef.current.add(turnId);
    const entry: SessionPhonemeDataPersisted["entries"][number] = {
      at: new Date().toISOString(),
      turn_id: payload.turn_id ?? "",
      // The server's target for the turn, not the component's current one: by
      // the time this runs the cursor may already have moved, and an entry that
      // records the wrong sentence is worse than no entry.
      target_text: payload.target_text || targetText,
      heard_text: payload.heard_text,
      score: payload.score,
      mode: practiceMode,
      feedback: payload.feedback,
      misaligned_words: payload.misaligned_words,
    };
    phonemeEntriesRef.current = [...phonemeEntriesRef.current, entry];
  }, [targetText, practiceMode]);

  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirrors the latest report for the writers below. Declared up here (before
  // flushEntries) so every persist path can include it.
  const sessionReportRef = useRef<SessionAnalysisReport | null>(null);

  /**
   * Write the entries collected so far.
   *
   * Called from the debounce, but also whenever the page is going away -- the
   * debounce window is a real gap in which a closed tab loses the last turn.
   */
  const flushEntries = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    if (phonemeEntriesRef.current.length === 0) return;
    // Report-preserving: an entries-only write that lands after the final
    // report PUT (e.g. the pagehide flush during navigation to the dashboard)
    // used to wipe the analysis. Every write carries the report once known,
    // so last-writer-wins is always safe.
    persistSession({
      id: sessionId,
      phonemeData: {
        entries: phonemeEntriesRef.current,
        ...(sessionReportRef.current
          ? { report: sessionReportRef.current }
          : {}),
      },
    });
  }, [sessionId, persistSession]);

  useEffect(() => {
    if (!lastPronunciation) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      appendPronunciationEntry(lastPronunciation);
      persistSession({
        id: sessionId,
        phonemeData: {
          entries: phonemeEntriesRef.current,
          ...(sessionReportRef.current
            ? { report: sessionReportRef.current }
            : {}),
        },
      });
    }, 2000);
    return () => { if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current); };
  }, [lastPronunciation, sessionId, persistSession, appendPronunciationEntry]);

  // Best-effort flush when the tab is hidden or closed, so the 2s debounce is
  // not the difference between keeping and losing the last attempt.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushEntries();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushEntries);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushEntries);
    };
  }, [flushEntries]);

  useSpacebarControl({ onSpaceDown: handleStartTalking, onSpaceUp: handleStopTalking, enabled: isConnected && isMicEnabled });

  useEffect(() => {
    if (isMicEnabled && !isConnected) connect();
    else if (!isMicEnabled && isConnected) disconnect();
  }, [isMicEnabled, isConnected, connect, disconnect]);

  // Warn on page unload/close — but only once there is something to lose.
  // During the initial connect there is no persisted progress yet, and the
  // browser's "leave site?" dialog there is pure friction.
  useEffect(() => {
    if (!hasTarget) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!sessionReport) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionReport, hasTarget]);

  const [leavePending, setLeavePending] = useState(false);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    sessionReportRef.current = sessionReport;
  }, [sessionReport]);

  useEffect(() => {
    if (!sessionReport) return;

    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }

    if (lastPronunciation) {
      appendPronunciationEntry(lastPronunciation);
    }

    persistSession(
      {
        id: sessionId,
        status: SessionStatus.Completed,
        endedAt: new Date().toISOString(),
        phonemeData: {
          entries: phonemeEntriesRef.current,
          report: sessionReport,
        },
      },
      {
        // Navigate away only once the report is actually stored. Leaving first
        // was how a finished session ended up saved without its analysis.
        //
        // When the report landed because the learner clicked Leave (finalize),
        // go straight to the session report — that is the analytics page they
        // asked for. Routing through the old onLeave re-marked the session
        // completed and swapped this screen for a dead-end error card once the
        // refetch saw the new status.
        onSettled: () => {
          if (leavePending) {
            router.push(`/sessions/${sessionId}`);
          }
        },
      }
    );
  }, [
    sessionReport,
    sessionId,
    lastPronunciation,
    appendPronunciationEntry,
    persistSession,
    leavePending,
    router,
  ]);

  useEffect(
    () => () => {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    },
    []
  );

  /**
   * Leave the session, but ask the server for the summary on the way out.
   *
   * Leaving used to persist the raw entries and drop the report entirely, while
   * the end-of-call screen promised a summary "shortly" that nothing would ever
   * produce. A short wait for the report fixes the promise rather than the copy.
   */
  const beginLeave = useCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    if (lastPronunciation) appendPronunciationEntry(lastPronunciation);

    const hasTurns = phonemeEntriesRef.current.length > 0;
    if (sessionReportRef.current || !hasTurns) {
      flushEntries();
      onLeave();
      return;
    }

    setLeavePending(true);
    finalizeSession();
    leaveTimeoutRef.current = setTimeout(() => {
      // The server never answered. Store what was measured and go -- an
      // unanswered request must not trap the learner on the page.
      flushEntries();
      onLeave();
    }, 6000);
  }, [
    appendPronunciationEntry,
    finalizeSession,
    flushEntries,
    lastPronunciation,
    onLeave,
  ]);

  const mainMicPress = (e: React.PointerEvent) => {
    if (!isMicEnabled) {
      setIsMicEnabled(true);
      setTimeout(() => { void handleStartTalking(); }, 300);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    void handleStartTalking();
  };
  const mainMicRelease = (e: React.PointerEvent) => {
    if (!isMicEnabled) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    handleStopTalking();
  };

  return (
    <div className="call-shell relative flex h-dvh min-h-0 flex-col overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Header */}
      <CallActiveHeader
        sessionName={sessionName}
        coachName={coachName}
        practiceProgress={practiceProgress}
        steps={scriptSteps}
        skippedSteps={skippedSteps}
        scoreByStep={scoreByStep}
        passThreshold={passThreshold}
        difficulty={difficulty}
        sourceLabel={script?.source_label ?? null}
        onLeave={requestLeave}
      />

      {fatalError ? (
        /* Retry-proof failure (free quota spent): the socket is gone for
           good, so offer the two exits that actually resolve it. */
        <FatalErrorScreen message={fatalError.message} />
      ) : !hasTarget ? (
        /* The session is not ready yet — no real target has arrived. Wait
           here instead of rendering the practice UI around a placeholder
           sentence, a phantom audio player, and disabled controls. */
        <CallConnecting
          error={transcriptionError}
          onRetry={retryConnection}
          onCancel={beginLeave}
        />
      ) : sessionReport ? (
        /* Session Complete */
        <CallActiveComplete
          sessionReport={sessionReport}
          scoreHistory={scoreHistory}
          skippedLevelsCount={skippedSteps.size}
          onRestart={() => {
            setScoreHistory([]);
            setSkippedSteps(new Set());
            setScoreByStep({});
            restartSession();
          }}
          onLeave={requestLeave}
        />
      ) : (
        /* Main Practice Area — practice grid + full-height chat rail */
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          {/* Practice column: row 1 (target + heard) above row 2 (word work).
              Below lg the whole column scrolls like an ordinary page; on lg+ it
              is a fixed grid where only the panes scroll, so the sentence the
              learner is reading never leaves the screen. */}
          <div className="call-practice flex min-w-0 flex-1 flex-col max-lg:overflow-y-auto">
            {/* Row 1: the sentence and its live feedback side by side. Below lg
                the row keeps its natural (content) height so the column
                scrolls instead of squeezing the panels; on lg+ it takes the
                leftover space and the panes inside it scroll. */}
            <div className="call-row1 relative grid shrink-0 grid-cols-1 lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-[1.1fr_1fr]">
              {/* The one authoritative score readout — straddles the row's top
                  edge, coloured against the session's own threshold. */}
              <CallActiveScorePill
                score={scoreDisplay}
                passThreshold={passThreshold}
                uiState={uiState}
              />

              {/* Target sentence (Read - Huge typography) */}
              <CallActiveSentence
                targetText={targetText}
                practiceMode={practiceMode}
                practiceSentence={practiceSentence}
                misExpectedNormSet={misExpectedNormSet}
                activeWordKey={activeWordKey}
                onWordClick={setActiveWordKey}
                isTalking={isTalking}
                isEvaluating={isEvaluating}
                micStream={micStream}
                speechLang={speechLang}
                contextBefore={contextBefore}
                contextAfter={contextAfter}
                stepNote={stepNote}
                rate={listeningRate}
              />

              {/* Feedback beside the sentence (Review) */}
              <CallActiveFeedback lastPronunciation={lastPronunciation} />
            </div>

            {/* Row 2: one bordered group — words to practise + the phonetic
                breakdown with the mouth diagram. */}
            <section className="glass-panel call-panel flex shrink-0 flex-col gap-2 rounded-2xl">
              <WrongWordsBar
                pairs={lastPronunciation?.misaligned_words}
                activeKey={activeWordKey}
                onSelectExpected={(expected, fromWrongBar) => {
                  setActiveWordKey(normalizeWord(expected));
                  if (fromWrongBar)
                    speakWord(expected, {
                      // Follows the learner's listening speed, not just Slow.
                      rate: 0.7 * listeningRate,
                      lang: speechLang,
                    });
                }}
              />
              <PronunciationReferenceCard
                displayWord={displayWord}
                activeWordKey={activeWordKey}
                lang={speechLang}
                onLangChange={setSelectedLang}
                misalignedPairs={lastPronunciation?.misaligned_words}
                rate={listeningRate}
              />
            </section>
          </div>

          {/* Chat rail — full height, coach chat only */}
          <div className="hidden lg:flex w-[360px] xl:w-[400px] shrink-0 flex-col min-h-0 py-3 pr-3">
            <CallActiveCoach
              isConnected={isConnected}
              isTalking={isTalking}
              isAISpeaking={isAISpeaking}
              streamingAIText={streamingAIText}
              isMicEnabled={isMicEnabled}
              partialTranscript={partialTranscript}
              transcripts={transcripts}
              practiceMode={practiceMode}
            />
          </div>
        </main>
      )}

      {/* Fixed bottom controls */}
      {!sessionReport && !fatalError && hasTarget && (
        <CallActiveControls
          uiState={uiState}
          isConnected={isConnected}
          isMicEnabled={isMicEnabled}
          isTalking={isTalking}
          micStream={micStream}
          isTransitioning={isTransitioning}
          isEvaluating={isEvaluating}
          transcriptionError={transcriptionError}
          conversationStatus={conversationStatus}
          onMicPress={mainMicPress}
          onMicRelease={mainMicRelease}
          onMobileTalkStart={() => {
            if (!isMicEnabled) { setIsMicEnabled(true); setTimeout(() => handleStartTalking(), 250); }
            else handleStartTalking();
          }}
          onMobileTalkStop={handleStopTalking}
          onMicToggle={() => setIsMicEnabled((c) => !c)}
          onSkip={handleSkipSentence}
          hasPendingNext={pendingTarget !== null}
          onContinue={handleContinue}
          gateMessage={gateMessage}
          onPrevLevel={sendPrevSentence}
          canGoBack={practiceProgress.current > 1}
          onCancelEvaluating={handleCancelEvaluating}
        />
      )}

      {/* Leave Confirmation Dialog */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="max-w-md bg-card border border-border shadow-xl rounded-2xl p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 border border-danger/30 text-danger">
              <PhoneOff className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Are you sure you want to leave?
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground leading-relaxed">
              Your practice progress and pronunciation analysis will be saved automatically before closing.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row items-center gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(false)}
              className="w-full sm:w-auto rounded-full px-5 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border transition-all cursor-pointer"
            >
              Stay in Call
            </button>
          <button
            type="button"
            onClick={() => {
              setShowLeaveConfirm(false);
              beginLeave();
            }}
            className="w-full sm:w-auto rounded-full px-5 py-2.5 text-xs font-bold text-primary-foreground bg-danger hover:bg-danger/90 transition-all cursor-pointer shadow-md"
          >
            Yes, Leave Call
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
};

/**
 * A failure that cannot be retried (quota spent). Rendered instead of the
 * practice area: with no socket there is nothing to practise, and the old
 * "Reconnecting…" banner hid the one message that explained why.
 */
function FatalErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-warning/30 bg-warning/10 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-warning/40 bg-card text-warning">
          <CreditCardIcon className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-foreground">
            Session limit reached
          </h2>
          <p className="text-sm text-warning/80">{message}</p>
        </div>
        <div className="flex flex-col-reverse items-center justify-center gap-2 pt-1 sm:flex-row">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary"
          >
            <ListIcon className="h-4 w-4" />
            Back to sessions
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover"
          >
            <CreditCardIcon className="h-4 w-4" />
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
