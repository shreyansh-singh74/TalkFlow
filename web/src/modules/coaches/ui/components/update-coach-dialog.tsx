import { ResponsiveDialog } from "@/components/responsive-dialog";
import { CoachForm } from "./coach-form";
import { CoachGetOne } from "../../types";

interface NewCoachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: CoachGetOne;
}

export const UpdateCoachDialog = ({
    open,
    onOpenChange,
    initialValues
}:NewCoachDialogProps) => {
    return(
        <ResponsiveDialog
            title="Edit Coach"
            description="Edit the Coach details"
            open={open}
            onOpenChange={onOpenChange}
        >
            <CoachForm 
                onSuccess={()=>{onOpenChange(false)}}
                onCancel={()=>{onOpenChange(false)}}
                initialValues={initialValues}
            />
        </ResponsiveDialog>
    )
};