"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SessionGetMany } from "../../types";
import { NameAvatar } from "@/components/name-avatar";
import {
  CircleCheckIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  ClockFadingIcon,
  CornerDownRightIcon,
  LoaderIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import humanizeDuration from "humanize-duration";
import { cn } from "@/lib/utils";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.

function formatDuration(seconds: number) {
  return humanizeDuration(seconds * 1000, {
    largest: 1,
    round: true,
    units: ["h", "m", "s"],
  });
}

const statusIconMap = {
  upcoming: ClockArrowUpIcon,
  active: LoaderIcon,
  completed: CircleCheckIcon,
  processing: LoaderIcon,
  cancelled: CircleXIcon,
};

const statusColorMap = {
  upcoming: "bg-warning/15 text-warning border-warning/10",
  active: "bg-info/15 text-info border-info/10",
  completed: "bg-primary/20 text-primary border-success/10",
  cancelled: "bg-danger/15 text-danger border-danger/10",
  processing: "bg-muted text-foreground border-border",
};

export const columns: ColumnDef<SessionGetMany[number]>[] = [
  {
    accessorKey: "name",
    header: "Session Name",
    cell: ({ row }) => {
      // Custom (pasted-text) sessions have no coach behind them, so they
      // identify themselves by their script instead.
      const stepCount = row.original.script?.steps.length ?? 0;
      const subtitle =
        row.original.coach?.name ??
        (stepCount > 0 ? `Your text · ${stepCount} steps` : "Your text");

      return (
        <div className="flex flex-col gap-y-2">
          <span className="font-semibold capitalize">{row.original?.name}</span>
          <div className="flex items-center gap-x-2">
            <div className="flex items-center gap-x-1">
              <CornerDownRightIcon className="size-3 text-muted-foreground" />
              <span className="text-sm text-muted-foreground max-w-[200px] truncate">
                {subtitle}
              </span>
            </div>
            {row.original.coach && (
              <NameAvatar name={row.original.coach.name} size={25} />
            )}
            <span className="text-sm text-muted-foreground">
              {row.original.startedAt
                ? format(row.original.startedAt, "MMM d")
                : ""}
            </span>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const Icon =
        statusIconMap[row.original.status as keyof typeof statusIconMap];

      return (
        <Badge
          variant="outline"
          className={cn(
            "capitalize [&>svg]:size-4 text-muted-foreground",
            statusColorMap[row.original.status as keyof typeof statusColorMap]
          )}
        >
          <Icon
            className={cn(
              row.original.status === "processing" && "animate-spin"
            )}
          />
          {row.original.status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="capitalize [&>svg]:size-4 flex items-center gap-x-2"
      >
        <ClockFadingIcon className="text-info" />
        {row.original.duration ? formatDuration(row.original.duration) : "No duration"}
      </Badge>
    )
  },
];
