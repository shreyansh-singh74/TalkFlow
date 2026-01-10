import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { PricingView } from "@/modules/pricing/ui/views/pricing-view";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });


  if(!session){
    redirect("/sign-in");
  }

  return <PricingView />;
}

