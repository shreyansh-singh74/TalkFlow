import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders for the dashboard.
 *
 * There is one per card, each drawn to the real card's shape -- same padding,
 * same row rhythm, same number of columns in the stat grid -- so the page
 * settles rather than snaps when the data lands. Cards render their own
 * skeleton, and `DashboardSkeleton` composes them for the route-level
 * `loading.tsx`, which cannot run hooks and so cannot ask whether the query is
 * still pending.
 */

export function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-9 w-32 rounded-md" />
    </div>
  );
}

export function ContinuePracticeSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <Skeleton className="h-3 w-32 mb-3" />
      <Skeleton className="h-5 w-44 mb-2" />
      <Skeleton className="h-4 w-56 mb-6" />
      <Skeleton className="h-8 w-40 rounded-md" />
    </div>
  );
}

export function RecentSessionsSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 -mx-1">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProgressStatsSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-muted/50 p-3.5">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonalBestSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4 flex items-start gap-3">
      <Skeleton className="h-8 w-8 rounded-lg shrink-0 mt-0.5" />
      <div className="flex-1">
        <Skeleton className="h-4 w-36 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

export function FocusAreasSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="flex items-center gap-2 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-9 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-3 w-4/5 mb-4" />
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  );
}

export function CoachesSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <Skeleton className="h-4 w-40 mb-4" />
      <div className="space-y-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 -mx-1">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The full frame, for `loading.tsx`: same header and two-column grid as the
 * real page, so the streamed fallback and the client skeleton are the same
 * picture.
 */
export function DashboardSkeleton() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <DashboardHeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 md:gap-5">
        <div className="flex flex-col gap-4 md:gap-5">
          <ContinuePracticeSkeleton />
          <RecentSessionsSkeleton />
        </div>
        <div className="flex flex-col gap-4 md:gap-5">
          <ProgressStatsSkeleton />
          <PersonalBestSkeleton />
          <FocusAreasSkeleton />
          <CoachesSkeleton />
        </div>
      </div>
    </div>
  );
}
