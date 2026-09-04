import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { sessionsUpdateSchema } from "@/modules/sessions/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [existingSession] = await db
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
          eq(practiceSessions.id, id),
          eq(practiceSessions.userId, session.user.id)
        )
      );

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(existingSession);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: paramId } = await params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = sessionsUpdateSchema.parse(body);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = validatedData;
    const updateData = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;

    const [updatedSession] = await db
      .update(practiceSessions)
      .set(updateData)
      .where(and(eq(practiceSessions.id, paramId), eq(practiceSessions.userId, session.user.id)))
      .returning();

    if (!updatedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [removedSession] = await db
      .delete(practiceSessions)
      .where(
        and(eq(practiceSessions.id, id), eq(practiceSessions.userId, session.user.id))
      )
      .returning();

    if (!removedSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(removedSession);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
}
