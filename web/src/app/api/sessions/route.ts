import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { sessionsInsertSchema } from "@/modules/sessions/schemas";
import { SessionStatus } from "@/modules/sessions/types";
import {
  backendFailureMessage,
  generatePracticeScript,
} from "@/lib/backend-fetch";
import { getQuota, quotaMessage } from "@/lib/billing";
import { getUserSettings } from "@/lib/settings";

const getManySchema = z.object({
  page: z.number().default(1),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  coachId: z.string().optional(),
  status: z.nativeEnum(SessionStatus).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = getManySchema.parse({
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 10,
      search: searchParams.get("search") || undefined,
      coachId: searchParams.get("coachId") || undefined,
      status: searchParams.get("status") || undefined,
    });

    const { search, page, pageSize, status, coachId } = params;

    const data = await db
      .select({
        ...getTableColumns(practiceSessions),
        coach: coaches,
        duration:
          sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
            "duration"
          ),
      })
      .from(practiceSessions)
      .leftJoin(coaches, eq(practiceSessions.coachId, coaches.id))
      .where(
        and(
          eq(practiceSessions.userId, session.user.id),
          search ? ilike(practiceSessions.name, `%${search}%`) : undefined,
          status ? eq(practiceSessions.status, status) : undefined,
          coachId ? eq(practiceSessions.coachId, coachId) : undefined
        )
      )
      .orderBy(desc(practiceSessions.createdAt), desc(practiceSessions.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [total] = await db
      .select({ count: count() })
      .from(practiceSessions)
      .leftJoin(coaches, eq(practiceSessions.coachId, coaches.id))
      .where(
        and(
          eq(practiceSessions.userId, session.user.id),
          search ? ilike(practiceSessions.name, `%${search}%`) : undefined,
          status ? eq(practiceSessions.status, status) : undefined,
          coachId ? eq(practiceSessions.coachId, coachId) : undefined
        )
      );

    const totalPages = Math.ceil(total.count / pageSize);

    return NextResponse.json({
      items: data,
      total: total.count,
      totalPages,
    });
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = sessionsInsertSchema.parse(body);

    // A coach-backed session inherits topic/accent/focus from the coach, so the
    // learner picks a coach rather than restating what they already configured.
    let coach: typeof coaches.$inferSelect | undefined;
    if (data.coachId) {
      [coach] = await db
        .select()
        .from(coaches)
        .where(
          and(eq(coaches.id, data.coachId), eq(coaches.userId, session.user.id))
        );

      if (!coach) {
        return NextResponse.json({ error: "Coach not found" }, { status: 404 });
      }
    }

    // The learner's own settings fill in what the coach doesn't specify: the
    // accent they are practising and the first language whose interference the
    // generator should pre-empt.
    const userPrefs = await getUserSettings(session.user.id);

    // Free-tier gate. Checked before the script is generated so a capped learner
    // is not charged an OpenRouter call for a session they cannot start; the
    // voice socket re-checks when the token is minted.
    const quota = await getQuota(session.user.id, userPrefs);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quotaMessage(quota.limit), code: "quota_exceeded", quota },
        { status: 402 }
      );
    }

    // The client may pass a script it already previewed and edited; only
    // generate when it didn't.
    //
    // The script is decided once, here, and persisted — not re-generated when
    // the call starts. That keeps a session reproducible: reopening it practises
    // the same steps, and the WebSocket engine just executes what it is handed.
    //
    // The backend endpoint never returns short (it degrades to a band-validated
    // fallback bank), so a failure here means the call never landed -- and the
    // reason it did not is carried back rather than guessed at.
    let script = data.script ?? null;
    if (!script) {
      const result = await generatePracticeScript({
        source: data.source,
        difficulty: data.difficulty,
        step_count: data.stepCount,
        topic: coach?.topic || undefined,
        coach_name: coach?.name,
        accent: coach?.accent || userPrefs.targetAccent,
        focus_sounds: coach?.focusSounds ?? [],
        l1: userPrefs.nativeLanguage || undefined,
        source_text: data.sourceText ?? undefined,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: backendFailureMessage(result.failure) },
          { status: 502 }
        );
      }
      script = result.data;
    }

    const [createdSession] = await db
      .insert(practiceSessions)
      .values({
        name: data.name,
        coachId: data.coachId ?? null,
        source: data.source,
        sourceText: data.sourceText ?? null,
        difficulty: data.difficulty,
        script,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json(createdSession);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
