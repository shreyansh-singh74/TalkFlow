import { db } from "@/db";
import { agents } from "@/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { agentsInsertSchema } from "../schemas";
import { z } from "zod";
import { eq, getTableColumns, sql } from "drizzle-orm";

export const agentsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const [existingAgent] = await db
          .select({
            // TODO : Change to actual count
            meetingCount: sql<number>`5`,
            ...getTableColumns(agents),
          })
          .from(agents)
          .where(eq(agents.id, input.id));
        return existingAgent || null;
      } catch (error) {
        console.error("Database error:", error);
        return null;
      }
    }),
  getMany: protectedProcedure.query(async () => {
    try {
      const data = await db.select().from(agents);
      return data;
    } catch (error) {
      console.error("Database error:", error);
      // Return empty array for now to prevent app breaking
      return [];
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
