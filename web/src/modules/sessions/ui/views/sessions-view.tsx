"use client";

import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Explicit, not `...filters`: the filter state also carries UI-only params
  // (`create`), and a query-string builder that forwards unknown keys is how a
  // UI flag ends up in an API request.
  const { data, isLoading, error } = usePracticeSessions({
    page: filters.page,
    search: filters.search,
    coachId: filters.coachId,
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
  if (data.items.length === 0) {
    // Two different empties: no sessions at all is an invitation to create
    // one, but an empty result *with* filters active is the filters doing
    // their job — telling them to create a session would be confusing.
    const hasFilters = Boolean(filters.status || filters.search || filters.coachId);
    return hasFilters ? (
      <div className="flex-1 flex flex-col">
        <EmptyState
          title="No Sessions Match These Filters"
          description="Try a different search, status or coach — or clear the filters to see everything."
        />
        <div className="flex justify-center pb-4">
          <button
            onClick={() => setFilters({ status: null, coachId: "", search: "", page: 1 })}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        </div>
      </div>
    ) : (
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
        onRowClick={(row)=>router.push(`/sessions/${row.id}`)}
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
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24 hidden sm:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-b last:border-0 px-4 py-4 flex items-center gap-4"
          >
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
};
