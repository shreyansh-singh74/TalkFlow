"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  DownloadIcon,
  FlameIcon,
  MinusIcon,
  PlayIcon,
  TargetIcon,
  TrendingUpIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics, useCreateDrill, type AnalyticsData } from "@/hooks/use-analytics";

/**
 * The progress page.
 *
 * Two rules it follows from the reports:
 *  1. An unmeasured number is hidden, not zeroed — every nullable field here is
 *     rendered conditionally.
 *  2. Evidence is shown next to every claim. `/ð/ — 38% wrong` is an
 *     instruction the learner can act on; a bare `/ð/` badge is a horoscope.
 */
export const ProgressView = () => {
  const { data, isLoading, error } = useAnalytics();
  const router = useRouter();
  const createDrill = useCreateDrill();

  const startDrill = (phone: string) => {
    createDrill.mutate(
      { phone },
      {
        onSuccess: (result) => router.push(`/call/${result.id}`),
        onError: (err) => toast.error(err.message || "Could not start the drill"),
      }
    );
  };

  if (isLoading) return <ProgressSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Failed to load your progress</h2>
          <p className="text-sm text-muted-foreground">
            {error?.message || "Please try again later."}
          </p>
        </div>
      </div>
    );
  }

  const nothingYet = data.totals.sessions === 0;

  return (
    <div className="flex-1 space-y-5 overflow-auto p-4 md:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Your progress
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every number here comes from a measured turn. Anything not measured
            is left out rather than guessed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/api/sessions/export?format=csv" download>
              <DownloadIcon className="h-4 w-4" />
              CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href="/api/sessions/export?format=json" download>
              <DownloadIcon className="h-4 w-4" />
              JSON
            </a>
          </Button>
        </div>
      </header>

      {nothingYet ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h3 className="text-lg font-semibold">No finished sessions yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Finish a practice session and this page fills in: accuracy over
            time, the sounds you actually miss, and drills built from them.
          </p>
          <Button asChild className="mt-4 gap-2">
            <Link href="/sessions?create=1">
              <PlayIcon className="h-4 w-4" />
              Start practising
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Sessions"
              value={data.totals.sessions.toString()}
              icon={<TrendingUpIcon className="h-4 w-4 text-brand-accent" />}
            />
            <StatTile
              label="Practice time"
              value={`${data.totals.minutes} min`}
              icon={<MinusIcon className="h-4 w-4 text-info" />}
            />
            <StatTile
              label="Streak"
              value={`${data.totals.streak} day${data.totals.streak === 1 ? "" : "s"}`}
              icon={<FlameIcon className="h-4 w-4 text-warning" />}
            />
            <AccuracyTile
              accuracy={data.accuracy}
              delta={data.accuracyDelta}
              last7d={data.accuracyLast7d}
            />
          </div>

          <DrillCard
            drill={data.drill}
            weakPhones={data.weakPhones}
            onCreate={startDrill}
            isPending={createDrill.isPending}
          />

          <TrendCard data={data} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PhonesCard phones={data.phones} onCreate={startDrill} />
            <div className="space-y-5">
              <MasteredCard mastered={data.masteredPhones} />
              <CoachCard rows={data.byCoach} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function AccuracyTile({
  accuracy,
  delta,
  last7d,
}: {
  accuracy: number | null;
  delta: number | null;
  last7d: number | null;
}) {
  // Null means no acoustic measurement exists yet; saying "0%" would be a
  // different, and false, statement.
  if (accuracy === null) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-1 text-xs text-muted-foreground">Accuracy</p>
        <p className="text-sm text-muted-foreground">
          Not measured yet
          <span className="mt-0.5 block text-[11px]">
            Phone-level scoring runs on real audio turns.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="mb-1 text-xs text-muted-foreground">Accuracy</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold tracking-tight">
          {Math.round(accuracy)}%
        </p>
        {delta !== null && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              delta >= 1
                ? "text-brand-accent"
                : delta <= -1
                  ? "text-danger"
                  : "text-muted-foreground"
            }`}
          >
            {delta >= 1 ? (
              <ArrowUpRightIcon className="h-3 w-3" />
            ) : delta <= -1 ? (
              <ArrowDownRightIcon className="h-3 w-3" />
            ) : null}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} pts
          </span>
        )}
      </div>
      {last7d !== null && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {Math.round(last7d)}% in the last 7 days
        </p>
      )}
    </div>
  );
}

function DrillCard({
  drill,
  weakPhones,
  onCreate,
  isPending,
}: {
  drill: AnalyticsData["drill"];
  weakPhones: string[];
  onCreate: (phone: string) => void;
  isPending: boolean;
}) {
  if (!drill) {
    return (
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <TargetIcon className="h-4 w-4 text-brand-accent" />
          Targeted drills
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No sound has been observed often enough to build a drill from yet. A
          phone needs at least six observations before it is treated as a
          weakness — one unlucky frame is noise.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
      <p className="mb-1 text-xs uppercase tracking-wider text-primary-foreground/70">
        {drill.fromQueue ? "Due for review" : "Weakest sound"}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">
            Drill{" "}
            <span className="font-mono text-primary-foreground/90">/{drill.phone}/</span>
          </h3>
          <p className="mt-0.5 text-sm text-primary-foreground/60">
            A short session generated around this one sound, contrasted with the
            sounds people substitute for it.
          </p>
          {weakPhones.length > 1 && (
            <p className="mt-2 text-xs text-primary-foreground/40">
              Also weak:{" "}
              {weakPhones
                .filter((p) => p !== drill.phone)
                .map((p) => `/${p}/`)
                .join(", ")}
            </p>
          )}
        </div>
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => onCreate(drill.phone)}
          className="gap-2 bg-card text-primary hover:bg-card/90"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          {isPending ? "Building…" : "Start drill"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Accuracy over time.
 *
 * Hand-rolled SVG rather than a charting dependency: one line, no tooltips worth
 * the 40 kB. Gaps (weeks with no measured session) break the line instead of
 * dropping to zero.
 */
function TrendCard({ data }: { data: AnalyticsData }) {
  const points = data.trend.filter((t) => t.accuracy !== null);
  if (points.length < 2) {
    return (
      <div className="rounded-2xl border bg-card p-5">
        <h3 className="text-base font-semibold">Accuracy over time</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Two or more measured sessions are needed for a trend. You have{" "}
          {points.length}.
        </p>
      </div>
    );
  }

  const width = 720;
  const height = 180;
  const padX = 8;
  const padY = 16;
  const steps = Math.max(points.length - 1, 1);
  const x = (i: number) => padX + (i * (width - padX * 2)) / steps;
  const y = (value: number) =>
    padY + ((100 - value) * (height - padY * 2)) / 100;

  const path = data.trend
    .map((point, i) =>
      point.accuracy === null
        ? null
        : `${x(i).toFixed(1)},${y(point.accuracy).toFixed(1)}`
    )
    .filter((p): p is string => p !== null);

  const first = points[0];
  const last = points[points.length - 1];
  const direction =
    last.accuracy! - first.accuracy! >= 1
      ? "up"
      : last.accuracy! - first.accuracy! <= -1
        ? "down"
        : "flat";

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">Accuracy over time</h3>
        <p className="text-xs text-muted-foreground">
          {points.length} measured week{points.length === 1 ? "" : "s"} ·{" "}
          {direction === "up"
            ? "trending up"
            : direction === "down"
              ? "trending down"
              : "holding steady"}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-40 w-full"
        role="img"
        aria-label="Mean phone accuracy per week"
      >
        {[100, 75, 50, 25, 0].map((line) => (
          <g key={line}>
            <line
              x1={padX}
              x2={width - padX}
              y1={y(line)}
              y2={y(line)}
              stroke="currentColor"
              strokeWidth="1"
              className="text-border"
              strokeDasharray={line === 0 ? undefined : "3 5"}
            />
            <text
              x={0}
              y={y(line) - 3}
              className="fill-muted-foreground text-[10px]"
            >
              {line}
            </text>
          </g>
        ))}
        <polyline
          points={path.join(" ")}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.trend.map((point, i) =>
          point.accuracy === null ? null : (
            <circle
              key={point.weekStart}
              cx={x(i)}
              cy={y(point.accuracy)}
              r={3.5}
              fill="#10b981"
            />
          )
        )}
      </svg>
      <p className="text-[11px] text-muted-foreground">
        Weeks with no measured session leave a gap — they are not zeroes.
      </p>
    </div>
  );
}

function PhonesCard({
  phones,
  onCreate,
}: {
  phones: AnalyticsData["phones"];
  onCreate: (phone: string) => void;
}) {
  // Anything with real evidence, worst first. This is the same ranking the
  // session report's "sounds to work on" uses.
  const rows = phones.filter((p) => p.observations >= 3).slice(0, 10);

  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold">Sounds and their evidence</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          No phone has been observed often enough yet.
        </p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Sound</th>
              <th className="pb-2 font-medium">Wrong</th>
              <th className="pb-2 font-medium">Seen</th>
              <th className="pb-2 font-medium">Trend</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((phone) => (
              <tr key={phone.phone} className="border-t">
                <td className="py-2 font-mono">{phone.label}</td>
                <td className="py-2 tabular-nums">
                  {Math.round(phone.errorRate * 100)}%
                </td>
                <td className="py-2 tabular-nums text-muted-foreground">
                  {phone.observations}
                </td>
                <td className="py-2">
                  <TrendBadge trend={phone.trend} />
                </td>
                <td className="py-2 text-right">
                  {phone.observations >= 6 && phone.errorRate > 0 && (
                    <button
                      type="button"
                      onClick={() => onCreate(phone.phone)}
                      className="rounded-full border px-2.5 py-1 text-[11px] font-semibold hover:bg-muted"
                    >
                      Drill
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        &ldquo;Trend&rdquo; compares the first half of this sound&rsquo;s
        observations with the second.
      </p>
    </div>
  );
}

function TrendBadge({ trend }: { trend: AnalyticsData["phones"][number]["trend"] }) {
  if (trend === null) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const styles: Record<string, string> = {
    improving: "bg-success/10 text-primary border-success/30",
    steady: "bg-muted text-muted-foreground border-border",
    worsening: "bg-warning/10 text-warning border-warning/30",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles[trend]}`}
    >
      {trend}
    </span>
  );
}

function MasteredCard({ mastered }: { mastered: string[] }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold">Sounds you&rsquo;ve mastered</h3>
      {mastered.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          None yet. A sound counts as mastered after six observations with
          almost none wrong.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {mastered.map((phone) => (
            <span
              key={phone}
              className="rounded-full border border-success/30 bg-success/10 px-3 py-1 font-mono text-xs font-semibold text-primary"
            >
              /{phone}/
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CoachCard({ rows }: { rows: AnalyticsData["byCoach"] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="text-base font-semibold">By topic</h3>
      <ul className="mt-3 space-y-2">
        {rows.slice(0, 6).map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-muted-foreground">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              {row.sessions} session{row.sessions === 1 ? "" : "s"}
              {row.accuracy !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  · {Math.round(row.accuracy)}%
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
