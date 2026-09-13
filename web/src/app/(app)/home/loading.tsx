import { DashboardSkeleton } from "@/modules/home/ui/components/dashboard-skeleton";

/**
 * Shown while `/home`'s server render resolves. The page is `force-dynamic`
 * and the layout awaits a session read, so without this the browser keeps the
 * previous screen (or a white frame) until both finish. The shape matches the
 * client skeleton in `DashboardView`, so the two states are indistinguishable.
 */
export default function Loading() {
  return <DashboardSkeleton />;
}
