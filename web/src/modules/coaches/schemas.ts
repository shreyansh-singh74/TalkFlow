import { z } from "zod";

const difficulty = z.enum(["easy", "medium", "hard"]);

export const coachesInsertSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }),
  topic: z.string().trim().min(3, { message: "Topic must be at least 3 characters" }),
  difficulty,
  accent: z.string().min(1).default("en-US"),
  focusSounds: z.array(z.string().trim().min(1)).default([]),
  // Personality is optional; topic + difficulty are the required coaching setup.
  instructions: z.string().trim().default(""),
});

export const coachesUpdateSchema = coachesInsertSchema.extend({
  id: z.string().min(1, { message: "Id is required" }),
});

export type CoachFormValues = z.input<typeof coachesInsertSchema>;
