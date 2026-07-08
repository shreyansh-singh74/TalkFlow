"use client";

import { LoadingState } from "@/components/loading-state";
import { PhonemeDetailsPanel } from "@/components/phoneme-details-panel";
import { SentencePhonemeAnalysis } from "@/hooks/use-phoneme-analysis";
import { useMeeting, useDeleteMeeting } from "@/hooks/use-api";
import { MeetingIdViewHeader } from "../components/meeting-id-view-header";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/use-confirm";
import { UpdateMeetingDialog } from "../components/update-meeting-dialog";
import { useState } from "react";
import { UpcomingState } from "../components/upcoming-state";
import { ActiveState } from "../components/active-state";
import { CancelledState } from "../components/cancelled-state";
import { ProcessingState } from "../components/processing-state";
import { toast } from "sonner";
import type { MeetingPhonemeDataPersisted } from "@/types/pronunciation";

function isSentencePhonemeAnalysis(value: unknown): value is SentencePhonemeAnalysis {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.sentence === "string" &&
    Array.isArray(v.words) &&
    typeof v.overall_accuracy === "number" &&
    Array.isArray(v.problematic_phonemes) &&
    Array.isArray(v.mastered_phonemes) &&
    Array.isArray(v.most_common_errors)
  );
}

function isPersistedPronunciationEntries(
  value: unknown
): value is { entries: Array<{ target_text: string; heard_text: string; score: number; at: string }> } {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.entries)) return false;
  return v.entries.length === 0 || (typeof (v.entries[0] as { score?: number }).score === "number");
}

interface Props {
  meetingId: string;
}

export const MeetingIdView = ({ meetingId }: Props) => {
  const router = useRouter();
  const { data, isLoading, error } = useMeeting(meetingId);
  const [updateMeetingDialogOpen, setUpdateMeetingDialogOpen] = useState(false);
  const removeMeeting = useDeleteMeeting();

  // Always call hooks unconditionally at the top-level
  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure?",
    "The following action will remove this meeting"
  );

  if (isLoading) {
    return <LoadingState title="Loading Meeting" description="This may take a few seconds" />;
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Failed to Load Meeting</h2>
          <p className="text-gray-600">Could not load the meeting details. Please try again.</p>
        </div>
      </div>
    );
  }

  // removeMeeting is already defined above with useDeleteMeeting

  const handleRemoveMeeting = async () => {
    const ok = await confirmRemove();
    if (!ok) {
      return;
    }
    removeMeeting.mutate(meetingId, {
      onSuccess: () => {
        toast.success("Meeting deleted successfully");
        router.push("/dashboard/meetings");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete meeting");
      },
    });
  };

  const isActive = data.status === "active";
  const isUpcoming = data.status === "upcoming";
  const isCancelled = data.status === "cancelled";
  const isCompleted = data.status === "completed";
  const isProcessing = data.status === "processing";

  return (
    <>
      <RemoveConfirmation />
      <UpdateMeetingDialog
        open={updateMeetingDialogOpen}
        onOpenChange={setUpdateMeetingDialogOpen}
        initialValues={data}
      />
      <div className="flex-1 py-4 px-4 md:px-8 flex flex-col gap-y-4">
        <MeetingIdViewHeader
          meetingId={meetingId}
          meetingName={data.name}
          onEdit={() => setUpdateMeetingDialogOpen(true)}
          onRemove={handleRemoveMeeting}
        />
        {isCancelled && <CancelledState />}
        {isProcessing && <ProcessingState />}
        {isActive && <ActiveState meetingId={meetingId} />}
        {isUpcoming && (
          <UpcomingState
            meetingId={meetingId}
            onCancelMeeting={() => {}}
            isCancelling={false}
          />
        )}
        {isCompleted && (
          <div className="space-y-4">
            {isSentencePhonemeAnalysis(data.phonemeData) ? (
              <PhonemeDetailsPanel analysis={data.phonemeData} />
            ) : isPersistedPronunciationEntries(data.phonemeData) && data.phonemeData.entries.length > 0 ? (
              <div className="rounded-lg border bg-white p-6 text-left text-gray-800">
                <p className="font-medium mb-3">Pronunciation history</p>
                <ul className="space-y-3 text-sm">
                  {data.phonemeData.entries.map((e: MeetingPhonemeDataPersisted["entries"][number]) => (
                    <li
                      key={`${e.at}-${e.target_text}`}
                      className="border-b border-gray-100 pb-2 last:border-0"
                    >
                      <p>
                        <span className="text-gray-500">Target:</span> {e.target_text}
                      </p>
                      <p>
                        <span className="text-gray-500">Heard:</span> {e.heard_text}
                      </p>
                      <p className="text-gray-600">Score: {e.score.toFixed(0)}%</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-6 text-center text-gray-600">
                <p className="font-medium">Meeting completed</p>
                <p className="text-sm mt-1">No pronunciation analysis is available for this session.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export const MeetingsViewLoading = () => {
  return (
    <LoadingState
      title="Loading Meetings"
      description="This may take few seconds"
    />
  );
};
