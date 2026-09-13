import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";
import { DashboardShell } from "@/modules/dashboard/ui/components/dashboard-shell";

interface Props {
  children: React.ReactNode;
}

/**
 * The shell for every signed-in screen — home, sessions, coaches, progress,
 * settings. They share one layout so the sidebar never disappears when you
 * move between them, and so there is a single place for the gate that belongs
 * on all of them: an account that has never answered the first-run questions
 * is sent to them once.
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
