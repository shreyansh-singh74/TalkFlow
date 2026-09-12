import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getUserSettings, loadSettingsCatalog } from "@/lib/settings";
import { and, desc, eq, sql, count } from "drizzle-orm";
import type { SessionPhonemeDataPersisted } from "@/types/pronunciation";
import type { PracticeScript } from "@/types/practice";

/**
 * What to call a session in a list.
 *
 * A coach-backed session is named for its coach. A session built from the
 * learner's own pasted text has no coach, so it is named for the script's own
 * source label ("Your text · Medium") rather than a placeholder that reads like
 * a bug.
 */
function sessionLabel(row: {
  coachName: string | null;
  source?: string | null;
  script?: unknown;
}): string {
  if (row.coachName) return row.coachName;
  const label = (row.script as PracticeScript | null)?.source_label;
  if (label) return label;
  return row.source === "custom" ? "Your text" : "TalkFlow Coach";
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Fetch all completed sessions with coach info and phoneme data.
    //
    // `leftJoin`, not `innerJoin`: a session built from the user's own pasted
    // text has no coach (`coachId` is null), and an inner join silently dropped
    // every one of them -- so a learner who spent an hour rehearsing their own
    // speech saw an empty dashboard, no streak, and no "continue" card. Those
    // sessions are labelled from the persisted script instead.
    const completedSessions = await db
      .select({
        id: practiceSessions.id,
        name: practiceSessions.name,
        status: practiceSessions.status,
        startedAt: practiceSessions.startedAt,
        endedAt: practiceSessions.endedAt,
        phonemeData: practiceSessions.phonemeData,
        coachId: practiceSessions.coachId,
        coachName: coaches.name,
        source: practiceSessions.source,
        script: practiceSessions.script,
        difficulty: practiceSessions.difficulty,
        createdAt: practiceSessions.createdAt,
        duration:
          sql<number>`EXTRACT(EPOCH FROM (${practiceSessions.endedAt} - ${practiceSessions.startedAt}))`.as(
            "duration"
          ),
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
      .limit(50);

    // 2. Fetch the most recent session of any status (for "Continue practice")
    const [lastSession] = await db
      .select({
        id: practiceSessions.id,
        name: practiceSessions.name,
        status: practiceSessions.status,
        startedAt: practiceSessions.startedAt,
        endedAt: practiceSessions.endedAt,
        phonemeData: practiceSessions.phonemeData,
        coachId: practiceSessions.coachId,
        coachName: coaches.name,
        source: practiceSessions.source,
        script: practiceSessions.script,
        difficulty: practiceSessions.difficulty,
        createdAt: practiceSessions.createdAt,
        duration:
          sql<number>`EXTRACT(EPOCH FROM (${practiceSessions.endedAt} - ${practiceSessions.startedAt}))`.as(
            "duration"
          ),
      })
      .from(practiceSessions)
      .leftJoin(coaches, eq(practiceSessions.coachId, coaches.id))
      .where(eq(practiceSessions.userId, userId))
      .orderBy(desc(practiceSessions.createdAt))
      .limit(1);

    // 3. Fetch all coaches
    const userAgents = await db
      .select({
        id: coaches.id,
        name: coaches.name,
        instructions: coaches.instructions,
        sessionCount: sql<number>`(
          select count(*)::int
          from ${practiceSessions}
          where ${practiceSessions.coachId} = ${coaches.id}
        )`.as("sessionCount"),
      })
      .from(coaches)
      .where(eq(coaches.userId, userId))
      .orderBy(desc(coaches.createdAt));

    // 4. Total completed sessions count
    const [totalResult] = await db
      .select({ count: count() })
      .from(practiceSessions)
      .where(
        and(
          eq(practiceSessions.userId, userId),
          eq(practiceSessions.status, "completed")
        )
      );
    const totalSessions = totalResult?.count ?? 0;

    // 5. Compute stats from completed sessions
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalAccuracy7d = 0;
    let accuracyCount7d = 0;
    let practiceMinutes7d = 0;
    let bestAccuracy = 0;
    let bestAccuracyContext = "";

    // Focus areas are built from the per-phone evidence the scorer already
    // produced. This previously regexed quoted substrings out of the coach's
    // English feedback ("...for 'th'") and treated whatever it found as a
    // phoneme, while the real data -- phone, observation count, error rate --
    // sat unread in the report right next to it.
    const phoneEvidence: Record<string, { weightedErrors: number; observations: number }> =
      {};

    // Track unique practice days for streak
    const practiceDays = new Set<string>();

    for (const session of completedSessions) {
      const endDate = session.endedAt ? new Date(session.endedAt) : null;
      const duration = session.duration ?? 0;

      // Add to practice days set
      if (endDate) {
        const dayKey = endDate.toISOString().split("T")[0];
        practiceDays.add(dayKey);
      }

      // Parse phoneme data
      const pd = session.phonemeData as SessionPhonemeDataPersisted | null;
      if (pd && pd.entries && pd.entries.length > 0) {
        // Average accuracy for this session
        const avgScore =
          pd.entries.reduce((sum, e) => sum + e.score, 0) / pd.entries.length;

        // 7-day stats
        if (endDate && endDate >= sevenDaysAgo) {
          totalAccuracy7d += avgScore;
          accuracyCount7d++;
          practiceMinutes7d += Math.max(0, duration / 60);
        }

        // Best accuracy
        if (avgScore > bestAccuracy) {
          bestAccuracy = avgScore;
          // Try to find what phoneme/sound it was about
          if (pd.report) {
            bestAccuracyContext = `${Math.round(avgScore)}% accuracy on ${pd.report.difficult_sounds?.length ? pd.report.difficult_sounds.join(", ") + " sounds" : "pronunciation practice"}`;
          } else {
            bestAccuracyContext = `${Math.round(avgScore)}% accuracy in a practice session`;
          }
        }

        // Aggregate per-phone evidence across sessions. Weighting by the
        // observation count means a phone missed twice in two attempts does not
        // outrank one missed ten times in twelve.
        for (const item of pd.report?.phone_breakdown ?? []) {
          const phone = (item.phone || "").trim();
          if (!phone) continue;
          const bucket = (phoneEvidence[phone] ??= {
            weightedErrors: 0,
            observations: 0,
          });
          const observations = item.observations ?? 0;
          bucket.weightedErrors += (item.error_rate ?? 0) * observations;
          bucket.observations += observations;
        }
      }
    }

    // Compute streak (consecutive days backwards from today/yesterday)
    let streak = 0;
    const todayKey = now.toISOString().split("T")[0];
    const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Start from today if practiced today, else from yesterday
    let checkDate = practiceDays.has(todayKey) ? now : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (!practiceDays.has(todayKey) && !practiceDays.has(yesterdayKey)) {
      streak = 0;
    } else {
      while (true) {
        const key = checkDate.toISOString().split("T")[0];
        if (practiceDays.has(key)) {
          streak++;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }

    // Weakest phones by observed error rate, requiring enough observations that
    // a single unlucky frame is never promoted to a verdict about the speaker.
    const MIN_PHONE_OBSERVATIONS = 3;
    const focusPhonemes = Object.entries(phoneEvidence)
      .filter(([, v]) => v.observations >= MIN_PHONE_OBSERVATIONS)
      .map(([phone, v]) => ({
        phone,
        errorRate: v.weightedErrors / v.observations,
      }))
      .filter((p) => p.errorRate > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 5)
      .map((p) => p.phone);

    // What to practise when there is no evidence yet.
    //
    // The focus areas below are measured, which is the right default -- but a
    // learner on day one has nothing measured, so the card that says "drill
    // /ð/" had nothing to say. Their first language does: these are the sounds
    // speakers of that language typically find hardest. Labelled as a
    // prediction, and never mixed into the measured list.
    let suggestedSounds: string[] = [];
    try {
      const [settings, catalog] = await Promise.all([
        getUserSettings(userId),
        loadSettingsCatalog(),
      ]);
      suggestedSounds =
        catalog.l1Profiles.find((p) => p.code === settings.nativeLanguage)
          ?.weak_phones?.slice(0, 3) ?? [];
    } catch (error) {
      console.error("Could not load L1 suggestions:", error);
    }

    // Recent sessions (top 4)
    const recentSessions = completedSessions.slice(0, 4).map((m) => {
      const pd = m.phonemeData as SessionPhonemeDataPersisted | null;
      const avgScore =
        pd && pd.entries && pd.entries.length > 0
          ? Math.round(
              pd.entries.reduce((sum, e) => sum + e.score, 0) /
                pd.entries.length
            )
          : null;

      return {
        id: m.id,
        name: m.name,
        coachName: sessionLabel(m),
        endedAt: m.endedAt?.toISOString() ?? m.createdAt.toISOString(),
        duration: m.duration,
        accuracy: avgScore,
      };
    });

    // Continue practice card data
    let continuePractice = null;
    if (lastSession) {
      const pd = lastSession.phonemeData as SessionPhonemeDataPersisted | null;
      const avgScore =
        pd && pd.entries && pd.entries.length > 0
          ? Math.round(
              pd.entries.reduce((sum, e) => sum + e.score, 0) /
                pd.entries.length
            )
          : null;

      continuePractice = {
        id: lastSession.id,
        name: lastSession.name,
        coachName: sessionLabel(lastSession),
        status: lastSession.status,
        accuracy: avgScore,
        duration: lastSession.duration,
        endedAt: lastSession.endedAt?.toISOString() ?? null,
        createdAt: lastSession.createdAt.toISOString(),
      };
    }

    const accuracy7d =
      accuracyCount7d > 0 ? Math.round(totalAccuracy7d / accuracyCount7d) : 0;

    return NextResponse.json({
      user: {
        name: session.user.name,
        email: session.user.email,
      },
      continuePractice,
      stats: {
        streak,
        totalSessions,
        accuracy7d,
        practiceMinutes7d: Math.round(practiceMinutes7d),
      },
      recentSessions,
      personalBest: {
        accuracy: Math.round(bestAccuracy),
        context: bestAccuracyContext,
      },
      focusAreas: focusPhonemes,
      suggestedSounds,
      coaches: userAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.instructions.slice(0, 60),
        sessionCount: a.sessionCount,
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
