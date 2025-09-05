"use client";

import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { columns } from "../components/columns";
import { EmptyState } from "@/components/empty-state";

export const MeetingsView = () => {
  const trpc = useTRPC();
  const { data, isLoading, error } = useQuery(
    trpc.meetings.getMany.queryOptions({})
  );

  if (isLoading) {
    return <MeetingsViewLoading />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Meetings"
        description={
          error.message ||
          "Something went wrong while loading your meetings. Please try again."
        }
      />
    );
  }

  if (!data) {
    return <MeetingsViewLoading />;
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="Create Your First Meeting"
        description="Create a meeting to start collaborating with your agents."
      />
    );
  }
  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable data={data.items} columns={columns} />
    </div>
  );
};

export const MeetingsViewLoading = () => {
  return (
    <LoadingState
      title="Loading Meetings"
      description="This may take few seconds"
    />
  );
};
