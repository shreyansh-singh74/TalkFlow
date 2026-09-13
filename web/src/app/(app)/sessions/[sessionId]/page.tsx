import { auth } from "@/lib/auth";
import { SessionIdView } from "@/modules/sessions/ui/views/session-id-view";
import { SessionsViewLoading } from "@/modules/sessions/ui/views/sessions-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorState } from "@/components/error-state";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function Page({ params }: Props) {
  try {
    const { sessionId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      redirect("/sign-in");
    }

    // Validate sessionId format (optional but good practice)
    if (!sessionId || typeof sessionId !== 'string') {
      return (
        <div className="flex-1 py-4 px-4 md:px-8">
          <ErrorState
            title="Invalid Session ID"
            description="The session ID provided is not valid."
          />
        </div>
      );
    }

    return (
      <div>
        <Suspense fallback={<SessionsViewLoading />}>
          <SessionIdView sessionId={sessionId} />
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
          description="An unexpected error occurred while loading the session page."
        />
      </div>
    );
  }
}
