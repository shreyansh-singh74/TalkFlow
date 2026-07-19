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
import { useUpdateMeeting } from "@/hooks/use-api";
import { MeetingStatus } from "@/modules/meetings/types";
import type {
  MeetingPhonemeDataPersisted,
  PronunciationResultPayload,
} from "@/types/pronunciation";

import { CallActiveHeader } from "./call-active-header";
import { CallActiveControls } from "./call-active-controls";
import { CallActiveCoach } from "./call-active-coach";
import { CallActiveComplete } from "./call-active-complete";
import { CallActiveSentence } from "./call-active-sentence";
import { CallActiveFeedback } from "./call-active-feedback";

interface Props {
  onLeave: () => void;
  meetingName: string;
  meetingId: string;
  agentName: string;
  agentInstructions: string;
  initialPhonemeData?: MeetingPhonemeDataPersisted | null;
}

export const CallActive = ({
  onLeave,
  meetingName,
  meetingId,
  agentName,
  agentInstructions,
  initialPhonemeData,
}: Props) => {
  const updateMeeting = useUpdateMeeting();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const {
    isConnected, isTalking, isAISpeaking, transcripts, partialTranscript,
    streamingAIText, conversationStatus, error: transcriptionError,
    lastPronunciation, targetText,
    practiceMode, practiceSentence, practiceProgress,
    connect, disconnect, startTalking, stopTalking,
    sessionReport, sendNextSentence, sendPrevSentence, isTransitioning, restartSession,
  } = usePushToTalk({ meetingId, agentName, agentInstructions });

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [skippedLevels, setSkippedLevels] = useState<Set<number>>(new Set());

  const handleSkipSentence = () => {
    setSkippedLevels((prev) => {
      const next = new Set(prev);
      next.add(practiceProgress.current);
      return next;
    });
    sendNextSentence();
  };

  const handleCancelEvaluating = () => {
    setIsEvaluating(false);
  };

  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  useEffect(() => {
    if (lastPronunciation?.score != null) {
      setScoreHistory((prev) => [...prev, lastPronunciation.score]);
    }
  }, [lastPronunciation]);

  const scoreDisplay = useMemo(() => {
    if (lastPronunciation?.score != null) {
      return lastPronunciation.score;
    }
    if (scoreHistory.length > 0) {
      return scoreHistory[scoreHistory.length - 1];
    }
    return null;
  }, [lastPronunciation, scoreHistory]);

  const uiState = useMemo(() => {
    if (sessionReport) return "Practice Complete";
    if (isTransitioning) return "Transitioning";
    if (isEvaluating) return "Evaluating";
    if (isTalking) return "Recording";
    if (scoreDisplay !== null) {
      return scoreDisplay >= 95 ? "Level Complete" : "Level Failed";
    }
    return "Level Ready";
  }, [sessionReport, isTransitioning, isEvaluating, isTalking, scoreDisplay]);

  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  const defaultSpeechLang = useMemo(() => {
    const i = (agentInstructions || "").toLowerCase();
    if (i.includes("uk") || i.includes("british")) return "en-GB";
    if (i.includes("australia")) return "en-AU";
    if (i.includes("india")) return "en-IN";
    return "en-US";
  }, [agentInstructions]);

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
    stopTalking();
    setIsEvaluating(true);
  }, [isMicEnabled, stopTalking]);

  useEffect(() => {
    if (lastPronunciation || transcriptionError) {
      setIsEvaluating(false);
    }
  }, [lastPronunciation, transcriptionError]);

  const phonemeEntriesRef = useRef<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    if (initialPhonemeData?.entries && Array.isArray(initialPhonemeData.entries)) {
      phonemeEntriesRef.current = [...initialPhonemeData.entries];
    }
  }, [initialPhonemeData]);

  const appendPronunciationEntry = useCallback((payload: PronunciationResultPayload) => {
    const entry = {
      timestamp: new Date().toISOString(),
      target_text: targetText,
      heard_text: payload.heard_text,
      overall_score: payload.score,
      misaligned_words: payload.misaligned_words,
      feedback: payload.feedback,
    };
    phonemeEntriesRef.current = [...phonemeEntriesRef.current, entry];
  }, [targetText]);

  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastPronunciation) return;
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      appendPronunciationEntry(lastPronunciation);
      updateMeeting.mutate({ id: meetingId, phonemeData: { entries: phonemeEntriesRef.current } });
    }, 2000);
    return () => { if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current); };
  }, [lastPronunciation, meetingId, updateMeeting, appendPronunciationEntry]);

  useSpacebarControl({ onSpaceDown: handleStartTalking, onSpaceUp: handleStopTalking, enabled: isConnected && isMicEnabled });

  useEffect(() => {
    if (isMicEnabled && !isConnected) connect();
    else if (!isMicEnabled && isConnected) disconnect();
  }, [isMicEnabled, isConnected, connect, disconnect]);

  // Warn on page unload/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!sessionReport) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionReport]);

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
      });
    }
  }, [sessionReport, meetingId, lastPronunciation, appendPronunciationEntry, updateMeeting]);

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
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      {/* Header */}
      <CallActiveHeader
        meetingName={meetingName}
        agentName={agentName}
        practiceProgress={practiceProgress}
        skippedLevels={skippedLevels}
        lastScore={scoreDisplay}
        onLeave={() => setShowLeaveConfirm(true)}
      />

      {sessionReport ? (
        /* Session Complete */
        <CallActiveComplete
          sessionReport={sessionReport}
          scoreHistory={scoreHistory}
          skippedLevelsCount={skippedLevels.size}
          onRestart={() => {
            setScoreHistory([]);
            setSkippedLevels(new Set());
            restartSession();
          }}
          onLeave={() => setShowLeaveConfirm(true)}
        />
      ) : (
        /* Main Practice Area — two columns */
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left column: Target + Feedback + Pronunciation Reference */}
          <div className="flex flex-1 flex-col min-h-0 overflow-y-auto px-6 py-6 gap-6 items-center">
            <div className="w-full max-w-3xl flex flex-col items-center gap-6">
              {/* Target sentence (Read - Huge typography) */}
              <CallActiveSentence
                targetText={targetText}
                practiceMode={practiceMode}
                practiceSentence={practiceSentence}
                misExpectedNormSet={misExpectedNormSet}
                activeWordKey={activeWordKey}
                onWordClick={setActiveWordKey}
                isTalking={isTalking}
              />

              {/* Feedback directly below sentence (Review) */}
              <CallActiveFeedback
                lastPronunciation={lastPronunciation}
                scoreDisplay={scoreDisplay}
              />

              {/* Wrong words bar */}
              <WrongWordsBar
                pairs={lastPronunciation?.misaligned_words}
                activeKey={activeWordKey}
                onSelectExpected={(expected, fromWrongBar) => {
                  setActiveWordKey(normalizeWord(expected));
                  if (fromWrongBar) speakWord(expected, { rate: 0.7, lang: speechLang });
                }}
              />

              {/* Pronunciation reference card */}
              <PronunciationReferenceCard
                displayWord={displayWord}
                activeWordKey={activeWordKey}
                lang={speechLang}
                onLangChange={setSelectedLang}
                misalignedPairs={lastPronunciation?.misaligned_words}
              />
            </div>
          </div>

          {/* Right column: Coach panel — flush 420px sidebar */}
          <div className="hidden lg:flex w-[420px] xl:w-[450px] shrink-0 h-full">
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
        </div>
      )}

      {/* Fixed bottom controls */}
      {!sessionReport && (
        <CallActiveControls
          uiState={uiState}
          isMicEnabled={isMicEnabled}
          isTalking={isTalking}
          isTransitioning={isTransitioning}
          isEvaluating={isEvaluating}
          scoreDisplay={scoreDisplay}
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
          onNextLevel={sendNextSentence}
          onPrevLevel={sendPrevSentence}
          canGoBack={practiceProgress.current > 1}
          onCancelEvaluating={handleCancelEvaluating}
        />
      )}

      {/* Leave Confirmation Dialog */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="max-w-md bg-white border border-neutral-200 shadow-xl rounded-2xl p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-200 text-red-600">
              <PhoneOff className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-neutral-900">
              Are you sure you want to leave?
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-neutral-600 leading-relaxed">
              Your practice progress and pronunciation analysis will be saved automatically before closing.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row items-center gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowLeaveConfirm(false)}
              className="w-full sm:w-auto rounded-full px-5 py-2.5 text-xs font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-all cursor-pointer"
            >
              Stay in Call
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLeaveConfirm(false);
                handleLeaveWithPersist();
              }}
              className="w-full sm:w-auto rounded-full px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all cursor-pointer shadow-md"
            >
              Yes, Leave Call
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
