import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, desc, eq, sql, count } from "drizzle-orm";
import type { MeetingPhonemeDataPersisted } from "@/types/pronunciation";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Fetch all completed meetings with agent info and phoneme data
    const completedMeetings = await db
      .select({
        id: meetings.id,
        name: meetings.name,
        status: meetings.status,
        startedAt: meetings.startedAt,
        endedAt: meetings.endedAt,
        phonemeData: meetings.phonemeData,
        agentId: meetings.agentId,
        agentName: agents.name,
        createdAt: meetings.createdAt,
        duration:
          sql<number>`EXTRACT(EPOCH FROM (${meetings.endedAt} - ${meetings.startedAt}))`.as(
            "duration"
          ),
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(
        and(
          eq(meetings.userId, userId),
          eq(meetings.status, "completed")
        )
      )
      .orderBy(desc(meetings.endedAt), desc(meetings.createdAt))
      .limit(50);

    // 2. Fetch the most recent meeting of any status (for "Continue practice")
    const [lastMeeting] = await db
      .select({
        id: meetings.id,
        name: meetings.name,
        status: meetings.status,
        startedAt: meetings.startedAt,
        endedAt: meetings.endedAt,
        phonemeData: meetings.phonemeData,
        agentId: meetings.agentId,
        agentName: agents.name,
        createdAt: meetings.createdAt,
        duration:
          sql<number>`EXTRACT(EPOCH FROM (${meetings.endedAt} - ${meetings.startedAt}))`.as(
            "duration"
          ),
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(eq(meetings.userId, userId))
      .orderBy(desc(meetings.createdAt))
      .limit(1);

    // 3. Fetch all agents
    const userAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        instructions: agents.instructions,
        meetingCount: sql<number>`(
          select count(*)::int
          from ${meetings}
          where ${meetings.agentId} = ${agents.id}
        )`.as("meetingCount"),
      })
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(desc(agents.createdAt));

    // 4. Total completed sessions count
    const [totalResult] = await db
      .select({ count: count() })
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, userId),
          eq(meetings.status, "completed")
        )
      );
    const totalSessions = totalResult?.count ?? 0;

    // 5. Compute stats from completed meetings
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let totalAccuracy7d = 0;
    let accuracyCount7d = 0;
    let practiceMinutes7d = 0;
    let bestAccuracy = 0;
    let bestAccuracyContext = "";

    // Track phoneme errors for focus areas
    const phonemeErrorCounts: Record<string, number> = {};

    // Track unique practice days for streak
    const practiceDays = new Set<string>();

    for (const meeting of completedMeetings) {
      const endDate = meeting.endedAt ? new Date(meeting.endedAt) : null;
      const duration = meeting.duration ?? 0;

      // Add to practice days set
      if (endDate) {
        const dayKey = endDate.toISOString().split("T")[0];
        practiceDays.add(dayKey);
      }

      // Parse phoneme data
      const pd = meeting.phonemeData as MeetingPhonemeDataPersisted | null;
      if (pd && pd.entries && pd.entries.length > 0) {
        // Average accuracy for this meeting
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

        // Aggregate phoneme errors for focus areas
        for (const entry of pd.entries) {
          if (entry.feedback) {
            for (const fb of entry.feedback) {
              // Try to extract phoneme sounds from feedback
              const phonemeMatch = fb.match(/['"]([^'"]+)['"]/g);
              if (phonemeMatch) {
                for (const match of phonemeMatch) {
                  const sound = match.replace(/['"]/g, "").toLowerCase();
                  if (sound.length <= 4) {
                    phonemeErrorCounts[sound] =
                      (phonemeErrorCounts[sound] || 0) + 1;
                  }
                }
              }
            }
          }
        }

        // Also extract from report if available
        if (pd.report?.difficult_sounds) {
          for (const sound of pd.report.difficult_sounds) {
            phonemeErrorCounts[sound] = (phonemeErrorCounts[sound] || 0) + 3;
          }
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

    // Top 5 weakest phonemes
    const focusPhonemes = Object.entries(phonemeErrorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phoneme]) => phoneme);

    // Recent sessions (top 4)
    const recentSessions = completedMeetings.slice(0, 4).map((m) => {
      const pd = m.phonemeData as MeetingPhonemeDataPersisted | null;
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
        agentName: m.agentName,
        endedAt: m.endedAt?.toISOString() ?? m.createdAt.toISOString(),
        duration: m.duration,
        accuracy: avgScore,
      };
    });

    // Continue practice card data
    let continuePractice = null;
    if (lastMeeting) {
      const pd = lastMeeting.phonemeData as MeetingPhonemeDataPersisted | null;
      const avgScore =
        pd && pd.entries && pd.entries.length > 0
          ? Math.round(
              pd.entries.reduce((sum, e) => sum + e.score, 0) /
                pd.entries.length
            )
          : null;

      continuePractice = {
        id: lastMeeting.id,
        name: lastMeeting.name,
        agentName: lastMeeting.agentName,
        status: lastMeeting.status,
        accuracy: avgScore,
        duration: lastMeeting.duration,
        endedAt: lastMeeting.endedAt?.toISOString() ?? null,
        createdAt: lastMeeting.createdAt.toISOString(),
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
      agents: userAgents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.instructions.slice(0, 60),
        meetingCount: a.meetingCount,
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
