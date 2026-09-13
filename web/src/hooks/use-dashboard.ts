import { useQuery } from "@tanstack/react-query";

export interface DashboardData {
  user: {
    name: string;
    email: string;
  };
  continuePractice: {
    id: string;
    name: string;
    coachName: string;
    status: string;
    accuracy: number | null;
    duration: number | null;
    endedAt: string | null;
    createdAt: string;
  } | null;
  stats: {
    streak: number;
    totalSessions: number;
    accuracy7d: number;
    practiceMinutes7d: number;
  };
  recentSessions: Array<{
    id: string;
    name: string;
    coachName: string;
    endedAt: string;
    duration: number | null;
    accuracy: number | null;
  }>;
  personalBest: {
    accuracy: number;
    context: string;
  };
  /** Measured weak phones, from the per-phone evidence in past reports. */
  focusAreas: string[];
  /**
   * Sounds predicted to be hard from the learner's first language. Shown only
   * while `focusAreas` is empty, and always labelled as a prediction.
   */
  suggestedSounds: string[];
  coaches: Array<{
    id: string;
    name: string;
    description: string;
    sessionCount: number;
  }>;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    // Home is the one screen whose skeleton is part of the design, and a warm
    // cache would skip straight past it. Dropping the cached copy the moment
    // nothing is watching means every visit starts from the placeholders
    // instead of a silent swap of stale numbers.
    gcTime: 0,
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch dashboard data");
      }
      return response.json();
    },
  });
}
