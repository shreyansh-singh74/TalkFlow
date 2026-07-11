import { useQuery } from "@tanstack/react-query";

export interface DashboardData {
  user: {
    name: string;
    email: string;
  };
  continuePractice: {
    id: string;
    name: string;
    agentName: string;
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
    agentName: string;
    endedAt: string;
    duration: number | null;
    accuracy: number | null;
  }>;
  personalBest: {
    accuracy: number;
    context: string;
  };
  focusAreas: string[];
  agents: Array<{
    id: string;
    name: string;
    description: string;
    meetingCount: number;
  }>;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
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
