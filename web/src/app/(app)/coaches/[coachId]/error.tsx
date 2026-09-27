"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Coach page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
