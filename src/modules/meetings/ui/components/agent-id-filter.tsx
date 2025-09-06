import { useTRPC } from "@/trpc/client";
import { useMeetingsFilter } from "../../hooks/use-meetings-filter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommandSelect } from "@/components/command-select";
import { NameAvatar } from "@/components/name-avatar";

export const AgentIdFilter = () => {
    const [filters,setFilters] = useMeetingsFilter();
    const trpc = useTRPC();
    const [agentSearch, setAgentSearch] = useState("");
    const {data} = useQuery(
        trpc.agents.getMany.queryOptions({
            pageSize: 100,
            search: agentSearch,
        })
    );

    return(
        <CommandSelect 
            className="h-9 flex items-center"
            placeholder="Agent"
            options={(data?.items ?? []).map((agent) => ({
                id: agent.id,
                value: agent.id,
                children: (
                    <div className="flex items-center gap-x-2">
                        <NameAvatar 
                            name={agent.name}
                            size={25}
                        />
                        {agent.name}
                    </div>
                )
            }))}
            onSelect={(value)=>setFilters({agentId: value})}
            onSearch={setAgentSearch}
            value={filters.agentId ?? ""}
        />
    )
};
