"use client";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface ResponsiveDialogProps {
  title: string;
  description: string;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentClassName?: string;
}

export const ResponsiveDialog = ({
  title,
  description,
  children,
  open,
  onOpenChange,
  contentClassName,
}: ResponsiveDialogProps) => {
  return(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};
 
