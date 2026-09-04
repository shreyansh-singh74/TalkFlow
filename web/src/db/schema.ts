import { nanoid } from "nanoid";
import { pgTable, text, timestamp, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import type { SessionPhonemeDataPersisted } from "@/types/pronunciation";
import type { PracticeScript } from "@/types/practice";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

// Difficulty is an enforced band (word count + syllable profile + pass
// threshold), defined once in `backend/app/services/practice_content.py` and
// exposed via GET /api/practice/difficulty. Keep these three values in sync
// with DIFFICULTY_BANDS there.
export const difficultyLevel = pgEnum("difficulty_level", [
  "easy",
  "medium",
  "hard",
]);

// "coach" = steps generated from the coach's topic; "custom" = steps segmented
// from text the user pasted (speech prep).
export const sessionSource = pgEnum("session_source", ["coach", "custom"]);

export const coaches = pgTable("coaches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // What to practise, e.g. "Job interviews in tech". Drives script generation.
  topic: text("topic").notNull().default(""),
  difficulty: difficultyLevel("difficulty").notNull().default("medium"),
  accent: text("accent").notNull().default("en-US"),
  // Optional ARPAbet/IPA hints, e.g. ["θ", "r"], biasing generated sentences.
  focusSounds: jsonb("focus_sounds").$type<string[]>().default([]),
  // Coach personality. Optional now that topic/difficulty carry the intent.
  instructions: text("instructions").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const practiceSessionStatus = pgEnum("practice_session_status",[
  "upcoming",
  "active",
  "processing",
  "completed",
  "cancelled"
])

// Named `practiceSessions`/`practice_sessions` rather than `sessions` so it can
// never be confused with Better Auth's `session` table above, nor with the
// `const session = await auth.api.getSession(...)` local in every route handler.
export const practiceSessions = pgTable("practice_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Null for custom (pasted-text) sessions, which have no coach behind them.
  coachId: text("coach_id").references(() => coaches.id, { onDelete: "cascade" }),
  status: practiceSessionStatus("status").notNull().default("upcoming"),
  source: sessionSource("source").notNull().default("coach"),
  // The user's pasted content, verbatim. Kept so the script can be re-segmented
  // at a different difficulty without making them paste it again.
  sourceText: text("source_text"),
  // The practice steps, resolved at creation time and possibly hand-edited in
  // the preview. This is what the WebSocket engine executes -- the backend
  // chooses no content of its own.
  script: jsonb("script").$type<PracticeScript>(),
  difficulty: difficultyLevel("difficulty").notNull().default("medium"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  transcriptUrl: text("transcript_url"),
  recordingUrl: text("recording_url"),
  summary: text("summary"),
  phonemeData: jsonb("phoneme_data").$type<SessionPhonemeDataPersisted>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

