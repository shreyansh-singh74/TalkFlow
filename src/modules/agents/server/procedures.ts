import { db } from "@/db";
import { agents } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { agentsInsertSchema, agentsUpdateSchema } from "../schemas";
import { z } from "zod";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from "@/constants";

export const agentsRouter = createTRPCRouter({
  update: protectedProcedure
    .input(agentsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...updateData } = input;
      const [updatedAgent] = await db
        .update(agents)
        .set(updateData)
        .where(
          and(eq(agents.id, id), eq(agents.userId, ctx.auth.user.id))
        )
        .returning();
      if (!updatedAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }
      return updatedAgent;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [removedAgent] = await db
        .delete(agents)
        .where(
          and(eq(agents.id, input.id), eq(agents.userId, ctx.auth.user.id))
        )
        .returning();
      if (!removedAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent not found",
        });
      }
      return removedAgent;
    }),
  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const [existingAgent] = await db
          .select({
            // TODO : Change to actual count
            meetingCount: sql<number>`5`,
            ...getTableColumns(agents),
          })
          .from(agents)
          .where(
            and(eq(agents.id, input.id), eq(agents.userId, ctx.auth.user.id))
          );

        if (!existingAgent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agent not found",
          });
        }

        return existingAgent;
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
            // TODO : Change to actual count
            meetingCount: sql<number>`5`,
            ...getTableColumns(agents),
          })
          .from(agents)
          .where(
            and(
              eq(agents.userId, ctx.auth.user.id),
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
              eq(agents.userId, ctx.auth.user.id),
              search ? ilike(agents.name, `%${search}%`) : undefined
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
    }),
  create: protectedProcedure
    .input(agentsInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [createdAgent] = await db
        .insert(agents)
        .values({
          ...input,
          userId: ctx.auth.user.id,
        })
        .returning();

      return createdAgent;
    }),
});
