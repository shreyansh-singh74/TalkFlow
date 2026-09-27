import { DashboardView } from "@/modules/home/ui/views/dashboard-view";

export const dynamic = "force-dynamic";

// Auth and onboarding gates live on the (app) layout; this page only renders
// the dashboard once they have passed.
export default function Page() {
  return <DashboardView />;
}
