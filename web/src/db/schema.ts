import { nanoid } from "nanoid";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  pgEnum,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
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

// ---------------------------------------------------------------------------
// Per-user settings
// ---------------------------------------------------------------------------

// Free is the default tier and is capped by session count per calendar month
// (see lib/billing.ts). Kept as a column on user_settings rather than a new
// table because a learner has exactly one current plan, and history lives in
// Stripe.
export const planTier = pgEnum("plan_tier", ["free", "pro"]);

// One row per user, created on first read (and on sign-up). Everything the
// product needs to *personalise* practice lives here:
//
// * `nativeLanguage` and `targetAccent` are the two inputs that decide which
//   reference the scorer compares against and which sounds get coached.
// * `retainAudio` is real consent, not a display preference: the voice socket
//   requires it before it will write a turn to disk (see the backend's
//   PERSIST_TURN_AUDIO / retain_audio pair).
//
// `onboardedAt` is what the dashboard gate reads. It is nullable on purpose:
// an account created before this table existed reads as "never onboarded" and
// gets asked once, instead of silently keeping wrong defaults.
export const userSettings = pgTable(
  "user_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default(""),
    // Bare lowercase code the backend resolves an interference profile from
    // ("ja", "es", ...), or "" when the learner skipped the question.
    nativeLanguage: text("native_language").notNull().default(""),
    targetAccent: text("target_accent").notNull().default("en-US"),
    // Empty means "use the accent profile's voice".
    ttsVoice: text("tts_voice").notNull().default(""),
    ttsRate: real("tts_rate").notNull().default(1),
    retainAudio: boolean("retain_audio").notNull().default(false),
    practiceGoal: text("practice_goal").notNull().default(""),
    level: text("level").notNull().default("beginner"),
    onboardedAt: timestamp("onboarded_at"),
    plan: planTier("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_settings_user_idx").on(table.userId)]
);

// Stripe delivers at least once and retries on any non-2xx, so every webhook
// handler has to be idempotent. Recording the event id here (unique) is the
// cheap way to get that: the insert either wins and the event is applied, or it
// conflicts and the event has already been applied. Without it, a retried
// `customer.subscription.deleted` re-runs against state that has moved on.
export const stripeEvents = pgTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
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
// Per-phone practice queue.
//
// The session report has always aggregated real per-phone evidence into
// `difficult_sounds`, but nothing read it back: "Drill these sounds" linked to
// the sessions list. This table is the missing reader -- one row per phone a
// learner has actually struggled with, with the counters that decide when it is
// worth reviewing again.
//
// The scheduling is deliberately simple (an interval that grows while the phone
// stays correct, reset when it does not). Spaced repetition is only useful if
// the queue is short and honest; a real SRS algorithm can replace `nextReviewAt`
// without anything else changing.
export const soundGoals = pgTable(
  "sound_goals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Bare IPA symbol, e.g. "ð" -- the same label the report uses.
    phone: text("phone").notNull(),
    observations: integer("observations").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    // How many drills this phone has been served in.
    drillCount: integer("drill_count").notNull().default(0),
    lastPractisedAt: timestamp("last_practised_at"),
    nextReviewAt: timestamp("next_review_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // One goal per phone per learner: it is a queue position, not a log.
    uniqueIndex("sound_goals_user_phone_idx").on(table.userId, table.phone),
  ]
);

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
  // Set when the session was created as a targeted drill for one phone, so the
  // history can distinguish "practised my weak sound" from "practised in general".
  drillPhone: text("drill_phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

