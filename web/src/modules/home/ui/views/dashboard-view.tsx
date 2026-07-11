"use client";

import { useDashboard } from "@/hooks/use-dashboard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlusIcon,
  PlayIcon,
  ArrowRightIcon,
  TrophyIcon,
  FlameIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

// Accent colors for agent avatars
const AVATAR_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#14b8a6", // teal
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "0 min";
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "<1 min";
  return `${mins} min`;
}

function getAccuracyColor(accuracy: number | null): string {
  if (accuracy === null) return "bg-muted-foreground/20 text-muted-foreground";
  if (accuracy >= 85) return "bg-emerald-500/20 text-emerald-400";
  if (accuracy >= 70) return "bg-amber-500/20 text-amber-400";
  return "bg-red-500/20 text-red-400";
}

// Phoneme badge colors
const PHONEME_COLORS = ["#ef4444", "#f59e0b", "#6366f1", "#10b981", "#8b5cf6"];

export const DashboardView = () => {
  const { data, isLoading, error } = useDashboard();
  const router = useRouter();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Failed to load dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            {error?.message || "Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const userName =
    data.user.name || data.user.email?.split("@")[0] || "there";

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Welcome back, {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s how your practice is going.
          </p>
        </div>
        <Button
          onClick={() => router.push("/dashboard/meetings")}
          className="gap-2 "
        >
          <PlusIcon className="h-4 w-4" />
          New session
        </Button>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 md:gap-5">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4 md:gap-5">
          {/* Continue Practice Card */}
          <ContinuePracticeCard data={data} />

          {/* Recent Sessions Card */}
          <RecentSessionsCard data={data} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4 md:gap-5">
          {/* Progress Stats */}
          <ProgressStatsCard data={data} />

          {/* Personal Best */}
          {data.personalBest.accuracy > 0 && (
            <PersonalBestCard data={data} />
          )}

          {/* Focus Areas */}
          {data.focusAreas.length > 0 && <FocusAreasCard data={data} />}

          {/* Practice with an Agent */}
          <AgentsCard data={data} />
        </div>
      </div>
    </div>
  );
};

// ─── Continue Practice Card ──────────────────────────────────────────
function ContinuePracticeCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  const cp = data.continuePractice;

  if (!cp) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
          Get started
        </p>
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Start your first practice session
        </h3>
        <Button asChild size="sm" className="gap-2">
          <Link href="/dashboard/meetings">
            <ArrowRightIcon className="h-4 w-4" />
            Start something new
          </Link>
        </Button>
      </div>
    );
  }

  const timeAgo = cp.endedAt
    ? formatDistanceToNow(new Date(cp.endedAt), { addSuffix: false })
    : formatDistanceToNow(new Date(cp.createdAt), { addSuffix: false });

  const canResume = cp.status === "active" || cp.status === "upcoming";

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background:
          "linear-gradient(135deg, hsl(160 40% 12%) 0%, hsl(160 30% 8%) 100%)",
        borderColor: "hsl(160 30% 18%)",
      }}
    >
      <p className="text-xs text-emerald-400/70 uppercase tracking-wider mb-2">
        Continue practice
      </p>
      <h3 className="text-lg font-semibold text-white mb-0.5">{cp.name}</h3>
      <p className="text-sm text-white/50 mb-4">
        {cp.accuracy !== null ? `${cp.accuracy}% accuracy` : "No score yet"}
        {cp.duration ? ` · ${formatDuration(cp.duration)}` : ""}
        {" · "}
        {timeAgo}
      </p>
      <div className="flex items-center gap-3">
        {canResume && (
          <Button
            asChild
            size="sm"
            className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Link href={`/call/${cp.id}`}>
              <PlayIcon className="h-3.5 w-3.5" />
              Resume
            </Link>
          </Button>
        )}
        <Button
          asChild
          variant="outline"
          size="sm"
          className="gap-2 border-white/20 bg-transparent! text-white! hover:bg-white/10! hover:text-white!"
        >
          <Link href="/dashboard/meetings">
            <ArrowRightIcon className="h-3.5 w-3.5" />
            Start something new
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ─── Progress Stats Card ─────────────────────────────────────────────
function ProgressStatsCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  const stats = [
    {
      label: "Streak",
      value: `${data.stats.streak} day${data.stats.streak !== 1 ? "s" : ""}`,
      icon: <FlameIcon className="h-4 w-4 text-orange-400" />,
    },
    {
      label: "Sessions",
      value: data.stats.totalSessions.toString(),
    },
    {
      label: "Accuracy, 7d",
      value: `${data.stats.accuracy7d}%`,
    },
    {
      label: "Practice, 7d",
      value: `${data.stats.practiceMinutes7d} min`,
    },
  ];

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Your progress
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border bg-muted/50 p-3.5"
          >
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              {stat.icon}
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-foreground tracking-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Sessions Card ────────────────────────────────────────────
function RecentSessionsCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  if (data.recentSessions.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-3">
          Recent sessions
        </h3>
        <p className="text-sm text-muted-foreground">
          No completed sessions yet. Start a practice session to see your
          history here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Recent sessions
      </h3>
      <div className="space-y-1">
        {data.recentSessions.map((session) => {
          const color = getAvatarColor(session.agentName);
          const initial = session.agentName.charAt(0).toUpperCase();
          const timeAgo = formatDistanceToNow(new Date(session.endedAt), {
            addSuffix: false,
          });

          return (
            <Link
              key={session.id}
              href={`/dashboard/meetings/${session.id}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 transition-colors hover:bg-muted/60"
            >
              {/* Avatar */}
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                style={{ backgroundColor: color }}
              >
                {initial}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {session.name}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {session.agentName}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo} ago · {formatDuration(session.duration)}
                </p>
              </div>

              {/* Accuracy badge */}
              {session.accuracy !== null && (
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${getAccuracyColor(session.accuracy)}`}
                >
                  {session.accuracy}%
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Personal Best Card ──────────────────────────────────────────────
function PersonalBestCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background:
          "linear-gradient(135deg, hsl(35 80% 15%) 0%, hsl(30 60% 10%) 100%)",
        border: "1px solid hsl(35 50% 22%)",
      }}
    >
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "hsl(35 80% 25%)" }}
      >
        <TrophyIcon className="h-4 w-4 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-400">
          New personal best
        </p>
        <p className="text-xs text-amber-200/60 mt-0.5">
          {data.personalBest.context || `${data.personalBest.accuracy}% accuracy`}
        </p>
      </div>
    </div>
  );
}

// ─── Focus Areas Card ────────────────────────────────────────────────
function FocusAreasCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Focus areas
      </h3>

      {/* Phoneme circles */}
      <div className="flex items-center gap-2 mb-3">
        {data.focusAreas.map((phoneme, i) => (
          <div
            key={phoneme}
            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{
              backgroundColor:
                PHONEME_COLORS[i % PHONEME_COLORS.length],
            }}
          >
            {phoneme}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Weakest: {data.focusAreas.join(" and ")} sounds.
      </p>

      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-full gap-2"
      >
        <Link href="/dashboard/meetings">
          <ArrowRightIcon className="h-3.5 w-3.5" />
          Drill these sounds
        </Link>
      </Button>
    </div>
  );
}

// ─── Practice with an Agent Card ─────────────────────────────────────
function AgentsCard({
  data,
}: {
  data: NonNullable<ReturnType<typeof useDashboard>["data"]>;
}) {
  if (data.agents.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold text-foreground mb-4">
        Practice with an agent
      </h3>
      <div className="space-y-1">
        {data.agents.map((agent) => {
          const color = getAvatarColor(agent.name);
          const initial = agent.name.charAt(0).toUpperCase();

          // Create a friendly short description from the agent name
          const shortDesc = agent.name
            .replace(/ Coach$/, "")
            .replace(/^Daily /, "")
            .replace(/^Interview /, "");

          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1"
            >
              {/* Avatar */}
              <div
                className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                style={{ backgroundColor: color }}
              >
                {initial}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {agent.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {shortDesc}
                </p>
              </div>

              {/* Start button */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="shrink-0"
              >
                <Link href={`/dashboard/meetings`}>Start</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Left column */}
        <div className="space-y-4 md:space-y-5">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        {/* Right column */}
        <div className="space-y-4 md:space-y-5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
