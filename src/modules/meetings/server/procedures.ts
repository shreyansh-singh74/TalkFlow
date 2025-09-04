import { db } from "@/db";
import { meetings } from "@/db/schema";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, count, desc, eq, getTableColumns, ilike } from "drizzle-orm";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";

export const meetingsRouter = createTRPCRouter({
  
  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const [existingMeeting] = await db
          .select({
            ...getTableColumns(meetings),
          })
          .from(meetings)
          .where(
            and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id))
          );

        if (!existingMeeting) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Meeting not found",
          });
        }

        return existingMeeting;
      } catch (error) {
        console.error("Database error:", error);
        // Re-throw tRPC errors
        if (error instanceof TRPCError) {
          throw error;
        }
        // For other database errors, throw internal server error
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch agent",
          });
      }
    }),
  getMany: protectedProcedure
    .input(
      z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z
          .number()
          .min(MIN_PAGE_SIZE)
          .max(MAX_PAGE_SIZE)
          .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize } = input;
      try {
        const data = await db
          .select({
            ...getTableColumns(meetings),
          })
          .from(meetings)
          .where(
            and(
              eq(meetings.userId, ctx.auth.user.id),
              search ? ilike(meetings.name, `%${search}%`) : undefined
            )
          )
          .orderBy(desc(meetings.createdAt), desc(meetings.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        const [total] = await db
          .select({ count: count() })
          .from(meetings)
          .where(
            and(
              eq(meetings.userId, ctx.auth.user.id),
              search ? ilike(meetings.name, `%${search}%`) : undefined
            )
          );

        const totalPages = Math.ceil(total.count / pageSize);

        return {
          items: data,
          total: total.count,
          totalPages,
        };
      } catch (error) {
        console.error("Database error:", error);
        // Return consistent structure to prevent type errors
        return {
          items: [],
          total: 0,
          totalPages: 0,
        };
      }
    })
});
