"use client";

import { useEffect, useState, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-config";
import { Loader2, WifiOff, CheckCircle2 } from "lucide-react";

type Status = "checking" | "sleeping" | "offline" | "online";

export function BackendStatusIndicator() {
  const [status, setStatus] = useState<Status>("checking");
  const [visible, setVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const checkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeCounterRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const checkHealth = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 second timeout

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/health`, {
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

  // Handle visibility of the "Online" success banner (dismiss after 3s)
  useEffect(() => {
    if (status === "online") {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(true);
    }
  }, [status]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 w-full z-[9999] transition-transform duration-500 ease-in-out border-b text-sm font-medium ${
        status === "online"
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 translate-y-0"
          : status === "sleeping"
          ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 translate-y-0"
          : status === "offline"
          ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 translate-y-0"
          : "-translate-y-full" // Hidden when checking and starts transitioning
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {status === "online" && (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Backend connection established. TalkFlow is ready!</span>
            </>
          )}

          {status === "sleeping" && (
            <>
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
              <span className="flex items-center gap-1.5">
                Connecting to backend... Server is spinning up (may take 1-2 minutes).
                <span className="text-xs opacity-85">({elapsedTime}s elapsed)</span>
              </span>
            </>
          )}

          {status === "offline" && (
            <>
              <WifiOff className="w-4 h-4 text-rose-500" />
              <span>Cannot connect to the server. Please check your connection.</span>
            </>
          )}

          {status === "checking" && (
            <>
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              <span>Verifying server status...</span>
            </>
          )}
        </div>

        {status === "sleeping" && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Waking up Render instance
          </div>
        )}

        {status === "online" && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-500/80 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Connected
          </div>
        )}
      </div>
    </div>
  );
}
