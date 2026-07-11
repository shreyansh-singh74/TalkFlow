import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AnalysisDashboardView } from "@/modules/analysis/ui/views/analysis-dashboard-view";
import { LoadingState } from "@/components/loading-state";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <Suspense fallback={<LoadingState title="Loading Analysis Dashboard" description="Analyzing your pronunciation trends..." />}>
      <AnalysisDashboardView />
    </Suspense>
  );
}
