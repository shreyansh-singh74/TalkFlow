"use client";

import { useEffect, useState, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-config";
import { Loader2, WifiOff } from "lucide-react";

type Status = "checking" | "sleeping" | "offline" | "online";

export function BackendStatusIndicator() {
  const [status, setStatus] = useState<Status>("checking");
  const [elapsedTime, setElapsedTime] = useState(0);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeCounterRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const checkHealth = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        setStatus("online");
        return true;
      }
    } catch {
      // Fetch failed or timed out
    }
    clearTimeout(timeoutId);
    return false;
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    
    // Start tracking elapsed time for distinguishing offline vs sleeping
    timeCounterRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    const poll = async () => {
      const isHealthy = await checkHealth();
      
      if (isHealthy) {
        // Once online, check less frequently (every 30s)
        if (checkTimerRef.current) clearInterval(checkTimerRef.current);
        checkTimerRef.current = setInterval(checkHealth, 30000);
      } else {
        // Not healthy (failed or timed out)
        setStatus(() => {
          // If it's been failing for less than 120 seconds, assume it is waking up (sleeping/spin-down)
          const timeActive = Math.floor((Date.now() - startTimeRef.current) / 1000);
          if (timeActive < 120) {
            return "sleeping";
          }
          return "offline";
        });
      }
    };

    // Initial check
    poll();

    // Fast polling (every 4s) while waking up or checking
    checkTimerRef.current = setInterval(poll, 4000);

    return () => {
      if (checkTimerRef.current) clearInterval(checkTimerRef.current);
      if (timeCounterRef.current) clearInterval(timeCounterRef.current);
    };
  }, []);

  if (status === "online" || status === "checking") return null;

  return (
    <div
      className={`fixed top-0 left-0 w-full z-[9999] transition-transform duration-500 ease-in-out border-b text-sm font-medium ${
        status === "sleeping"
          ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 translate-y-0"
          : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 translate-y-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {status === "sleeping" && (
            <>
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="flex items-center gap-1.5 flex-wrap">
                Connecting to backend... Server is spinning up (may take 1-2 minutes).
                <span className="text-xs opacity-85">({elapsedTime}s elapsed)</span>
                <a
                  href={getBackendUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-700 dark:hover:text-amber-300 font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  [Check Backend Link]
                </a>
              </span>
            </>
          )}

          {status === "offline" && (
            <>
              <WifiOff className="w-4 h-4 text-rose-500" />
              <span className="flex items-center gap-1.5 flex-wrap">
                Cannot connect to the server. Please verify your connection or check the
                <a
                  href={getBackendUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-rose-700 dark:hover:text-rose-300 font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  [Backend Link]
                </a>
              </span>
            </>
          )}
        </div>

        {status === "sleeping" && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Waking up Render instance
          </div>
        )}
      </div>
    </div>
  );
}
