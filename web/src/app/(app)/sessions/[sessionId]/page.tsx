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
  // The auth check stays outside the try below on purpose: redirect() works
  // by throwing NEXT_REDIRECT, and a catch-all here used to swallow it and
  // render "Something went wrong" to the very visitor it was sending to
  // sign-in.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;
  if (!sessionId || typeof sessionId !== "string") {
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
    <Suspense fallback={<SessionsViewLoading />}>
      <SessionIdView sessionId={sessionId} />
    </Suspense>
  );
}
