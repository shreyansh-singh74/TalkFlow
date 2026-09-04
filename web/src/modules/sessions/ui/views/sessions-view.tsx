"use client";

import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { usePracticeSessions } from "@/hooks/use-api";
import { DataTable } from "@/components/data-table";
import { columns } from "../components/columns";
import { EmptyState } from "@/components/empty-state";
import { useRouter } from "next/navigation";
import { useSessionsFilter } from "../../hooks/use-sessions-filter";
import { DataPagination } from "@/components/data-pagination";

export const SessionsView = () => {
  const router = useRouter();
  const [filters, setFilters] = useSessionsFilter();

  const { data, isLoading, error } = usePracticeSessions({
    ...filters,
    status: filters.status ?? undefined,
  });

  if (isLoading) {
    return <SessionsViewLoading />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Sessions"
        description={
          error.message ||
          "Something went wrong while loading your sessions. Please try again."
        }
      />
    );
  }

  if (!data) {
    return <SessionsViewLoading />;
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="Create Your First Practice Session"
        description="Create a session to start practicing with your speaking coach."
      />
    );
  }
  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable 
        data={data.items} 
        columns={columns} 
        onRowClick={(row)=>router.push(`/dashboard/sessions/${row.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
};

export const SessionsViewLoading = () => {
  return (
    <LoadingState
      title="Loading Sessions"
      description="This may take few seconds"
    />
  );
};
