import { ResponsiveDialog } from "@/components/responsive-dialog";
import { CoachForm } from "./coach-form";

interface NewCoachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewCoachDialog = ({
    open,
    onOpenChange
}:NewCoachDialogProps) => {
    return(
        <ResponsiveDialog
            title="New Coach"
            description="Create a new Coach"
            open={open}
            onOpenChange={onOpenChange}
        >
            <CoachForm 
                onSuccess={()=>{onOpenChange(false)}}
                onCancel={()=>{onOpenChange(false)}}
            />
        </ResponsiveDialog>
    )
};
