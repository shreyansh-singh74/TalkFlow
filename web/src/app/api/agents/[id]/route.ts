import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { agentsUpdateSchema } from "@/modules/agents/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [existingAgent] = await db
      .select({
        meetingCount: sql<number>`5`, // TODO: Change to actual count
        ...getTableColumns(agents),
      })
      .from(agents)
      .where(
        and(eq(agents.id, params.id), eq(agents.userId, session.user.id))
      );

    if (!existingAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(existingAgent);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = agentsUpdateSchema.parse(body);
    const { id, ...updateData } = validatedData;

    const [updatedAgent] = await db
      .update(agents)
      .set(updateData)
      .where(and(eq(agents.id, params.id), eq(agents.userId, session.user.id)))
      .returning();

    if (!updatedAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [removedAgent] = await db
      .delete(agents)
      .where(
        and(eq(agents.id, params.id), eq(agents.userId, session.user.id))
      )
      .returning();

    if (!removedAgent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(removedAgent);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
