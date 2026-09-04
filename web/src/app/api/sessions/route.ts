import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { sessionsInsertSchema } from "@/modules/sessions/schemas";
import { SessionStatus } from "@/modules/sessions/types";
import { getBackendUrl } from "@/lib/backend-config";
import type { PracticeScript, ScriptRequest } from "@/types/practice";

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

/**
 * Resolve the practice script for a new session.
 *
 * The script is decided once, here, and persisted — not re-generated when the
 * call starts. That keeps a session reproducible: reopening it practises the
 * same steps, and the WebSocket engine just executes what it is handed.
 *
 * The backend endpoint never throws and never returns short (it degrades to a
 * band-validated fallback bank), so a null return here means the backend was
 * unreachable outright.
 */
async function resolveScript(
  body: ScriptRequest
): Promise<PracticeScript | null> {
  try {
    const response = await fetch(`${getBackendUrl()}/api/practice/script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      console.error("Script generation failed", response.status);
      return null;
    }
    return (await response.json()) as PracticeScript;
  } catch (error) {
    console.error("Script generation unreachable:", error);
    return null;
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

    // The client may pass a script it already previewed and edited; only
    // generate when it didn't.
    const script =
      data.script ??
      (await resolveScript({
        source: data.source,
        difficulty: data.difficulty,
        step_count: data.stepCount,
        topic: coach?.topic || undefined,
        coach_name: coach?.name,
        accent: coach?.accent ?? "en-US",
        focus_sounds: coach?.focusSounds ?? [],
        source_text: data.sourceText ?? undefined,
      }));

    if (!script) {
      return NextResponse.json(
        { error: "Could not build a practice script. Is the backend running?" },
        { status: 502 }
      );
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
