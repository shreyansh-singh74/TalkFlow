// Direct type definitions instead of tRPC inference
export type AgentGetMany = Array<{
  id: string;
  name: string;
  instructions: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  meetingCount: number;
}>;

export type AgentGetOne = {
  id: string;
  name: string;
  instructions: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  meetingCount: number;
};
