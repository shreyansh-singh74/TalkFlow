import { EmptyState } from "@/components/empty-state";
import { LoaderIcon } from "lucide-react";

/**
 * A session whose script is still being generated. It is a transient status —
 * creation resolves it within seconds — but it was previously unhandled here,
 * and a session page that renders only its header is worse than any copy.
 */
export const ProcessingState = () => {
  return (
    <div className="bg-card rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        image="/upcoming.svg"
        title="Preparing your session"
        description="The practice steps are still being generated. This usually takes a few seconds — refresh in a moment."
      />
      <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
};
