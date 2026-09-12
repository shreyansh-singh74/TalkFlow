"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { usePracticeSession, useDeletePracticeSession } from "@/hooks/use-api";
import { SessionIdViewHeader } from "../components/session-id-view-header";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/use-confirm";
import { UpdateSessionDialog } from "../components/update-session-dialog";
import { useState } from "react";
import { UpcomingState } from "../components/upcoming-state";
import { ActiveState } from "../components/active-state";
import { CancelledState } from "../components/cancelled-state";
import { toast } from "sonner";
import type { SessionPhonemeDataPersisted, SessionAnalysisReport } from "@/types/pronunciation";
import Link from "next/link";
import { Bot, CheckCircle2, Sparkles, AlertCircle, Volume2 } from "lucide-react";

interface Props {
  sessionId: string;
}

export const SessionIdView = ({ sessionId }: Props) => {
  const router = useRouter();
  const { data, isLoading, error } = usePracticeSession(sessionId);
  const [updateSessionDialogOpen, setUpdateSessionDialogOpen] = useState(false);
  const removeSession = useDeletePracticeSession();

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure?",
    "The following action will remove this session"
  );

  if (isLoading) {
    return <SessionsViewLoading />;
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Failed to Load Practice Session</h2>
          <p className="text-gray-600">Could not load session details. Please try again.</p>
        </div>
      </div>
    );
  }

  const handleRemoveSession = async () => {
    const ok = await confirmRemove();
    if (!ok) return;
    removeSession.mutate(sessionId, {
      onSuccess: () => {
        toast.success("Session deleted successfully");
        router.push("/sessions");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete session");
      },
    });
  };

  const isActive = data.status === "active";
  const isUpcoming = data.status === "upcoming";
  const isCancelled = data.status === "cancelled";
  const isCompleted = data.status === "completed";

  const phonemeData = data.phonemeData as SessionPhonemeDataPersisted | null;
  const entries = phonemeData?.entries || [];
  const report: SessionAnalysisReport | undefined = phonemeData?.report;

  // Stress, rhythm and pitch, only where something was measured.
  const prosodyNotes: string[] = [];
  if (report) {
    for (const syllable of report.stress_mistakes ?? []) {
      prosodyNotes.push(
        `Lost the stress on “${syllable}” — the stressed syllable should be the loudest and longest.`
      );
    }
    for (const syllable of report.syllable_mistakes ?? []) {
      prosodyNotes.push(
        `Added stress to “${syllable}” — this syllable should be unstressed.`
      );
    }
    for (const issue of report.intonation_issues ?? []) {
      prosodyNotes.push(issue);
    }
  }

  const reportStats: Array<{ label: string; value: string }> = [];
  if (report) {
    if (report.accuracy_score !== null) {
      reportStats.push({ label: "Accuracy", value: `${Math.round(report.accuracy_score)}%` });
    }
    if (report.fluency_score !== null) {
      reportStats.push({ label: "Consistency", value: `${Math.round(report.fluency_score)}%` });
    }
    if (report.wpm !== null) {
      reportStats.push({ label: "Speaking Speed", value: `${Math.round(report.wpm)} WPM` });
    }
    reportStats.push({
      label: "Steps Completed",
      value: `${report.sentences_completed}/${report.sentences_total ?? report.sentences_completed}`,
    });
  }

  return (
    <>
      <RemoveConfirmation />
      <UpdateSessionDialog
        open={updateSessionDialogOpen}
        onOpenChange={setUpdateSessionDialogOpen}
        initialValues={data}
      />
      <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-6 max-w-6xl mx-auto w-full">
        <SessionIdViewHeader
          sessionId={sessionId}
          sessionName={data.name}
          onEdit={() => setUpdateSessionDialogOpen(true)}
          onRemove={handleRemoveSession}
        />
        {isCancelled && <CancelledState />}
        {isActive && <ActiveState sessionId={sessionId} />}
        {isUpcoming && (
          <UpcomingState
            sessionId={sessionId}
            onCancelSession={() => {}}
            isCancelling={false}
          />
        )}

        {isCompleted && (
          <div className="space-y-6 animate-fade-in">
            {/* Report Header Card */}
            {report ? (
              <div className="rounded-2xl border border-emerald-100 bg-linear-to-br from-emerald-50/50 via-white to-teal-50/30 p-6 md:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Session Complete
                      </span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-gray-900">AI Speech Performance Analysis</h2>
                    <p className="text-sm text-gray-500 mt-1">Generated by TalkFlow AI Coach</p>
                  </div>

                  {/* Overall Score Badge — omitted when nothing was scored */}
                  {report.overall_score !== null && (
                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
                      <div className="text-right">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Overall Score</p>
                        <p className="text-3xl font-black text-emerald-600">{Math.round(report.overall_score)}%</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Score breakdown — only metrics that were actually measured.
                    A null on the report means the scorer behind it was off or
                    had no data, so the tile is omitted rather than filled in. */}
                {reportStats.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
                    {reportStats.map((stat) => (
                      <div key={stat.label} className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-gray-100 text-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{stat.label}</span>
                        <p className="text-xl font-bold text-gray-800 mt-1">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Steps left behind without passing. Stated separately so the
                    "Steps Completed" tile can't be read as "all of them". */}
                {(report.steps_skipped ?? 0) > 0 && (
                  <p className="pb-4 text-xs font-semibold text-amber-700">
                    {report.steps_skipped} step
                    {report.steps_skipped === 1 ? " was" : "s were"} skipped — not
                    counted as completed.
                  </p>
                )}

                {/* Sounds that actually gave trouble, from per-phone data */}
                {(report.phone_breakdown ?? []).length > 0 && (
                  <div className="pb-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      Sounds to work on
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(report.phone_breakdown ?? []).slice(0, 6).map((entry) => (
                        <span
                          key={entry.phone}
                          title={`${entry.observations} attempts · ${Math.round(entry.error_rate * 100)}% wrong`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                        >
                          <span className="font-mono">{entry.phone}</span>
                          <span className="tabular-nums font-normal text-amber-700">
                            {Math.round(entry.avg_accuracy)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suprasegmentals. Each line comes from a measured contour,
                    pause or prominence pattern; a session where those scorers
                    produced nothing shows no panel at all. */}
                {prosodyNotes.length > 0 && (
                  <div className="pb-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                      Rhythm &amp; melody
                    </p>
                    <ul className="space-y-1">
                      {prosodyNotes.map((note) => (
                        <li
                          key={note}
                          className="flex items-start gap-2 text-sm text-gray-700"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI Coach Summary text */}
                {report.coach_feedback && (
                  <div className="bg-white p-5 rounded-xl border border-emerald-100 text-gray-700 text-sm leading-relaxed italic relative">
                    <div className="flex items-center gap-2 mb-2 not-italic font-bold text-xs uppercase tracking-wider text-emerald-700">
                      <Bot className="w-4 h-4" />
                      Coach Feedback
                    </div>
                    &ldquo;{report.coach_feedback}&rdquo;
                  </div>
                )}
              </div>
            ) : entries.length === 0 ? (
              /* Nothing was measured.

                 This used to be a spinning "Analysis & Transcript Getting
                 Ready -- refresh in a few seconds" card, which was a lie twice
                 over: nothing was being processed, and refreshing never
                 resolved it. A session that ended without a scored turn really
                 does have nothing to report, and saying so is the correct
                 answer. */
              <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-8 text-center space-y-3">
                <div className="inline-flex items-center justify-center p-3 bg-white rounded-full text-gray-500 mb-2 border border-gray-200">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  No turns were scored in this session
                </h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  The session ended before you spoke a full step, so there is
                  nothing to measure yet. Nothing is shown rather than a
                  placeholder score.
                </p>
                <Link
                  href={`/call/${sessionId}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Volume2 className="w-4 h-4" />
                  Practise this session
                </Link>
              </div>
            ) : null}

            {/* Turn-by-Turn Practice Transcript Timeline */}
            {entries.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-xs">
                <h3 className="text-lg font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-emerald-600" />
                  Practice Transcript & Turn Analysis ({entries.length} turns)
                </h3>
                <div className="divide-y divide-gray-100">
                  {entries.map((e, index) => {
                    const score = e.score ?? 0;
                    return (
                      <div key={index} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Sentence #{index + 1}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${score >= 90 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            Score: {Math.round(score)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <span className="text-xs font-semibold text-gray-500 block mb-1">Target Sentence:</span>
                            <span className="font-semibold text-gray-900">{e.target_text}</span>
                          </div>
                          <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                            <span className="text-xs font-semibold text-emerald-700 block mb-1">Heard Speech:</span>
                            <span className="font-semibold text-gray-900">{e.heard_text || "(Silence / Unclear)"}</span>
                          </div>
                        </div>

                        {/* Misaligned words / feedback */}
                        {e.misaligned_words && e.misaligned_words.length > 0 && (
                          <div className="flex items-center gap-2 text-xs text-amber-800 pt-1">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Needs practice on: {e.misaligned_words.map(w => w.expected).join(", ")}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export const SessionsViewLoading = () => {
  return (
    <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <div className="rounded-2xl border p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-20 w-36 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
      <div className="rounded-2xl border p-6 md:p-8 space-y-4">
        <Skeleton className="h-6 w-64" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 border-b last:border-0 pb-4">
            <Skeleton className="h-4 w-28" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-16 rounded-lg" />
              <Skeleton className="h-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
