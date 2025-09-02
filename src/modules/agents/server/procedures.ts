import { db } from "@/db";
import { agents } from "@/db/schema";
import { baseProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";

export const agentsRouter = createTRPCRouter({
    getMany: baseProcedure.query(async ()=>{
        try {
            const data = await db.select().from(agents);
            return data;
        } catch (error) {
            console.error("Database error:", error);
            // Return empty array for now to prevent app breaking
            return [];
        }
    }),
})