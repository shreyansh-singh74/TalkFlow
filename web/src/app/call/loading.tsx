import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while /call/[sessionId]'s server render resolves (the page awaits the
 * session and the learner's settings). Mirrors the shape of CallView's own
 * loading skeleton so the two states blend together.
 */
export default function CallLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <div className="flex h-14 shrink-0 items-center justify-end border-b border-border bg-card px-4 sm:px-6">
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-md flex-col items-center gap-8">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="space-y-3 w-full flex flex-col items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
