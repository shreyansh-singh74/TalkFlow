import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/coaches/params";
import { CoachListHeader } from "@/modules/coaches/ui/components/coach-list-header";
import {
  CoachesView,
  CoachesViewLoading,
} from "@/modules/coaches/ui/views/coaches-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

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
      <CoachListHeader />
      <Suspense fallback={<CoachesViewLoading />}>
        <CoachesView />
      </Suspense>
    </>
  );
};

export default Page;
