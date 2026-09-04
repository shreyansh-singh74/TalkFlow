import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/sessions/params";
import { SessionsListHeader } from "@/modules/sessions/ui/components/sessions-list-header";
import {
  SessionsView,
  SessionsViewLoading,
} from "@/modules/sessions/ui/views/sessions-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";
import { Suspense } from "react";


interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({ searchParams }: Props) => {
  await loadSearchParams(searchParams);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <SessionsListHeader />
      <Suspense fallback={<SessionsViewLoading />}>
        <SessionsView />
      </Suspense>
    </>
  );
};

export default Page;
