import { auth } from "@/lib/auth";
import { loadSearchParams } from "@/modules/agents/params";
import { AgentListHeader } from "@/modules/agents/ui/components/agent-list-header";
import {
  AgentsView,
  AgentsViewLoading,
} from "@/modules/agents/ui/views/agents-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";
import { Suspense } from "react";

interface Props {
  searchParams: Promise<SearchParams>;
}

const Page = async ({ searchParams }: Props) => {
  try {
    const filters = await loadSearchParams(searchParams);
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
      <AgentListHeader />
      <Suspense fallback={<AgentsViewLoading />}>
        <AgentsView />
      </Suspense>
    </>
  );
};

export default Page;
