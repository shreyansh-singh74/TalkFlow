import { DEFAULT_PAGE } from "@/constants";
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { SessionStatus } from "../types";

export const useSessionsFilter = () => {
    return useQueryStates({
        search: parseAsString.withDefault("").withOptions({clearOnDefault:true}),
        page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({clearOnDefault:true}),
        status: parseAsStringEnum(Object.values(SessionStatus)),
        coachId: parseAsString.withDefault("").withOptions({clearOnDefault:true}),
    })
};
