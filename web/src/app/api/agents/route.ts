import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { agentsInsertSchema } from "@/modules/agents/schemas";

const getManySchema = z.object({
  page: z.number().default(1),
  pageSize: z.number().min(1).max(100).default(10),
  search: z.string().optional(),
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
    });

    const [overallCount] = await db
      .select({ count: count() })
      .from(agents)
      .where(eq(agents.userId, session.user.id));

    if (overallCount.count === 0) {
      const defaultAgents = [
        {
          name: "Daily Conversation Coach",
          instructions: "You are a spoken English coach. Keep responses short. Give one practice item at a time. First say the word or sentence. Use this exact format for practice: repeat after me: <text>. If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one correction.",
          userId: session.user.id,
        },
        {
          name: "Interview English Coach",
          instructions: "You are a spoken English coach. Keep responses short. Give one practice item at a time. First say the word or sentence. Use this exact format for practice: repeat after me: <text>. If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one correction.",
          userId: session.user.id,
        },
        {
          name: "Pronunciation Drill Coach",
          instructions: "You are a spoken English coach. Keep responses short. Give one practice item at a time. First say the word or sentence. Use this exact format for practice: repeat after me: <text>. If pronunciation is good, move to the next item. If pronunciation is weak, repeat the same item slower and give one correction.",
          userId: session.user.id,
        },
      ];
      await db.insert(agents).values(defaultAgents);
    }

    const { search, page, pageSize } = params;

    const data = await db
      .select({
        meetingCount: sql<number>`(
          select count(*)::int
          from ${meetings}
          where ${meetings.agentId} = ${agents.id}
        )`.as("meetingCount"),
        ...getTableColumns(agents),
      })
      .from(agents)
      .where(
        and(
          eq(agents.userId, session.user.id),
          search ? ilike(agents.name, `%${search}%`) : undefined
        )
      )
      .orderBy(desc(agents.createdAt), desc(agents.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [total] = await db
      .select({ count: count() })
      .from(agents)
      .where(
        and(
          eq(agents.userId, session.user.id),
          search ? ilike(agents.name, `%${search}%`) : undefined
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
      { error: "Failed to fetch agents" },
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
    const validatedData = agentsInsertSchema.parse(body);

    const [createdAgent] = await db
      .insert(agents)
      .values({
        ...validatedData,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json(createdAgent);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
