"use client";

import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { useMeetings } from "@/hooks/use-api";
import { DataTable } from "@/components/data-table";
import { columns } from "../components/columns";
import { EmptyState } from "@/components/empty-state";
import { useRouter } from "next/navigation";
import { useMeetingsFilter } from "../../hooks/use-meetings-filter";
import { DataPagination } from "@/components/data-pagination";

export const MeetingsView = () => {
  const router = useRouter();
  const [filters, setFilters] = useMeetingsFilter();

  const { data, isLoading, error } = useMeetings(filters);

  if (isLoading) {
    return <MeetingsViewLoading />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Meetings"
        description={
          error.message ||
          "Something went wrong while loading your meetings. Please try again."
        }
      />
    );
  }

  if (!data) {
    return <MeetingsViewLoading />;
  }
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        title="Create Your First Meeting"
        description="Create a meeting to start collaborating with your agents."
      />
    );
  }
  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable 
        data={data.items} 
        columns={columns} 
        onRowClick={(row)=>router.push(`/meetings/${row.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
    </div>
  );
};

export const MeetingsViewLoading = () => {
  return (
    <LoadingState
      title="Loading Meetings"
      description="This may take few seconds"
    />
  );
};
