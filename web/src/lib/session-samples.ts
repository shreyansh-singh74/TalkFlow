import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import type { SessionSample } from "@/lib/progress";
import type { PracticeScript } from "@/types/practice";
import type { SessionPhonemeDataPersisted } from "@/types/pronunciation";

/**
 * Load a user's finished sessions in the shape the progress aggregates read.
 *
 * `leftJoin` on coaches, because a session built from the learner's own pasted
 * text has no coach row — and an inner join here silently deleted exactly the
 * practice the speech-rehearsal flow produces.
 */
export async function loadSessionSamples(
  userId: string,
  limit = 500
): Promise<SessionSample[]> {
  const rows = await db
    .select({
      id: practiceSessions.id,
      name: practiceSessions.name,
      createdAt: practiceSessions.createdAt,
      endedAt: practiceSessions.endedAt,
      startedAt: practiceSessions.startedAt,
      difficulty: practiceSessions.difficulty,
      source: practiceSessions.source,
      script: practiceSessions.script,
      phonemeData: practiceSessions.phonemeData,
      coachName: coaches.name,
    })
    .from(practiceSessions)
    .leftJoin(coaches, eq(practiceSessions.coachId, coaches.id))
    .where(
      and(
        eq(practiceSessions.userId, userId),
        eq(practiceSessions.status, "completed")
      )
    )
    .orderBy(desc(practiceSessions.endedAt), desc(practiceSessions.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const phonemeData = row.phonemeData as SessionPhonemeDataPersisted | null;
    const label =
      row.coachName ??
      (row.script as PracticeScript | null)?.source_label ??
      (row.source === "custom" ? "Your text" : "TalkFlow Coach");

    // Duration is only real when both ends exist. A missing end time is not a
    // zero-length session.
    const started = row.startedAt?.getTime();
    const ended = row.endedAt?.getTime();
    const minutes =
      started && ended && ended > started ? (ended - started) / 60000 : 0;

    return {
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      endedAt: row.endedAt,
      minutes,
      label,
      difficulty: row.difficulty ?? null,
      report: phonemeData?.report ?? null,
      entries: phonemeData?.entries ?? [],
    };
  });
}
