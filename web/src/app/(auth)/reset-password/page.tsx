import { auth } from "@/lib/auth";
import { ResetPasswordView } from "@/modules/auth/ui/views/reset-password-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!!session) {
    redirect("/");
  }

  return <ResetPasswordView />;
}
