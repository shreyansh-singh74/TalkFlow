import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ProgressView } from "@/modules/progress/ui/views/progress-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  let session = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    console.error("Failed to get session on progress page:", error);
  }

  if (!session) {
    redirect("/sign-in");
  }

  return <ProgressView />;
}
