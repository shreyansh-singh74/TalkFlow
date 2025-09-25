import { auth } from "@/lib/auth";
import { MeetingIdView } from "@/modules/meetings/ui/views/meeting-id-view";
import { MeetingsViewLoading } from "@/modules/meetings/ui/views/meetings-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";
import { TRPCError } from "@trpc/server";

interface Props {
  params: Promise<{ meetingId: string }>;
}

export default async function Page({ params }: Props) {
  try {
    const { meetingId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      redirect("/sign-in");
    }

    // Validate meetingId format (optional but good practice)
    if (!meetingId || typeof meetingId !== 'string') {
      return (
        <div className="flex-1 py-4 px-4 md:px-8">
          <ErrorState
            title="Invalid Meeting ID"
            description="The meeting ID provided is not valid."
          />
        </div>
      );
    }

    const queryClient = getQueryClient();
    
    // Try to prefetch the meeting data and catch any errors
    try {
      await queryClient.prefetchQuery(
        trpc.meetings.getOne.queryOptions({ id: meetingId })
      );
    } catch (error) {
      console.error("Failed to prefetch meeting:", error);
      
      // Handle specific tRPC errors
      if (error instanceof TRPCError) {
        if (error.code === 'NOT_FOUND') {
          return (
            <div className="flex-1 py-4 px-4 md:px-8">
              <ErrorState
                title="Meeting Not Found"
                description="The meeting you're looking for doesn't exist or you don't have permission to view it."
              />
            </div>
          );
        }
        
        if (error.code === 'UNAUTHORIZED') {
          redirect("/sign-in");
        }
      }
      
      // For other errors, still render the component but let the client handle it
      // This allows the client-side error handling to work
    }

    return (
      <div>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<MeetingsViewLoading />}>
            <MeetingIdView meetingId={meetingId} />
          </Suspense>
        </HydrationBoundary>
      </div>
    );
    
  } catch (error) {
    console.error("Page error:", error);
    
    // Catch-all error handler
    return (
      <div className="flex-1 py-4 px-4 md:px-8">
        <ErrorState
          title="Something went wrong"
          description="An unexpected error occurred while loading the meeting page."
        />
      </div>
    );
  }
}
