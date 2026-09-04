import type { Difficulty, PracticeScript, SessionSource } from "@/types/practice";

type SessionCoach = {
  id: string;
  name: string;
  topic: string;
  difficulty: Difficulty;
  accent: string;
  focusSounds: string[] | null;
  instructions: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

type SessionShape = {
  id: string;
  name: string;
  status: SessionStatus;
  /** Null for custom (pasted-text) sessions. */
  coachId: string | null;
  source: SessionSource;
  sourceText: string | null;
  difficulty: Difficulty;
  /** Resolved at creation time and executed verbatim by the call engine. */
  script: PracticeScript | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  coach: SessionCoach | null;
  duration: number | null;
};

export type SessionGetMany = Array<SessionShape>;
export type SessionGetOne = SessionShape;

export enum SessionStatus {
  Upcoming = "upcoming",
  Completed = "completed",
  Cancelled = "cancelled",
  Active = "active",
  Processing = "processing",
}
