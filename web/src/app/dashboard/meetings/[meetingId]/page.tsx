import { auth } from "@/lib/auth";
import { MeetingIdView } from "@/modules/meetings/ui/views/meeting-id-view";
import { MeetingsViewLoading } from "@/modules/meetings/ui/views/meetings-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";

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

    return (
      <div>
        <Suspense fallback={<MeetingsViewLoading />}>
          <MeetingIdView meetingId={meetingId} />
        </Suspense>
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
