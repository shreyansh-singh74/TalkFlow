import { DashboardShell } from "@/modules/dashboard/ui/components/dashboard-shell";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  return <DashboardShell>{children}</DashboardShell>;
}
