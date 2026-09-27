import { loadSearchParams } from "@/modules/sessions/params";
import { SessionsListHeader } from "@/modules/sessions/ui/components/sessions-list-header";
import {
  SessionsView,
  SessionsViewLoading,
} from "@/modules/sessions/ui/views/sessions-view";
import { SearchParams } from "nuqs";
import { Suspense } from "react";

// Auth and onboarding gates live on the (app) layout.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({ searchParams }: Props) => {
  await loadSearchParams(searchParams);

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
