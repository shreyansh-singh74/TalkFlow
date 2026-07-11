import { z } from "zod";
import { MeetingStatus } from "./types";

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
    status: z.nativeEnum(MeetingStatus).optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional(),
  })
  .refine(
    (d) =>
      d.name != null ||
      d.agentId != null ||
      d.phonemeData != null ||
      d.status != null ||
      d.startedAt != null ||
      d.endedAt != null,
    { message: "At least one field is required" }
  );
