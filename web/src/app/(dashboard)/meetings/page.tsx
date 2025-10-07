import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/meetings/params";
import { MeetingsListHeader } from "@/modules/meetings/ui/components/meetings-list-header";
import {
  MeetingsView,
  MeetingsViewLoading,
} from "@/modules/meetings/ui/views/meetings-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";
import { Suspense } from "react";


interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
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
