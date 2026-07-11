"use client";

import { useMeetings } from "@/hooks/use-api";
import { MeetingStatus } from "@/modules/meetings/types";
import { useRouter } from "next/navigation";
import { Calendar, TrendingUp, Award, Clock, Activity, BarChart2 } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useMemo } from "react";

// Types mapping for report structure in phonemeData
interface PersistedReport {
  overall_score: number;
  fluency_score: number;
  clarity_score: number;
  confidence_score: number;
  accuracy_score: number;
  words_spoken: number;
  wpm: number;
  avg_pause_duration: number;
  total_speaking_time: number;
  strengths: string[];
  areas_to_improve: string[];
  coach_feedback: string;
}

interface CompletedMeeting {
  id: string;
  name: string;
  startedAt: string | null;
  endedAt: string | null;
  status: string;
  phonemeData?: {
    report?: PersistedReport;
  };
  agent?: {
    name: string;
  };
}

export const AnalysisDashboardView = () => {
  const router = useRouter();
  const { data, isLoading, error } = useMeetings({
    status: MeetingStatus.Completed,
    pageSize: 100,
  });

  // Calculate metrics based on completed sessions
  const metrics = useMemo(() => {
    if (!data || !data.items) return null;

    const completed = (data.items as CompletedMeeting[]).filter(
      (m) => m.phonemeData?.report !== undefined
    );

    if (completed.length === 0) return null;

    const scores = completed.map((m) => m.phonemeData!.report!.overall_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bestScore = Math.max(...scores);

    const totalSeconds = completed.reduce((sum, m) => sum + (m.phonemeData!.report!.total_speaking_time || 0), 0);
    const totalMinutes = Math.ceil(totalSeconds / 60);

    const totalWpm = completed.reduce((sum, m) => sum + (m.phonemeData!.report!.wpm || 0), 0);
    const avgWpm = totalWpm / completed.length;

    // Calculate streak (consecutive days with completed sessions)
    const dates = completed
      .map((m) => m.startedAt ? new Date(m.startedAt).toDateString() : "")
      .filter(Boolean);
    const uniqueDates = Array.from(new Set(dates)).map((d) => new Date(d).getTime());
    uniqueDates.sort((a, b) => b - a); // Sort newest to oldest

    let streak = 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const today = new Date().setHours(0, 0, 0, 0);

    if (uniqueDates.length > 0) {
      const mostRecent = uniqueDates[0];
      const diff = today - mostRecent;

      // Allow today or yesterday as starting point for streak
      if (diff <= oneDayMs) {
        streak = 1;
        for (let i = 0; i < uniqueDates.length - 1; i++) {
          if (uniqueDates[i] - uniqueDates[i + 1] === oneDayMs) {
            streak++;
          } else if (uniqueDates[i] - uniqueDates[i + 1] > oneDayMs) {
            break;
          }
        }
      }
    }

    return {
      totalSessions: completed.length,
      avgScore: Math.round(avgScore),
      bestScore: Math.round(bestScore),
      totalMinutes,
      avgWpm: Math.round(avgWpm),
      streak,
      sessions: completed.reverse(), // oldest to newest for chronological chart order
    };
  }, [data]);

  if (isLoading) {
    return <LoadingState title="Loading Analytics" description="Analyzing historical data..." />;
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorState
          title="Failed to Load Analytics"
          description={error.message || "An error occurred."}
        />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center min-h-[70vh]">
        <div className="max-w-md bg-white border border-gray-100 p-8 rounded-2xl shadow-xs">
          <Activity className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold tracking-tight text-gray-900 mb-2">No Practice Session Reports Yet</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Once you complete a full 10-sentence practice session, your speaking coach will generate Otter-like speech transcripts, pronunciations analytics, and scoring summaries here.
          </p>
          <button
            onClick={() => router.push("/dashboard/meetings")}
            className="px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg shadow-sm hover:brightness-105 transition-all"
          >
            Start Your First Practice Session
          </button>
        </div>
      </div>
    );
  }

  // Helper to render SVG area trend chart
  const renderSVGChart = (
    dataPoints: number[],
    colorClass: string,
    label: string,
    gradId: string,
    minVal = 50,
    maxVal = 100
  ) => {
    const width = 600;
    const height = 180;
    const padding = 20;

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    if (dataPoints.length === 0) return null;

    // Map points to SVG coordinates
    const points = dataPoints.map((val, idx) => {
      const x = padding + (idx / Math.max(1, dataPoints.length - 1)) * chartWidth;
      const pct = (val - minVal) / (maxVal - minVal);
      const y = padding + chartHeight - pct * chartHeight;
      return { x, y, val };
    });

    const pathD = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-xs flex-1 min-w-[280px]">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
          {label}
        </h4>
        <div className="relative">
          <svg className="w-full h-40 overflow-visible" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colorClass} stopOpacity="0.25" />
                <stop offset="100%" stopColor={colorClass} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
              const y = padding + p * chartHeight;
              const val = Math.round(maxVal - p * (maxVal - minVal));
              return (
                <g key={idx}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="#F3F4F6"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 5}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#9CA3AF"
                    fontFamily="sans-serif"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area path */}
            {dataPoints.length > 1 && (
              <path d={areaD} fill={`url(#${gradId})`} />
            )}

            {/* Line path */}
            <path
              d={pathD}
              fill="none"
              stroke={colorClass}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Dot markers */}
            {points.map((p, idx) => (
              <g key={idx} className="group cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill="white"
                  stroke={colorClass}
                  strokeWidth="2.5"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="8"
                  fill={colorClass}
                  fillOpacity="0.1"
                  className="opacity-0 group-hover:opacity-100 transition-all"
                />
                {/* Tooltip */}
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#1F2937"
                  fontFamily="sans-serif"
                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded shadow-sm"
                >
                  {Math.round(p.val)}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 py-6 px-4 md:px-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-gray-100 p-6 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
            Pronunciation & Speech Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track your English speaking pacing, clarity score, and AI coaching history.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/meetings")}
          className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg shadow-sm hover:brightness-105 transition-all"
        >
          New Practice Session
        </button>
      </div>

      {/* Aggregate Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Award, label: "Avg Pronunciation", val: `${metrics.avgScore}%`, sub: "Overall correctness" },
          { icon: TrendingUp, label: "Best Score", val: `${metrics.bestScore}%`, sub: "Peak accuracy run" },
          { icon: Clock, label: "Total Speaking", val: `${metrics.totalMinutes}m`, sub: "Time practicing speech" },
          { icon: Calendar, label: "Practice Streak", val: `${metrics.streak} Days`, sub: "Consecutive daily runs" },
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="p-3 bg-primary/5 rounded-xl text-primary">
              <item.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{item.label}</p>
              <h3 className="text-xl font-bold text-gray-800 mt-0.5" style={{ fontFamily: "var(--font-display)" }}>{item.val}</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSVGChart(
          metrics.sessions.map((s) => s.phonemeData!.report!.overall_score),
          "#10B981", // Emerald-500
          "Pronunciation Accuracy Trend",
          "accuracyGrad",
          60,
          100
        )}
        {renderSVGChart(
          metrics.sessions.map((s) => s.phonemeData!.report!.fluency_score),
          "#3B82F6", // Blue-500
          "Speaking Fluency Trend",
          "fluencyGrad",
          60,
          100
        )}
      </div>

      {/* Sessions list */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-base text-gray-900 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-gray-500" />
            Completed Practice History
          </h3>
          <span className="text-xs text-gray-400">Showing {metrics.sessions.length} sessions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="bg-gray-50/70 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Session Date</th>
                <th className="px-6 py-3">Session Name</th>
                <th className="px-6 py-3">AI Coach</th>
                <th className="px-6 py-3 text-center">Score</th>
                <th className="px-6 py-3 text-center">Fluency</th>
                <th className="px-6 py-3 text-center">Speaking Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metrics.sessions
                .slice()
                .reverse() // show newest sessions first in list table
                .map((session) => {
                  const report = session.phonemeData!.report!;
                  const sessionDate = session.startedAt
                    ? new Date(session.startedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <tr
                      key={session.id}
                      onClick={() => router.push(`/dashboard/analysis/${session.id}`)}
                      className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">{sessionDate}</td>
                      <td className="px-6 py-4 font-semibold text-primary hover:underline max-w-[200px] truncate">
                        {session.name}
                      </td>
                      <td className="px-6 py-4">{session.agent?.name || "TalkFlow Coach"}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {Math.round(report.overall_score)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">{Math.round(report.fluency_score)}%</td>
                      <td className="px-6 py-4 text-center">{Math.round(report.wpm)} WPM</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
