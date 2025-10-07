import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { meetingsInsertSchema } from "@/modules/meetings/schemas";
import { MeetingStatus } from "@/modules/meetings/types";

const getManySchema = z.object({
  page: z.number().default(1),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
  agentId: z.string().optional(),
  status: z.nativeEnum(MeetingStatus).optional(),
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
      agentId: searchParams.get("agentId") || undefined,
      status: searchParams.get("status") || undefined,
    });

    const { search, page, pageSize, status, agentId } = params;

    const data = await db
      .select({
        ...getTableColumns(meetings),
        agent: agents,
        duration:
          sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as(
            "duration"
          ),
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(
        and(
          eq(meetings.userId, session.user.id),
          search ? ilike(meetings.name, `%${search}%`) : undefined,
          status ? eq(meetings.status, status) : undefined,
          agentId ? eq(meetings.agentId, agentId) : undefined
        )
      )
      .orderBy(desc(meetings.createdAt), desc(meetings.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [total] = await db
      .select({ count: count() })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(
        and(
          eq(meetings.userId, session.user.id),
          search ? ilike(meetings.name, `%${search}%`) : undefined,
          status ? eq(meetings.status, status) : undefined,
          agentId ? eq(meetings.agentId, agentId) : undefined
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
      { error: "Failed to fetch meetings" },
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
    const validatedData = meetingsInsertSchema.parse(body);

    const [createdMeeting] = await db
      .insert(meetings)
      .values({
        ...validatedData,
        userId: session.user.id,
      })
      .returning();

    // TODO: Implement custom WebRTC call creation
    // This will be replaced with your own WebRTC implementation
    console.log("Creating WebRTC call for meeting:", createdMeeting.id);

    return NextResponse.json(createdMeeting);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to create meeting" },
      { status: 500 }
    );
  }
}
