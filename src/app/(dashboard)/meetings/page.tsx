import { auth } from "@/lib/auth";
import { MeetingsListHeader } from "@/modules/meetings/ui/components/meetings-list-header";
import {
  MeetingsView,
  MeetingsViewLoading,
} from "@/modules/meetings/ui/views/meetings-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const Page = async () => {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      redirect("/sign-in");
    }
  } catch (error) {
    console.error("Auth error:", error);
    redirect("/sign-in");
  }

  return (
    <>
      <MeetingsListHeader />
      <Suspense fallback={<MeetingsViewLoading />}>
        <MeetingsView />
      </Suspense>
    </>
  );
};

export default Page;
