"use client";

import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

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
                description={error.message || "Something went wrong while loading your meetings. Please try again."}
            />
        );
    }

    if (!data) {
        return <MeetingsViewLoading />;
    }

    return (
        <div className="overflow-x-scroll">
                {JSON.stringify(data)}
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
