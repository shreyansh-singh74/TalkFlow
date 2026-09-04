import { z } from "zod";
import { SessionStatus } from "./types";

const difficulty = z.enum(["easy", "medium", "hard"]);
const source = z.enum(["coach", "custom"]);

export const practiceStepSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string().trim().min(1),
  word_count: z.number().int().nonnegative(),
  note: z.string().nullable().optional(),
});

export const practiceScriptSchema = z.object({
  steps: z.array(practiceStepSchema).min(1),
  difficulty,
  pass_threshold: z.number().min(0).max(100),
  generated_by: z.enum(["llm", "fallback", "segmenter"]),
  source_label: z.string(),
  truncated: z.boolean().optional(),
});

const sessionFields = {
  name: z.string().trim().min(1, { message: "Name is required" }),
  coachId: z.string().min(1, { message: "Coach is required" }).nullable().optional(),
  source,
  sourceText: z.string().optional().nullable(),
  difficulty,
  stepCount: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
  script: practiceScriptSchema.optional(),
};

export const sessionsInsertSchema = z
  .object(sessionFields)
  .superRefine((data, ctx) => {
    if (data.source === "custom") {
      if (!data.sourceText || data.sourceText.trim().length < 120) {
        ctx.addIssue({
          code: "custom",
          path: ["sourceText"],
          message: "Paste at least 120 characters of text",
        });
      }
      if (data.coachId != null) {
        ctx.addIssue({
          code: "custom",
          path: ["coachId"],
          message: "A custom session does not use a coach",
        });
      }
    } else if (!data.coachId) {
      ctx.addIssue({
        code: "custom",
        path: ["coachId"],
        message: "Choose a coach",
      });
    }
  });

export const sessionsUpdateSchema = z
  .object({
    id: z.string().min(1, { message: "Id is required" }),
    name: z.string().trim().min(1, { message: "Name is required" }).optional(),
    coachId: z.string().min(1, { message: "Coach is required" }).nullable().optional(),
    source: source.optional(),
    sourceText: z.string().nullable().optional(),
    difficulty: difficulty.optional(),
    stepCount: z.union([z.literal(5), z.literal(10), z.literal(15)]).optional(),
    script: practiceScriptSchema.optional(),
    phonemeData: z.unknown().optional(),
    status: z.nativeEnum(SessionStatus).optional(),
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional(),
  })
  .refine(
    (d) =>
      d.name != null ||
      d.coachId != null ||
      d.source != null ||
      d.sourceText != null ||
      d.difficulty != null ||
      d.stepCount != null ||
      d.script != null ||
      d.phonemeData != null ||
      d.status != null ||
      d.startedAt != null ||
      d.endedAt != null,
    { message: "At least one field is required" }
  );

export type SessionFormValues = z.input<typeof sessionsInsertSchema>;
