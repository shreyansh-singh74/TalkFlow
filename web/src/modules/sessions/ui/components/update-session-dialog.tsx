import { ResponsiveDialog } from "@/components/responsive-dialog";
import { SessionForm } from "./session-form";
import { SessionGetOne } from "../../types";

interface UpdateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: SessionGetOne;
}

export const UpdateSessionDialog = ({
  open,
  onOpenChange,
  initialValues,
}: UpdateSessionDialogProps) => {

  return (
    <ResponsiveDialog
      title="Edit Session"
      description="Edit the Session details"
      open={open}
      onOpenChange={onOpenChange}
    >
      <SessionForm
        onSuccess={() => {
          onOpenChange(false);
        }}
        onCancel={() => onOpenChange(false)}
        initialValues={initialValues}
      />
    </ResponsiveDialog>
  );
};
