"use client";
import { Skeleton } from "@/components/ui/skeleton";
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
        onRowClick={(row) => router.push(`/coaches/${row?.id}`)}
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
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3 flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20 hidden sm:block" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-b last:border-0 px-4 py-4 flex items-center gap-4"
          >
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
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
  
