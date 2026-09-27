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
 * move between them, and so there is a single place for the two gates that
 * belong on all of them:
 *
 *  1. An anonymous visitor is sent to sign-in. (The pages used to each run
 *     this check with slightly different failure handling; one gate means one
 *     behaviour.)
 *  2. An account that has never answered the first-run questions is sent to
 *     them once.
 *
 * The reads are wrapped because a database blip must not lock a learner out of
 * practice — failing open on the onboarding check costs one unanswered
 * question, and failing closed costs the whole product. The session read is
 * not wrapped: when Better Auth itself is down, redirecting to sign-in (which
 * will also fail) is more honest than rendering a shell that every page under
 * it will immediately fail to fill.
 */
export default async function Layout({ children }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  let needsOnboarding = false;
  try {
    const settings = await getUserSettings(session.user.id);
    needsOnboarding = !settings.onboardedAt;
  } catch (error) {
    console.error("Onboarding check failed:", error);
  }

  if (needsOnboarding) {
    redirect("/welcome");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
