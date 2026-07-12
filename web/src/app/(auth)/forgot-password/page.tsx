import { auth } from "@/lib/auth";
import { ForgotPasswordView } from "@/modules/auth/ui/views/forgot-password-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  let session = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    console.error("Failed to get session on forgot-password page:", error);
  }

  if (!!session) {
    redirect("/");
  }

  return <ForgotPasswordView />;
}
