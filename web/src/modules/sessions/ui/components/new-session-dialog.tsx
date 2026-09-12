import { ResponsiveDialog } from "@/components/responsive-dialog";
import { useRouter } from "next/navigation";
import { SessionForm } from "./session-form";

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects a coach, so "Start" on a coach card starts *that* coach. */
  initialCoachId?: string | null;
}

export const NewSessionDialog = ({
  open,
  onOpenChange,
  initialCoachId,
}: NewSessionDialogProps) => {
  const router = useRouter();

  return (
    <ResponsiveDialog
      title="New Practice Session"
      description="Create a new practice session"
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="max-h-[calc(100dvh-1rem)] overflow-y-auto p-4 sm:max-w-xl sm:p-6"
    >
      <SessionForm
        initialCoachId={initialCoachId ?? undefined}
        onSuccess={(id?: string) => {
          if (id) {
            router.push(`/sessions/${id}`);
          }
          onOpenChange(false);
        }}
      />
    </ResponsiveDialog>
  );
};
