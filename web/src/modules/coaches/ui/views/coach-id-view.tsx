"use client";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useCoach, useDeleteCoach } from "@/hooks/use-api";
import { CoachIdViewHeader } from "../components/coach-id-view-header";
import { NameAvatar } from "@/components/name-avatar";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { useState } from "react";
import { UpdateCoachDialog } from "../components/update-coach-dialog";

interface Props {
  coachId: string;
}

export const CoachIdView = ({ coachId }: Props) => {
  const [updateCoachDialogOpen,setUpdateCoachDialogOpen] = useState(false);
  const router = useRouter();
  const { data, isLoading, error } = useCoach(coachId);
  const removeCoach = useDeleteCoach();

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure",
    `The following action will remove ${data?.sessionCount} associated sessions`
  );

  const handleRemoveCoach = async () => {
    const ok = await confirmRemove();

    if (!ok) return;

    removeCoach.mutate(coachId, {
      onSuccess: () => {
        toast.success("Coach deleted successfully");
        router.push("/dashboard/coaches");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete coach");
      },
    });
  };

  if (isLoading) {
    return <CoachesIdViewLoading />;
  }

  if (error) {
    return (
      <ErrorState
        title="Coach Not Found"
        description={
          error.message ||
          "The coach you're looking for doesn't exist or you don't have access to it."
        }
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Coach Not Found"
        description="The coach you're looking for doesn't exist."
      />
    );
  }

  return (
    <>
      <RemoveConfirmation />
      <UpdateCoachDialog 
        open={updateCoachDialogOpen}
        onOpenChange={setUpdateCoachDialogOpen}
        initialValues={data}
      />
      <div className="flex-1 py-4 md:px-8 flex flex-col gap-y-4">
        <CoachIdViewHeader
          coachId={coachId}
          coachName={data.name}
          onEdit={() => setUpdateCoachDialogOpen(true)}
          onRemove={handleRemoveCoach}
        />
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
            <div className="flex items-center gap-x-3">
              <NameAvatar name={data.name} size={40} />
              <h2 className="text-2xl font-medium">{data.name}</h2>
            </div>
            <Badge
              variant="outline"
              className="flex items-center gap-x-2 [&>svg]:size-4"
            >
              <VideoIcon className="text-blue-700" />
              {data.sessionCount}{" "}
              {data.sessionCount === 1 ? "session" : "sessions"}
            </Badge>
            <div className="flex flex-col gap-y-4">
              <p className="text-lg font-medium">Instructions</p>
              <p className="text-neutral-800">{data.instructions}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const CoachesIdViewLoading = () => {
  return (
    <LoadingState
      title="Loading Coaches"
      description="This may take few seconds"
    />
  );
};

export const CoachesIdViewError = () => {
  return (
    <ErrorState
      title="Error Loading Coaches"
      description="Something went wrong"
    />
  );
};
