import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { coachesUpdateSchema } from "@/modules/coaches/schemas";

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

    const [existingCoach] = await db
      .select({
        sessionCount: sql<number>`(
          select count(*)::int
          from ${practiceSessions}
          where ${practiceSessions.coachId} = ${coaches.id}
        )`.as("sessionCount"),
        ...getTableColumns(coaches),
      })
      .from(coaches)
      .where(
        and(eq(coaches.id, id), eq(coaches.userId, session.user.id))
      );

    if (!existingCoach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    return NextResponse.json(existingCoach);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch coach" },
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
    const validatedData = coachesUpdateSchema.parse(body);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...updateData } = validatedData;

    const [updatedCoach] = await db
      .update(coaches)
      .set(updateData)
      .where(and(eq(coaches.id, paramId), eq(coaches.userId, session.user.id)))
      .returning();

    if (!updatedCoach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    return NextResponse.json(updatedCoach);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to update coach" },
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

    const [removedCoach] = await db
      .delete(coaches)
      .where(
        and(eq(coaches.id, id), eq(coaches.userId, session.user.id))
      )
      .returning();

    if (!removedCoach) {
      return NextResponse.json({ error: "Coach not found" }, { status: 404 });
    }

    return NextResponse.json(removedCoach);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to delete coach" },
      { status: 500 }
    );
  }
}
