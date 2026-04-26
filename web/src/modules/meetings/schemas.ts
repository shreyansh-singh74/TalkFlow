import { z } from "zod";

export const meetingsInsertSchema = z.object({
    name: z.string().min(1,{message: "Name is required"}),
    agentId: z.string().min(1,{message: "Agent is required"})
});

export const meetingsUpdateSchema = z
  .object({
    id: z.string().min(1, { message: "Id is required" }),
    name: z.string().min(1, { message: "Name is required" }).optional(),
    agentId: z.string().min(1, { message: "Agent is required" }).optional(),
    phonemeData: z.unknown().optional(),
  })
  .refine(
    (d) => d.name != null || d.agentId != null || d.phonemeData != null,
    { message: "At least one of name, agentId, or phonemeData" }
  );
