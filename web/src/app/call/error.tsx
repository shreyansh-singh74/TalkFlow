"use client";

import { ErrorState } from "@/components/error-state";
import { useEffect } from "react";

export default function CallError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Call page error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col gap-y-4">
      <ErrorState
        title="Something went wrong"
        description={
          error.message ||
          "An unexpected error occurred while opening the call. Please try again."
        }
      />
      <div className="flex justify-center">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
