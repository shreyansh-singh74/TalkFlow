import assert from "node:assert/strict";
import test from "node:test";

import {
  MASTERED_ERROR_RATE,
  MIN_PHONE_OBSERVATIONS,
  sessionAccuracy,
  streakFrom,
  summarize,
  weekStart,
  type SessionSample,
} from "./progress";
import type { SessionAnalysisReport } from "@/types/pronunciation";

/**
 * Tests for the numbers a learner is shown about their own speech.
 *
 * The rule these pin is the same one the session report follows: a value is
 * reported only when it was measured. `null` is not zero, and a phone is not
 * called weak (or mastered) on thin evidence. Both mistakes were live in the
 * dashboard before this layer existed — accuracy was `NaN` because the writer
 * and the readers disagreed about a field name, and focus areas came from
 * regexing quoted words out of the coach's English prose.
 */

let seq = 0;

function report(overrides: Partial<SessionAnalysisReport> = {}): SessionAnalysisReport {
  return {
    overall_score: 88,
    accuracy_score: 88,
    fluency_score: 90,
    words_spoken: 10,
    sentences_completed: 3,
    wpm: 100,
    avg_pause_duration: null,
    longest_pause: null,
    total_speaking_time: 6,
    mispronounced_words: [],
    difficult_sounds: [],
    phone_breakdown: [],
    stress_mistakes: null,
    syllable_mistakes: null,
    intonation_issues: null,
    words_skipped: [],
    extra_inserted_words: [],
    strengths: [],
    areas_to_improve: [],
    coach_feedback: "ok",
    ...overrides,
  };
}

function sample(
  overrides: Partial<SessionSample> & { endedAt?: Date } = {}
): SessionSample {
  seq += 1;
  return {
    id: `s${seq}`,
    name: `Session ${seq}`,
    createdAt: new Date("2026-03-01T10:00:00Z"),
    endedAt: new Date("2026-03-01T10:10:00Z"),
    minutes: 10,
    label: "Test Coach",
    difficulty: "medium",
    report: report(),
    entries: [
      {
        at: "2026-03-01T10:01:00Z",
        turn_id: "t1",
        target_text: "the first step",
        heard_text: "the first step",
        score: 88,
        feedback: [],
      },
    ],
    ...overrides,
  };
}

function withPhones(
  entries: Array<{ phone: string; observations: number; errorRate: number }>
): Partial<SessionAnalysisReport> {
  return {
    phone_breakdown: entries.map((e) => ({
      phone: e.phone,
      label: `/${e.phone}/`,
      observations: e.observations,
      error_rate: e.errorRate,
      avg_accuracy: 100 * (1 - e.errorRate),
    })),
  };
}

test("sessionAccuracy prefers the report's phone-level figure", () => {
  const s = sample({
    report: report({ accuracy_score: 71.5 }),
    entries: [
      {
        at: "2026-03-01T10:01:00Z",
        turn_id: "t",
        target_text: "x",
        heard_text: "x",
        score: 20, // the weaker, turn-level measure
        feedback: [],
      },
    ],
  });
  assert.equal(sessionAccuracy(s), 71.5);
});

test("sessionAccuracy is null when nothing was measured", () => {
  // The text-proxy scorer produces no per-phone data, and an empty session has
  // no turns at all; neither is a score of zero.
  assert.equal(sessionAccuracy(sample({ report: report({ accuracy_score: null }), entries: [] })), null);
});

test("sessionAccuracy falls back to the mean of turn scores", () => {
  const s = sample({
    report: report({ accuracy_score: null }),
    entries: [
      { at: "a", turn_id: "1", target_text: "x", heard_text: "x", score: 80, feedback: [] },
      { at: "b", turn_id: "2", target_text: "y", heard_text: "y", score: 90, feedback: [] },
    ],
  });
  assert.equal(sessionAccuracy(s), 85);
});

test("streakFrom counts consecutive days and ignores duplicates", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  const days = [
    new Date("2026-03-10T08:00:00Z"),
    new Date("2026-03-10T19:00:00Z"),
    new Date("2026-03-09T08:00:00Z"),
    new Date("2026-03-08T08:00:00Z"),
  ];
  assert.equal(streakFrom(days, now), 3);
});

test("a streak survives until the end of the day after it", () => {
  // Practised yesterday, not yet today: the streak is still alive.
  const now = new Date("2026-03-10T09:00:00Z");
  assert.equal(streakFrom([new Date("2026-03-09T09:00:00Z")], now), 1);
});

test("a streak broken by a missed day is zero", () => {
  const now = new Date("2026-03-10T09:00:00Z");
  assert.equal(streakFrom([new Date("2026-03-07T09:00:00Z")], now), 0);
});

test("weekStart returns the Monday of the week", () => {
  // 2026-03-01 is a Sunday, so its week starts on Monday 2026-02-23.
  assert.equal(weekStart(new Date("2026-03-01T23:00:00Z")).toISOString().slice(0, 10), "2026-02-23");
  assert.equal(weekStart(new Date("2026-03-02T00:00:00Z")).toISOString().slice(0, 10), "2026-03-02");
});

test("summarize totals only what exists", () => {
  const summary = summarize([
    sample({ endedAt: new Date("2026-03-02T10:00:00Z"), minutes: 12 }),
    sample({ endedAt: new Date("2026-03-02T11:00:00Z"), minutes: 8 }),
  ]);
  assert.equal(summary.totals.sessions, 2);
  assert.equal(summary.totals.minutes, 20);
  assert.equal(summary.totals.turns, 2);
  assert.equal(summary.accuracy, 88);
});

test("summarize reports null accuracy when no session was measured", () => {
  const summary = summarize([
    sample({ report: report({ accuracy_score: null }), entries: [] }),
  ]);
  assert.equal(summary.accuracy, null);
  assert.equal(summary.accuracyDelta, null);
});

test("a week with no practice leaves a gap, not a zero", () => {
  const summary = summarize([
    sample({ endedAt: new Date("2026-03-02T10:00:00Z") }),
    // Nothing in the week of 2026-03-09.
    sample({ endedAt: new Date("2026-03-16T10:00:00Z") }),
  ]);
  const starts = summary.trend.map((t) => t.weekStart);
  assert.deepEqual(starts, ["2026-03-02", "2026-03-16"]);
  assert.ok(summary.trend.every((t) => t.accuracy !== null));
});

test("minute buckets keep sessions that a week hides", () => {
  const summary = summarize([
    sample({ endedAt: new Date("2026-03-02T10:00:00Z"), minutes: 30 }),
    sample({ endedAt: new Date("2026-03-04T10:00:00Z"), minutes: 15 }),
  ]);
  assert.equal(summary.trend.length, 1);
  assert.equal(summary.trend[0].minutes, 45);
  assert.equal(summary.trend[0].sessions, 2);
});

test("a phone is not called weak on thin evidence", () => {
  const observation = MIN_PHONE_OBSERVATIONS - 1;
  const summary = summarize([
    sample({ report: report(withPhones([{ phone: "ð", observations: observation, errorRate: 1 }])) }),
  ]);
  // It is still listed with its evidence...
  assert.equal(summary.phones[0].phone, "ð");
  assert.equal(summary.phones[0].observations, observation);
  // ...but it is not promoted to a verdict.
  assert.deepEqual(summary.weakPhones, []);
});

test("a consistently wrong phone leads the weak list", () => {
  const summary = summarize([
    sample({
      report: report(
        withPhones([
          { phone: "ð", observations: 8, errorRate: 0.75 },
          { phone: "r", observations: 8, errorRate: 0.1 },
          { phone: "s", observations: 8, errorRate: 0 },
        ])
      ),
    }),
  ]);
  assert.deepEqual(summary.weakPhones, ["ð", "r"]);
  assert.deepEqual(summary.masteredPhones, ["s"]);
});

test("mastery needs enough clean observations", () => {
  const summary = summarize([
    sample({
      report: report(
        withPhones([
          { phone: "s", observations: MIN_PHONE_OBSERVATIONS - 1, errorRate: 0 },
        ])
      ),
    }),
  ]);
  assert.deepEqual(summary.masteredPhones, []);
});

test("a phone just above the mastery ceiling is not mastered", () => {
  const summary = summarize([
    sample({
      report: report(
        withPhones([
          { phone: "s", observations: 10, errorRate: MASTERED_ERROR_RATE + 0.01 },
        ])
      ),
    }),
  ]);
  assert.deepEqual(summary.masteredPhones, []);
});

test("phone trend compares the two halves of its own history", () => {
  const early = sample({
    endedAt: new Date("2026-03-02T10:00:00Z"),
    report: report(withPhones([{ phone: "ð", observations: 6, errorRate: 0.8 }])),
  });
  const late = sample({
    endedAt: new Date("2026-03-09T10:00:00Z"),
    report: report(withPhones([{ phone: "ð", observations: 6, errorRate: 0.1 }])),
  });
  const summary = summarize([early, late]);
  const phone = summary.phones.find((p) => p.phone === "ð");
  assert.equal(phone?.observations, 12);
  assert.equal(phone?.trend, "improving");
});

test("phone evidence accumulates across sessions in time order", () => {
  const later = sample({
    endedAt: new Date("2026-03-09T10:00:00Z"),
    report: report(withPhones([{ phone: "ð", observations: 6, errorRate: 1 }])),
  });
  const earlier = sample({
    endedAt: new Date("2026-03-02T10:00:00Z"),
    report: report(withPhones([{ phone: "ð", observations: 6, errorRate: 0 }])),
  });
  // Deliberately out of order: the aggregate sorts by date itself.
  const summary = summarize([later, earlier]);
  assert.equal(summary.phones[0].trend, "worsening");
});

test("per-topic breakdown includes coach-less (pasted-text) sessions", () => {
  const summary = summarize([
    sample({ label: "Interview English Coach" }),
    sample({ label: "Your text · Medium" }),
  ]);
  const labels = summary.byCoach.map((c) => c.label).sort();
  assert.deepEqual(labels, ["Interview English Coach", "Your text · Medium"]);
});

test("sessions with no duration do not bias practice minutes", () => {
  const summary = summarize([
    sample({ minutes: 0 }),
    sample({ minutes: 10 }),
  ]);
  assert.equal(summary.totals.minutes, 10);
});
