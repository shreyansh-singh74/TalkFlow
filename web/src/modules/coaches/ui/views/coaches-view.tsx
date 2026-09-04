"use client";
import { LoadingState } from "@/components/loading-state";
import { useCoaches } from "@/hooks/use-api";
import { columns } from "../components/columns";
import { EmptyState } from "@/components/empty-state";
import { useCoachesFilter } from "../../hooks/use-coaches-filter";
import { DataPagination } from "@/components/data-pagination";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table";

export const CoachesView = () => {
  const router = useRouter();
  const [filters, setFilters] = useCoachesFilter();

  const { data, isLoading, isError } = useCoaches(filters);

  if (isLoading) {
    return <CoachesViewLoading />;
  }

  if (isError) {
    return (
      <EmptyState
        title="Something went wrong"
        description="We couldn't fetch the coaches. Please try again later."
      />
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="Create Your First Coach"
        description="Create an coach to join your sessions. Each coach will follow your instructions and can interact with participants during the call."
      />
    );
  }

  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable
        data={data.items}
        columns={columns}
        onRowClick={(row) => router.push(`/dashboard/coaches/${row?.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
};

export const CoachesViewLoading = () => {
  return (
    <LoadingState
      title="Loading Coaches"
      description="This may take few seconds"
    />
  );
};
  
