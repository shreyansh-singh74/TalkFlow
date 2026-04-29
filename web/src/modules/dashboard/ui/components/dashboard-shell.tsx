import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "./dashboard-navbar";
import { DashboardSidebar } from "./dashboard-sidebar";
import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

export const DashboardShell = ({ children }: DashboardShellProps) => {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <main className="flex min-h-screen w-full flex-1 flex-col bg-muted">
        <DashboardNavbar />
        {children}
      </main>
    </SidebarProvider>
  );
};
