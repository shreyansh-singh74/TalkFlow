"use client";

import { LoadingState } from "@/components/loading-state";
import { useMeeting, useDeleteMeeting } from "@/hooks/use-api";
import { MeetingIdViewHeader } from "../components/meeting-id-view-header";
import { useRouter } from "next/navigation";
import { useConfirm } from "../../hooks/use-confirm";
import { UpdateMeetingDialog } from "../components/update-meeting-dialog";
import { useState } from "react";
import { UpcomingState } from "../components/upcoming-state";
import { ActiveState } from "../components/active-state";
import { CancelledState } from "../components/cancelled-state";
import { ProcessingState } from "../components/processing-state";
import { toast } from "sonner";

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

  // Handle success and error for delete
  if (removeMeeting.isSuccess) {
    router.push("/meetings");
    toast.success("Meeting deleted successfully");
  }
  if (removeMeeting.isError) {
    toast.error(removeMeeting.error?.message || "Failed to delete meeting");
  }

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
    await removeMeeting.mutateAsync({ id: meetingId });
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
        {isCompleted && <div>Completed</div>}
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
