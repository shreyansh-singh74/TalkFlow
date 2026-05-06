// Direct type definitions instead of tRPC inference
export type MeetingGetMany = Array<{
  id: string;
  name: string;
  status: MeetingStatus;
  agentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  agent: {
    id: string;
    name: string;
    instructions: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  };
  duration: number | null;
}>;

export type MeetingGetOne = {
  id: string;
  name: string;
  status: MeetingStatus;
  agentId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  agent: {
    id: string;
    name: string;
    instructions: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  };
  duration: number | null;
};
export enum MeetingStatus {
  Upcoming = "upcoming",
  Completed = "completed",
  Cancelled = "cancelled",
  Active = "active",
  Processing = "processing",
}
