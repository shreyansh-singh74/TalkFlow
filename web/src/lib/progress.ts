import type {
  PersistedTurnEntry,
  PhoneBreakdownEntry,
  SessionAnalysisReport,
} from "@/types/pronunciation";

/**
 * Aggregation over finished practice sessions.
 *
 * Pure functions over already-loaded rows, deliberately: the API routes stay
 * thin, and the maths that decides what a learner is told to practise is
 * testable without a database.
 *
 * The governing rule is the same one the session report follows — a number is
 * only ever reported when something was actually measured. `null` means "not
 * measured", never zero, and every consumer is expected to hide it rather than
 * fill it in.
 */

/** One finished session, reduced to what these aggregates read. */
export interface SessionSample {
  id: string;
  name: string;
  createdAt: Date;
  endedAt: Date | null;
  minutes: number;
  label: string;
  difficulty: string | null;
  report: SessionAnalysisReport | null;
  entries: PersistedTurnEntry[];
}

/** A phone must be seen this often before it is called weak or mastered. */
export const MIN_PHONE_OBSERVATIONS = 6;
/** Error rate at or below this, over enough observations, counts as mastered. */
export const MASTERED_ERROR_RATE = 0.05;

export type PhoneTrend = "improving" | "steady" | "worsening";

export interface PhoneStat {
  phone: string;
  label: string;
  observations: number;
  /** 0..1 — share of observations where the phone was not correct. */
  errorRate: number;
  avgAccuracy: number;
  /** Null until there is enough evidence on both sides of the midpoint. */
  trend: PhoneTrend | null;
}

export interface TrendPoint {
  /** ISO date of the Monday starting the bucket. */
  weekStart: string;
  accuracy: number | null;
  sessions: number;
  minutes: number;
}

export interface ProgressSummary {
  totals: {
    sessions: number;
    minutes: number;
    words: number;
    turns: number;
    streak: number;
  };
  /** Mean accuracy over all sessions, or null when nothing was measured. */
  accuracy: number | null;
  accuracyLast7d: number | null;
  accuracyPrevious7d: number | null;
  /** last7d - previous7d, or null unless both exist. */
  accuracyDelta: number | null;
  trend: TrendPoint[];
  phones: PhoneStat[];
  weakPhones: string[];
  masteredPhones: string[];
  byCoach: Array<{ label: string; sessions: number; accuracy: number | null }>;
}

/** Mean of the per-phone accuracies on one attempt, or null if there are none. */
function attemptAccuracy(entry: PersistedTurnEntry): number | null {
  // The acoustic scorer writes `accuracy` per phone; a text-proxy session has
  // none, and its turn score is not a phone measurement, so it is not a
  // substitute.
  const phones = (entry as { per_phoneme?: unknown }).per_phoneme;
  if (Array.isArray(phones) && phones.length > 0) {
    const scores = phones
      .map((p) => Number((p as { accuracy?: number }).accuracy))
      .filter((n) => Number.isFinite(n));
    if (scores.length > 0) {
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
  }
  return null;
}

/**
 * Session accuracy.
 *
 * Prefers the report's `accuracy_score`, which is the mean over every observed
 * phone in the session. Falls back to the mean of the turn scores, which is a
 * different (weaker) measurement — so it is only used when there is no phone
 * data at all, and the report field is the one the UI labels "accuracy".
 */
export function sessionAccuracy(sample: SessionSample): number | null {
  const fromReport = sample.report?.accuracy_score;
  if (typeof fromReport === "number" && Number.isFinite(fromReport)) {
    return fromReport;
  }
  const perAttempt = sample.entries
    .map(attemptAccuracy)
    .filter((n): n is number => n !== null);
  if (perAttempt.length > 0) {
    return perAttempt.reduce((a, b) => a + b, 0) / perAttempt.length;
  }
  const scores = sample.entries
    .map((e) => e.score)
    .filter((n) => Number.isFinite(n));
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay(); // 0 = Sunday
  const shift = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

/**
 * Consecutive practice days ending today (or yesterday, so a streak survives
 * until the day is over).
 */
export function streakFrom(dates: Date[], now: Date = new Date()): number {
  const days = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  if (days.size === 0) return 0;

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (!days.has(key(now)) && !days.has(key(yesterday))) return 0;

  let cursor = days.has(key(now)) ? new Date(now) : yesterday;
  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

/** Per-phone tallies, in the order the sessions happened. */
function collectPhones(
  sessions: SessionSample[]
): Map<string, Array<{ correct: boolean; accuracy: number }>> {
  const byPhone = new Map<string, Array<{ correct: boolean; accuracy: number }>>();
  for (const sample of sessions) {
    for (const entry of sample.report?.phone_breakdown ?? []) {
      // The report keeps a ranked summary, not every observation, so each entry
      // is expanded back into the observations it summarises: `observations`
      // counts, `error_rate` of which were wrong.
      const phone = (entry.phone || "").trim();
      if (!phone) continue;
      const bucket = byPhone.get(phone) ?? [];
      const wrong = Math.round(entry.error_rate * entry.observations);
      for (let i = 0; i < entry.observations; i += 1) {
        bucket.push({
          correct: i >= wrong,
          accuracy: entry.avg_accuracy,
        });
      }
      byPhone.set(phone, bucket);
    }
  }
  return byPhone;
}

function trendFor(
  observations: Array<{ correct: boolean }>
): PhoneTrend | null {
  if (observations.length < MIN_PHONE_OBSERVATIONS) return null;
  const mid = Math.floor(observations.length / 2);
  const first = observations.slice(0, mid);
  const second = observations.slice(mid);
  if (first.length === 0 || second.length === 0) return null;
  const rate = (xs: Array<{ correct: boolean }>) =>
    xs.filter((o) => !o.correct).length / xs.length;
  const before = rate(first);
  const after = rate(second);
  // A 5-point move is the smallest change worth reporting as a direction.
  if (after < before - 0.05) return "improving";
  if (after > before + 0.05) return "worsening";
  return "steady";
}

export function summarize(
  sessions: SessionSample[],
  now: Date = new Date()
): ProgressSummary {
  const ordered = [...sessions].sort(
    (a, b) =>
      (a.endedAt ?? a.createdAt).getTime() - (b.endedAt ?? b.createdAt).getTime()
  );

  const accuracies = ordered
    .map(sessionAccuracy)
    .filter((n): n is number => n !== null);

  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const within = (lo: number, hi: number) =>
    ordered
      .filter((s) => {
        const at = (s.endedAt ?? s.createdAt).getTime();
        return at >= lo && at < hi;
      })
      .map(sessionAccuracy)
      .filter((n): n is number => n !== null);

  const last7d = mean(within(sevenDaysAgo, Number.POSITIVE_INFINITY));
  const previous7d = mean(within(fourteenDaysAgo, sevenDaysAgo));

  // Weekly buckets, oldest first, with gaps left as holes in the line rather
  // than as zeroes (a week you didn't practise is not a week you scored 0).
  const buckets = new Map<string, SessionSample[]>();
  for (const sample of ordered) {
    const key = weekStart(sample.endedAt ?? sample.createdAt)
      .toISOString()
      .slice(0, 10);
    buckets.set(key, [...(buckets.get(key) ?? []), sample]);
  }
  const trend: TrendPoint[] = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([weekStartKey, group]) => ({
      weekStart: weekStartKey,
      accuracy: mean(
        group
          .map(sessionAccuracy)
          .filter((n): n is number => n !== null)
      ),
      sessions: group.length,
      minutes: Math.round(group.reduce((sum, s) => sum + s.minutes, 0)),
    }));

  const byPhone = collectPhones(ordered);
  const phones: PhoneStat[] = [...byPhone.entries()]
    .map(([phone, obs]) => ({
      phone,
      label: `/${phone}/`,
      observations: obs.length,
      errorRate: obs.filter((o) => !o.correct).length / obs.length,
      avgAccuracy: mean(obs.map((o) => o.accuracy)) ?? 0,
      trend: trendFor(obs),
    }))
    .sort((a, b) => b.errorRate - a.errorRate || b.observations - a.observations);

  const evidenceEnough = phones.filter(
    (p) => p.observations >= MIN_PHONE_OBSERVATIONS
  );

  const byCoachMap = new Map<string, SessionSample[]>();
  for (const sample of ordered) {
    byCoachMap.set(sample.label, [...(byCoachMap.get(sample.label) ?? []), sample]);
  }

  return {
    totals: {
      sessions: ordered.length,
      minutes: Math.round(ordered.reduce((sum, s) => sum + s.minutes, 0)),
      words: ordered.reduce(
        (sum, s) => sum + (s.report?.words_spoken ?? 0),
        0
      ),
      turns: ordered.reduce((sum, s) => sum + s.entries.length, 0),
      streak: streakFrom(
        ordered.map((s) => s.endedAt ?? s.createdAt),
        now
      ),
    },
    accuracy: mean(accuracies),
    accuracyLast7d: last7d,
    accuracyPrevious7d: previous7d,
    accuracyDelta:
      last7d !== null && previous7d !== null ? last7d - previous7d : null,
    trend,
    phones,
    weakPhones: evidenceEnough
      .filter((p) => p.errorRate > 0)
      .slice(0, 5)
      .map((p) => p.phone),
    masteredPhones: evidenceEnough
      .filter((p) => p.errorRate <= MASTERED_ERROR_RATE)
      .sort((a, b) => b.observations - a.observations)
      .slice(0, 8)
      .map((p) => p.phone),
    byCoach: [...byCoachMap.entries()].map(([label, group]) => ({
      label,
      sessions: group.length,
      accuracy: mean(
        group.map(sessionAccuracy).filter((n): n is number => n !== null)
      ),
    })),
  };
}

/** Flatten a phone stat list into the rows an export should carry. */
export function phoneRows(phones: PhoneStat[]): Array<Record<string, string | number>> {
  return phones.map((p) => ({
    phone: p.phone,
    observations: p.observations,
    error_rate: Number(p.errorRate.toFixed(3)),
    avg_accuracy: Number(p.avgAccuracy.toFixed(2)),
    trend: p.trend ?? "insufficient-data",
  }));
}

/** One rendered row per scored turn, for the CSV/JSON export. */
export function turnRows(sessions: SessionSample[]): Array<Record<string, string | number>> {
  const rows: Array<Record<string, string | number>> = [];
  for (const sample of sessions) {
    for (const entry of sample.entries) {
      rows.push({
        session: sample.name,
        at: entry.at,
        target: entry.target_text,
        heard: entry.heard_text,
        score: Number(entry.score?.toFixed?.(2) ?? entry.score ?? 0),
      });
    }
  }
  return rows;
}

export type { PhoneBreakdownEntry };
