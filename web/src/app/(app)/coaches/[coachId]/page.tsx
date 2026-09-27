import { auth } from "@/lib/auth";
import { CoachIdView } from "@/modules/coaches/ui/views/coach-id-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ coachId: string }>;
}

export default async function Page({ params }: Props) {
  // Same gate as every other (app) page. Without it an anonymous visitor got
  // the client view, a 401 from the API, and a "Coach Not Found" error that
  // said nothing about needing to sign in.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const { coachId } = await params;

  return <CoachIdView coachId={coachId} />;
}
