import { loadSettingsCatalog } from "@/lib/settings";
import { isBillingConfigured } from "@/lib/stripe";
import { SettingsView } from "@/modules/settings/ui/views/settings-view";

// Auth and onboarding gates live on the (app) layout.
export const dynamic = "force-dynamic";

export default async function Page() {
  // The accent and first-language lists come from the backend that resolves
  // them, so the picker can never offer something the scorer does not know.
  const catalog = await loadSettingsCatalog();

  return (
    <SettingsView catalog={catalog} billingConfigured={isBillingConfigured()} />
  );
}
