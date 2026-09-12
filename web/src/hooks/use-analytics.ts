import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Matches `ProgressSummary` in @/lib/progress, plus the drill queue. */
export interface AnalyticsData {
  totals: {
    sessions: number;
    minutes: number;
    words: number;
    turns: number;
    streak: number;
  };
  accuracy: number | null;
  accuracyLast7d: number | null;
  accuracyPrevious7d: number | null;
  accuracyDelta: number | null;
  trend: Array<{
    weekStart: string;
    accuracy: number | null;
    sessions: number;
    minutes: number;
  }>;
  phones: Array<{
    phone: string;
    label: string;
    observations: number;
    errorRate: number;
    avgAccuracy: number;
    trend: "improving" | "steady" | "worsening" | null;
  }>;
  weakPhones: string[];
  masteredPhones: string[];
  byCoach: Array<{ label: string; sessions: number; accuracy: number | null }>;
  drill: { phone: string; dueNow: boolean; fromQueue: boolean } | null;
  goalQueue: Array<{
    phone: string;
    observations: number;
    errors: number;
    drillCount: number;
    lastPractisedAt: string | null;
    nextReviewAt: string;
  }>;
}

export function useAnalytics() {
  return useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const response = await fetch("/api/analytics");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to load progress");
      }
      return response.json();
    },
  });
}

/**
 * Create a drill for one phone and return its session id.
 *
 * The drill is a normal session, so the caller navigates to `/call/[id]`; the
 * queue advances on the server when the drill is created, and its outcome is
 * folded back in when the finished session is saved.
 */
export function useCreateDrill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      phone: string;
      difficulty?: "easy" | "medium" | "hard";
      stepCount?: number;
    }): Promise<{ id: string; phone: string }> => {
      const response = await fetch("/api/drills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not create the drill");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
