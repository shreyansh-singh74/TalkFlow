import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AnalysisSessionView } from "@/modules/analysis/ui/views/analysis-session-view";
import { LoadingState } from "@/components/loading-state";

interface PageProps {
  params: Promise<{
    meetingId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const { meetingId } = await params;

  return (
    <Suspense fallback={<LoadingState title="Loading Session Analysis" description="Retrieving your pronunciation report..." />}>
      <AnalysisSessionView meetingId={meetingId} />
    </Suspense>
  );
}
