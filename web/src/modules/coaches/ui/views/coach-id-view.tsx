"use client";
import { ErrorState } from "@/components/error-state";
import { useCoach, useDeleteCoach } from "@/hooks/use-api";
import { CoachIdViewHeader } from "../components/coach-id-view-header";
import { NameAvatar } from "@/components/name-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import { ACCENT_OPTIONS, DIFFICULTY_LABELS } from "@/types/practice";
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
        router.push("/coaches");
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
        <div className="bg-card rounded-lg border">
          <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
            <div className="flex items-center gap-x-3">
              <NameAvatar name={data.name} size={40} />
              <h2 className="text-2xl font-medium">{data.name}</h2>
            </div>
            <Badge
              variant="outline"
              className="flex items-center gap-x-2 [&>svg]:size-4 w-fit"
            >
              <VideoIcon className="text-info" />
              {data.sessionCount}{" "}
              {data.sessionCount === 1 ? "session" : "sessions"}
            </Badge>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t pt-5">
              <div className="flex flex-col gap-y-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  Drill topic
                </dt>
                <dd className="text-foreground">
                  {data.topic || "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-y-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  Difficulty
                </dt>
                <dd className="text-foreground capitalize">
                  {data.difficulty
                    ? (DIFFICULTY_LABELS[
                        data.difficulty as keyof typeof DIFFICULTY_LABELS
                      ] ?? data.difficulty)
                    : "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-y-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  Target accent
                </dt>
                <dd className="text-foreground">
                  {ACCENT_OPTIONS.find((a) => a.value === data.accent)?.label ??
                    data.accent ??
                    "—"}
                </dd>
              </div>
              <div className="flex flex-col gap-y-1">
                <dt className="text-sm font-medium text-muted-foreground">
                  Focus sounds
                </dt>
                <dd className="text-foreground">
                  {data.focusSounds && data.focusSounds.length > 0 ? (
                    <span className="flex flex-wrap gap-1.5">
                      {data.focusSounds.map((sound: string) => (
                        <Badge key={sound} variant="secondary">
                          {sound}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-y-4 border-t pt-5">
              <p className="text-lg font-medium">Instructions</p>
              <p className="text-foreground whitespace-pre-wrap">
                {data.instructions || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const CoachesIdViewLoading = () => {
  return (
    <div className="flex-1 py-4 md:px-8 flex flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-5 gap-y-5 flex flex-col">
          <div className="flex items-center gap-x-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-7 w-48" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t pt-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t pt-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    </div>
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
