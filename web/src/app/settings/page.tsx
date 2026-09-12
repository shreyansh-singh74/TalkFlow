import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { loadSettingsCatalog } from "@/lib/settings";
import { isBillingConfigured } from "@/lib/stripe";
import { SettingsView } from "@/modules/settings/ui/views/settings-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  // The accent and first-language lists come from the backend that resolves
  // them, so the picker can never offer something the scorer does not know.
  const catalog = await loadSettingsCatalog();

  return (
    <SettingsView catalog={catalog} billingConfigured={isBillingConfigured()} />
  );
}
