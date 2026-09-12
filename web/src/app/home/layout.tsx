import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";
import { DashboardShell } from "@/modules/dashboard/ui/components/dashboard-shell";

interface Props {
  children: React.ReactNode;
}

/**
 * The dashboard shell, plus the one gate that belongs on every page in it:
 * an account that has never answered the first-run questions is sent to them
 * once.
 *
 * The read is wrapped because a database blip must not lock a learner out of
 * practice — failing open here costs one unanswered question, and failing closed
 * costs the whole product.
 */
export default async function Layout({ children }: Props) {
  let needsOnboarding = false;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      const settings = await getUserSettings(session.user.id);
      needsOnboarding = !settings.onboardedAt;
    }
  } catch (error) {
    console.error("Onboarding check failed:", error);
  }

  if (needsOnboarding) {
    redirect("/welcome");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
