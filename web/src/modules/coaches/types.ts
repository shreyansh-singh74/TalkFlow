// Direct type definitions instead of tRPC inference
import type { Difficulty } from "@/types/practice";

export type CoachGetMany = Array<{
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
  sessionCount: number;
}>;

export type CoachGetOne = {
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
  sessionCount: number;
};
