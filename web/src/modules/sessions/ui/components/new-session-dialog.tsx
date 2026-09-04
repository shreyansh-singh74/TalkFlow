import { ResponsiveDialog } from "@/components/responsive-dialog";
import { useRouter } from "next/navigation";
import { SessionForm } from "./session-form";

interface NewSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewSessionDialog = ({
  open,
  onOpenChange,
}: NewSessionDialogProps) => {
  const router = useRouter();

  return (
    <ResponsiveDialog
      title="New Practice Session"
      description="Create a new practice session"
      open={open}
      onOpenChange={onOpenChange}
    >
      <SessionForm
        onSuccess={(id?: string) => {
          if (id) {
            router.push(`/dashboard/sessions/${id}`);
          }
          onOpenChange(false);
        }}
      />
    </ResponsiveDialog>
  );
};
