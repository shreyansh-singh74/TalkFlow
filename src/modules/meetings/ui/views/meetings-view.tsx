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
        <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
            <div className="bg-white rounded-lg border p-4">
                <h2 className="text-lg font-semibold mb-4">Meetings</h2>
                {data.items.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No meetings found</p>
                        <p className="text-sm text-gray-400 mt-2">Your meetings will appear here once you create them</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {data.items.map((meeting) => (
                            <div key={meeting.id} className="border rounded-lg p-4">
                                <h3 className="font-medium">{meeting.name}</h3>
                                <p className="text-sm text-gray-500">Status: {meeting.status}</p>
                                <p className="text-xs text-gray-400">
                                    Created: {new Date(meeting.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
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
