import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getUserSettings, loadSettingsCatalog } from "@/lib/settings";
import { OnboardingView } from "@/modules/settings/ui/views/onboarding-view";

export const dynamic = "force-dynamic";

/**
 * First-run setup, outside the app shell on purpose: the home layout sends
 * not-yet-onboarded accounts here, and a gate that lives inside the thing it
 * guards has to special-case its own path.
 */
export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const [catalog, settings] = await Promise.all([
    loadSettingsCatalog(),
    getUserSettings(session.user.id),
  ]);

  return (
    <OnboardingView
      catalog={catalog}
      defaults={{
        displayName: settings.displayName,
        nativeLanguage: settings.nativeLanguage,
        targetAccent: settings.targetAccent,
        level: settings.level,
      }}
    />
  );
}
