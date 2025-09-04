"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("Agent page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-6">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-gray-600">{error.message}</p>
      <button
        onClick={() => reset()}
        className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white"
      >
        Try again
      </button>
    </div>
  );
}
