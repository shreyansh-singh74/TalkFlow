"use client";

import { useMeeting, useMeetings } from "@/hooks/use-api";
import { MeetingStatus } from "@/modules/meetings/types";
import { useRouter } from "next/navigation";
import { ChevronLeft, Share2, Printer, AlertTriangle, ShieldCheck, Activity, Sparkles } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useMemo } from "react";

// Types matching persisted structure
interface PersistedReport {
  overall_score: number;
  fluency_score: number;
  clarity_score: number;
  confidence_score: number;
  accuracy_score: number;
  words_spoken: number;
  wpm: number;
  avg_pause_duration: number;
  longest_pause: number;
  total_speaking_time: number;
  mispronounced_words: string[];
  difficult_sounds: string[];
  stress_mistakes: string[];
  syllable_mistakes: string[];
  intonation_issues: string[];
  strengths: string[];
  areas_to_improve: string[];
  coach_feedback: string;
}

interface CompletedMeeting {
  id: string;
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  phonemeData?: {
    entries?: Array<{
      at: string;
      turn_id: string;
      target_text: string;
      heard_text: string;
      score: number;
      feedback: string[];
    }>;
    report?: PersistedReport;
  };
  agent?: {
    name: string;
  };
}

export const AnalysisSessionView = ({ meetingId }: { meetingId: string }) => {
  const router = useRouter();

  // Fetch target session details
  const { data: sessionData, isLoading: isSessionLoading, error: sessionError } = useMeeting(meetingId);

  // Fetch other sessions to calculate relative progress improvements
  const { data: allSessionsData } = useMeetings({
    status: MeetingStatus.Completed,
    pageSize: 100,
  });

  const session = sessionData as CompletedMeeting | undefined;
  const report = session?.phonemeData?.report;

  // Process historical progress tracking
  const progressTracking = useMemo(() => {
    if (!session || !report || !allSessionsData || !allSessionsData.items) return null;

    const completed = (allSessionsData.items as CompletedMeeting[]).filter(
      (m) => m.phonemeData?.report !== undefined && m.id !== session.id
    );

    if (completed.length === 0) return null;

    // Filter sessions older than current one
    const currentStart = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const olderSessions = completed.filter((m) => {
      const start = m.startedAt ? new Date(m.startedAt).getTime() : 0;
      return start < currentStart;
    });

    if (olderSessions.length === 0) return null;

    // Sort older sessions to find the immediate previous one
    olderSessions.sort((a, b) => {
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeB - timeA;
    });

    const previousSession = olderSessions[0];
    const prevReport = previousSession.phonemeData!.report!;

    const accuracyDiff = report.overall_score - prevReport.overall_score;
    const fluencyDiff = report.fluency_score - prevReport.fluency_score;

    // Track repeated mispronounced words
    const currentMis = new Set((report.mispronounced_words || []).map((w) => w.toLowerCase()));
    const prevMis = new Set((prevReport.mispronounced_words || []).map((w) => w.toLowerCase()));

    const recurringMistakes = Array.from(currentMis).filter((w) => prevMis.has(w));
    const correctedMistakes = Array.from(prevMis).filter((w) => !currentMis.has(w));

    return {
      accuracyDiff: Math.round(accuracyDiff),
      fluencyDiff: Math.round(fluencyDiff),
      previousSessionDate: previousSession.startedAt
        ? new Date(previousSession.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : "previous run",
      recurringMistakes: recurringMistakes.slice(0, 4),
      correctedMistakes: correctedMistakes.slice(0, 4),
    };
  }, [session, report, allSessionsData]);

  if (isSessionLoading) {
    return <LoadingState title="Loading Report" description="Compiling Otter analytics..." />;
  }

  if (sessionError || !session) {
    return (
      <div className="p-8">
        <ErrorState
          title="Session Report Not Found"
          description={sessionError?.message || "Ensure you completed all 10 sentences to save reports."}
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-[70vh]">
        <div className="max-w-md bg-white border border-gray-100 p-8 rounded-2xl shadow-xs">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-2">No Post-Session Summary Ready</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            This session is not fully analyzed. Ensure you practice all 10 sentences and let the session complete to see the coach analytics.
          </p>
          <button
            onClick={() => router.push("/dashboard/analysis")}
            className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg shadow-sm hover:brightness-105 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const sessionDate = session.startedAt
    ? new Date(session.startedAt).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  // Helper to highlight mispronounced words in a sentence
  const renderHighlightedSentence = (target: string, heard: string, feedback: string[]) => {
    const targetWords = target.split(/\s+/);
    const heardClean = heard.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const heardWords = new Set(heardClean.split(/\s+/));

    // Also parse from feedback strings if they contain mispronounced word tags
    const feedbackLower = feedback.map(f => f.toLowerCase());

    return (
      <p className="text-sm leading-relaxed font-medium text-gray-700 mt-2">
        {targetWords.map((word, idx) => {
          const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
          
          // Determine mismatch
          const isMissing = !heardWords.has(cleanWord) && heardWords.size > 0;
          const hasFeedbackMismatch = feedbackLower.some(f => f.includes(cleanWord));
          const isMispronounced = isMissing || hasFeedbackMismatch;

          return (
            <span
              key={idx}
              className={cn(
                "inline-block mr-1.5 px-0.5 rounded-sm transition-colors",
                isMispronounced
                  ? "bg-red-50 text-red-600 border-b-2 border-red-300 font-semibold"
                  : "text-gray-800"
              )}
              title={isMispronounced ? "Mispronounced or skipped word" : undefined}
            >
              {word}
            </span>
          );
        })}
      </p>
    );
  };

  const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(" ");

  return (
    <div className="flex-1 py-6 px-4 md:px-8 space-y-6 max-w-7xl mx-auto w-full print:bg-white print:p-0">
      {/* Action Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-gray-100 p-6 rounded-2xl shadow-xs print:hidden">
        <button
          onClick={() => router.push("/dashboard/analysis")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-all shadow-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Report link copied to clipboard!");
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-gray-200 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-all shadow-xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Report
          </button>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
              {session.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              <span className="font-semibold text-primary">{session.agent?.name || "TalkFlow Coach"}</span>
              <span>•</span>
              <span>{sessionDate}</span>
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-center bg-gray-50 border border-gray-100 px-5 py-3 rounded-2xl">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Session Duration</p>
              <h4 className="text-lg font-bold text-gray-800 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                {Math.ceil((report.total_speaking_time || 45) / 60)} mins
              </h4>
            </div>

            <div className="text-center bg-emerald-50/50 border border-emerald-100 px-6 py-3 rounded-2xl">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">Overall score</p>
              <h4 className="text-2xl font-black text-emerald-600 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                {Math.round(report.overall_score)}%
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Progress tracker section */}
      {progressTracking && (
        <div className="bg-white border border-primary/20 bg-primary/2 rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
              Historical Progress Comparison
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed max-w-2xl">
              Your pronunciation accuracy improved by{" "}
              <span className="font-semibold text-emerald-600">
                {progressTracking.accuracyDiff >= 0 ? `+${progressTracking.accuracyDiff}%` : `${progressTracking.accuracyDiff}%`}
              </span>{" "}
              since your session on {progressTracking.previousSessionDate}.
              {progressTracking.correctedMistakes.length > 0 && (
                <>
                  {" "}
                  You have corrected pronunciation on words like:{" "}
                  <span className="font-medium text-emerald-600">
                    {progressTracking.correctedMistakes.join(", ")}
                  </span>.
                </>
              )}
              {progressTracking.recurringMistakes.length > 0 && (
                <>
                  {" "}
                  However, you still struggle with recurring stress/sounds in:{" "}
                  <span className="font-medium text-amber-600">
                    {progressTracking.recurringMistakes.join(", ")}
                  </span>.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* AI Coach Feedback Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Paragraph summary */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs lg:col-span-2 space-y-4">
          <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            AI Coach Personal Summary
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed italic">
            &ldquo;{report.coach_feedback}&rdquo;
          </p>
        </div>

        {/* Strengths / Improve bullet lists */}
        <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase flex items-center gap-1.5">
            <Activity className="h-5 w-5 text-primary" />
            Coaching Highlights
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest mb-1.5">Strengths</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4 leading-relaxed">
                {(report.strengths || []).map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-1.5">Areas to Improve</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4 leading-relaxed">
                {(report.areas_to_improve || []).map((a, idx) => (
                  <li key={idx}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Speaking & Pronunciation metrics Grid */}
      <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-xs space-y-6">
        <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase">
          Speaking & Acoustic Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: "Fluency", val: `${Math.round(report.fluency_score)}%`, sub: "Speech pacing" },
            { label: "Clarity", val: `${Math.round(report.clarity_score)}%`, sub: "Sound distinction" },
            { label: "Confidence", val: `${Math.round(report.confidence_score)}%`, sub: "Assertiveness score" },
            { label: "Speaking Speed", val: `${Math.round(report.wpm)} WPM`, sub: "Words per minute" },
            { label: "Avg Pause", val: `${(report.avg_pause_duration || 0.6).toFixed(1)}s`, sub: "Silence gap avg" },
            { label: "Longest Pause", val: `${(report.longest_pause || 1.3).toFixed(1)}s`, sub: "Peak pause length" },
          ].map((m, idx) => (
            <div key={idx} className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-center">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{m.label}</p>
              <h4 className="text-lg font-bold text-gray-800 mt-1" style={{ fontFamily: "var(--font-display)" }}>{m.val}</h4>
              <p className="text-[9px] text-gray-400 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed sound issues analyses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Difficult Sounds</p>
          <div className="flex flex-wrap gap-1.5">
            {(report.difficult_sounds || []).map((s, idx) => (
              <span key={idx} className="px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-md border border-red-100">
                {s}
              </span>
            ))}
            {(!report.difficult_sounds || report.difficult_sounds.length === 0) && (
              <span className="text-xs text-gray-400 italic">None detected</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Stress Errors</p>
          <div className="flex flex-wrap gap-1.5">
            {(report.stress_mistakes || []).map((s, idx) => (
              <span key={idx} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-md border border-amber-100">
                {s}
              </span>
            ))}
            {(!report.stress_mistakes || report.stress_mistakes.length === 0) && (
              <span className="text-xs text-gray-400 italic">None detected</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Intonation Issues</p>
          <div className="flex flex-wrap gap-1.5">
            {(report.intonation_issues || []).map((s, idx) => (
              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-md border border-blue-100">
                {s}
              </span>
            ))}
            {(!report.intonation_issues || report.intonation_issues.length === 0) && (
              <span className="text-xs text-gray-400 italic">None detected</span>
            )}
          </div>
        </div>
      </div>

      {/* Sentence breakdown logs */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase">
            Sentence-by-Sentence Breakdown
          </h3>
        </div>

        <div className="divide-y divide-gray-100">
          {(session.phonemeData?.entries || []).map((entry, idx) => (
            <div key={idx} className="p-6 hover:bg-gray-50/30 transition-colors">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1.5 flex-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Sentence {idx + 1}
                  </p>
                  
                  {/* Target text with highlights */}
                  {renderHighlightedSentence(entry.target_text, entry.heard_text, entry.feedback)}

                  <div className="mt-3 bg-gray-50/70 rounded-lg p-3 text-xs border border-gray-100/50">
                    <p className="text-gray-500 font-medium">Heard attempt:</p>
                    <p className="text-gray-800 mt-1 italic">
                      &ldquo;{entry.heard_text || "—"}&rdquo;
                    </p>
                    {entry.feedback && entry.feedback.length > 0 && (
                      <div className="mt-2 text-[11px] text-gray-600 flex flex-col gap-1">
                        <span className="font-semibold text-primary">Phonetic coach mismatch details:</span>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {entry.feedback.map((f, fIdx) => (
                            <li key={fIdx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                    entry.score >= 95
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  )}>
                    {Math.round(entry.score)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
