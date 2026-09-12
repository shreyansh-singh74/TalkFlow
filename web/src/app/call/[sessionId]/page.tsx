import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/settings";
import { CallView } from "@/modules/call/ui/views/call-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface Props {
  params: Promise<{
    sessionId: string;
  }>;
}

const Page = async ({ params }: Props) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    redirect("/sign-in");
  }

  const { sessionId } = await params;

  // Resolved here rather than in the browser so the WebSocket's first
  // SESSION_CONFIG frame already carries the right accent, L1 hint and consent
  // flag -- a client-side fetch would leave the opening turn configured wrong.
  const settings = await getUserSettings(session.user.id);

  return (
    <CallView
      sessionId={sessionId}
      settings={{
        accent: settings.targetAccent,
        l1: settings.nativeLanguage,
        retainAudio: settings.retainAudio,
        // Empty/absent means "normal speed".
        listeningRate: settings.ttsRate || 1,
      }}
    />
  );
};

export default Page;
