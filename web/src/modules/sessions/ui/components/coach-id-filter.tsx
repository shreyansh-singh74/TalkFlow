import { useCoaches } from "@/hooks/use-api";
import { useSessionsFilter } from "../../hooks/use-sessions-filter";
import { useState } from "react";
import { CommandSelect } from "@/components/command-select";
import { NameAvatar } from "@/components/name-avatar";

export const CoachIdFilter = () => {
    const [filters,setFilters] = useSessionsFilter();
    const [coachSearch, setCoachSearch] = useState("");
    const {data} = useCoaches({
        pageSize: 100,
        search: coachSearch,
    });

    return(
        <CommandSelect 
            className="h-9 flex items-center"
            placeholder="Coach"
            options={(data?.items ?? []).map((coach) => ({
                id: coach.id,
                value: coach.id,
                children: (
                    <div className="flex items-center gap-x-2">
                        <NameAvatar 
                            name={coach.name}
                            size={25}
                        />
                        {coach.name}
                    </div>
                )
            }))}
            onSelect={(value)=>setFilters({coachId: value})}
            onSearch={setCoachSearch}
            value={filters.coachId ?? ""}
        />
    )
};
