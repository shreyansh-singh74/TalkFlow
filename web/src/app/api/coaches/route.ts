import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coaches, practiceSessions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { coachesInsertSchema } from "@/modules/coaches/schemas";
import { DEFAULT_COACHES } from "@/modules/coaches/default-coaches";

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
      .from(coaches)
      .where(eq(coaches.userId, session.user.id));

    if (overallCount.count === 0) {
      await db.insert(coaches).values(
        DEFAULT_COACHES.map((coach) => ({ ...coach, userId: session.user.id }))
      );
    }

    const { search, page, pageSize } = params;

    const data = await db
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
        and(
          eq(coaches.userId, session.user.id),
          search ? ilike(coaches.name, `%${search}%`) : undefined
        )
      )
      .orderBy(desc(coaches.createdAt), desc(coaches.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [total] = await db
      .select({ count: count() })
      .from(coaches)
      .where(
        and(
          eq(coaches.userId, session.user.id),
          search ? ilike(coaches.name, `%${search}%`) : undefined
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
      { error: "Failed to fetch coaches" },
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
    const validatedData = coachesInsertSchema.parse(body);

    const [createdCoach] = await db
      .insert(coaches)
      .values({
        ...validatedData,
        userId: session.user.id,
      })
      .returning();

    return NextResponse.json(createdCoach);
  } catch (error) {
    console.error("Database error:", error);
    return NextResponse.json(
      { error: "Failed to create coach" },
      { status: 500 }
    );
  }
}
