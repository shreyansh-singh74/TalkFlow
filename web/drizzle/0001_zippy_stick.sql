CREATE TYPE "public"."plan_tier" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"native_language" text DEFAULT '' NOT NULL,
	"target_accent" text DEFAULT 'en-US' NOT NULL,
	"tts_voice" text DEFAULT '' NOT NULL,
	"tts_rate" real DEFAULT 1 NOT NULL,
	"retain_audio" boolean DEFAULT false NOT NULL,
	"practice_goal" text DEFAULT '' NOT NULL,
	"level" text DEFAULT 'beginner' NOT NULL,
	"onboarded_at" timestamp,
	"plan" "plan_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_idx" ON "user_settings" USING btree ("user_id");