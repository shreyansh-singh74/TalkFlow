import { Input } from "@/components/ui/input";
import { useCoachesFilter } from "../../hooks/use-coaches-filter";
import { SearchIcon } from "lucide-react";

export const CoachesSearchFilter = () => {
  const [filters, setFilters] = useCoachesFilter();

  return (
    <div className="relative">
      <Input
        placeholder="Filter by name"
        className="h-9 bg-white w-[200px] pl-7"
        value={filters.search}
        onChange={(e) => setFilters({ search: e.target.value })}
      />
      <SearchIcon 
        className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
};
    