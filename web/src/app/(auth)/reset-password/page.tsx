import { auth } from "@/lib/auth";
import { ResetPasswordView } from "@/modules/auth/ui/views/reset-password-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function Page() {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.error("Failed to get session on reset-password page:", error);
  }

  if (!!session) {
    redirect("/");
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">Loading...</div>
      </div>
    }>
      <ResetPasswordView />
    </Suspense>
  );
}
