import { ProgressView } from "@/modules/progress/ui/views/progress-view";

// Auth and onboarding gates live on the (app) layout.
export const dynamic = "force-dynamic";

export default function Page() {
  return <ProgressView />;
}
