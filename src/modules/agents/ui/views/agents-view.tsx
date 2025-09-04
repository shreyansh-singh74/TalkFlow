"use client";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "../components/data-table";
import { columns } from "../components/columns";
import { EmptyState } from "@/components/empty-state";
import { useAgentsFilter } from "../../hooks/use-agents-filter";
import { DataPagination } from "../components/data-pagination";
import { useRouter } from "next/navigation";

export const AgentsView = () => {
  const router = useRouter();
  const [filters, setFilters] = useAgentsFilter();

  const trpc = useTRPC();
  const { data, isLoading, isError } = useQuery(
    trpc.agents.getMany.queryOptions({
      ...filters,
    })
  );

  if (isLoading) {
    return <AgentsViewLoading />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Something went wrong"
        description="We couldn't fetch the agents. Please try again later."
      />
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="Create Your First Agent"
        description="Create an agent to join your meetings. Each agent will follow your instructions and can interact with participants during the call."
      />
    );
  }

  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable
        data={data.items}
        columns={columns}
        onRowClick={(row) => router.push(`/agents/${row?.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
};

export const AgentsViewLoading = () => {
  return (
    <LoadingState
      title="Loading Agents"
      description="This may take few seconds"
    />
  );
};
  