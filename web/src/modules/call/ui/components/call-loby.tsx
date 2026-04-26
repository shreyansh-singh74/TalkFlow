import { Button } from "@/components/ui/button";
import { LogInIcon, Mic } from "lucide-react";
import Link from "next/link";

interface Props {
  onJoin: () => void;
}

export const CallLobby = ({ onJoin }: Props) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-radial from-sidebar-accent to-sidebar">
      <div className="py-4 px-8 flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-y-6 bg-background rounded-lg p-10 shadow-sm">
          <div className="flex flex-col gap-y-2 text-center">
            <h6 className="text-lg font-medium">Ready for voice practice?</h6>
            <p className="text-sm text-muted-foreground">
              Microphone access will be requested when you start speaking.
            </p>
          </div>
          
          <div className="w-64 h-48 rounded-lg border bg-muted/40 flex flex-col items-center justify-center text-center px-6">
            <Mic className="w-10 h-10 mb-3 text-primary" />
            <p className="text-sm font-medium">Voice-only mode</p>
            <p className="text-xs text-muted-foreground mt-1">
              Video is disabled for this phase.
            </p>
          </div>
          
          <div className="flex gap-x-2 justify-between w-full">
            <Button asChild variant="ghost">
              <Link href="/meetings">
                Cancel
              </Link>
            </Button>
            <Button onClick={onJoin}>
              <LogInIcon />
              Join Voice Practice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
