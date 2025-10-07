// Direct type definitions instead of tRPC inference
export type MeetingGetMany = Array<{
  id: string;
  name: string;
  status: MeetingStatus;
  agentId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  agent: {
    id: string;
    name: string;
    instructions: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  duration: number | null;
}>;

export type MeetingGetOne = {
  id: string;
  name: string;
  status: MeetingStatus;
  agentId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  agent: {
    id: string;
    name: string;
    instructions: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
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
