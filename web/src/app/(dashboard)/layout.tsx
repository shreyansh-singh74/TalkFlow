import { DashboardShell } from "@/modules/dashboard/ui/components/dashboard-shell";

interface Props{
    children: React.ReactNode;
}

export default function Layout({children}:Props) {
    return <DashboardShell>{children}</DashboardShell>;
}
