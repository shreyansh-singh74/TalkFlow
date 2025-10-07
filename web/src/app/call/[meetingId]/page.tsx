import { auth } from "@/lib/auth";
import { CallView } from "@/modules/call/ui/views/call-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{
    meetingId: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect("/sign-in");
  }

  const { meetingId } = await params;

  return <CallView meetingId={meetingId} />;
};

export default Page;