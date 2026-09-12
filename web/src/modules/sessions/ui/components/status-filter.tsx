import {
  CircleCheckIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  VideoIcon,
} from "lucide-react";
import { SessionStatus } from "../../types";
import { useSessionsFilter } from "../../hooks/use-sessions-filter";
import { CommandSelect } from "@/components/command-select";

const options = [
  {
    id: SessionStatus.Upcoming,
    value: SessionStatus.Upcoming,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <ClockArrowUpIcon />
        {SessionStatus.Upcoming}
      </div>
    ),
  },
  {
    id: SessionStatus.Completed,
    value: SessionStatus.Completed,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <CircleCheckIcon />
        {SessionStatus.Completed}
      </div>
    ),
  },
  {
    id: SessionStatus.Active,
    value: SessionStatus.Active,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <VideoIcon />
        {SessionStatus.Active}
      </div>
    ),
  },
  // No "processing" option. Nothing ever wrote that status: the report is
  // generated inline when the session ends, so there is no queue to wait on.
  // Offering the filter implied a background job that does not exist.
  {
    id: SessionStatus.Cancelled,
    value: SessionStatus.Cancelled,
    children: (
      <div className="flex items-center justify-center gap-x-2 capitalize">
        <CircleXIcon />
        {SessionStatus.Cancelled}
      </div>
    ),
  },
];

export const StatusFilter = () => {
  const [filters, setFilters] = useSessionsFilter();

  return (
    <CommandSelect
      placeholder="Status"
      className="h-9 flex items-center"
      options={options}
      onSelect={(value) => {
        setFilters({ status: value as SessionStatus });
      }}
      value={filters.status || ""}
    />
  );
};
