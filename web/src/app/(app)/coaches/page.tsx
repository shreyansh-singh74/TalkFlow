import { loadSearchParams } from "@/modules/coaches/params";
import { CoachListHeader } from "@/modules/coaches/ui/components/coach-list-header";
import {
  CoachesView,
  CoachesViewLoading,
} from "@/modules/coaches/ui/views/coaches-view";
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
      <CoachListHeader />
      <Suspense fallback={<CoachesViewLoading />}>
        <CoachesView />
      </Suspense>
    </>
  );
};

export default Page;
