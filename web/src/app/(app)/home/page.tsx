import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { DashboardView } from "@/modules/home/ui/views/dashboard-view"
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page(){
  let session = null;
  try {
    session = await auth.api.getSession({
      headers : await headers(),
    });
  } catch (error) {
    console.error("Failed to get session on dashboard page:", error);
  }

  if(!session){
    redirect("/sign-in");
  }
  return <DashboardView />
}

