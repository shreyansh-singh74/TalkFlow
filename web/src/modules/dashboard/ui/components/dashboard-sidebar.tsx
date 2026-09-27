"use client";

import { BotIcon, SettingsIcon, TrendingUpIcon, VideoIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import DashboardUserButton from "./dashboard-user-button";

const firstSection = [
  {
    icon: VideoIcon,
    label: "Practice Sessions",
    href: "/sessions",
  },
  {
    icon: BotIcon,
    label: "Coaches",
    href: "/coaches",
  },
  {
    icon: TrendingUpIcon,
    label: "Progress",
    href: "/progress",
  },
  {
    icon: SettingsIcon,
    label: "Settings",
    href: "/settings",
  },
];

export const DashboardSidebar = () => {
  const pathname = usePathname();

  return (
    <Sidebar style={{ borderRightWidth: "0px" }}>
      <SidebarHeader>
        <Link
          href="/home"
          className="flex items-center justify-center gap-2.5 px-4 py-5"
        >
          <Image
            src="/Talkflow_logo.svg"
            height={40}
            width={40}
            alt="TalkFlow"
            className="shrink-0 object-contain"
          />
          {/* The wordmark uses the app's sans, not the landing page's serif
              accent — the italic Playfair read as "cursive" next to the mark. */}
          <span className="text-[22px] font-semibold leading-none tracking-tight text-sidebar-foreground">
            TalkFlow
          </span>
        </Link>
      </SidebarHeader>
      <div className="px-4 py-2">
        <Separator className="opacity-10" />
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {firstSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 hover:bg-sidebar-accent/40",
                      pathname.startsWith(item.href) &&
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                    isActive={pathname.startsWith(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-5 w-5" />
                      <span className="text-sm font-medium tracking-tight">
                        {item.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};
