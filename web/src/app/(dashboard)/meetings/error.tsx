"use client";

import { ErrorState } from "@/components/error-state";
import { useEffect } from "react";

export default function Error({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string }; 
  reset: () => void 
}) {
  useEffect(() => {
    console.error("Meetings page error:", error);
  }, [error]);

  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <ErrorState
        title="Something went wrong"
        description={error.message || "An unexpected error occurred while loading the meetings page."}
      />
      <div className="flex justify-center">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
