import { DEFAULT_PAGE } from "@/constants";
import {
    parseAsBoolean,
    parseAsInteger,
    parseAsString,
    parseAsStringEnum,
    useQueryStates,
} from "nuqs";
import { SessionStatus } from "../types";

export const useSessionsFilter = () => {
    return useQueryStates({
        search: parseAsString.withDefault("").withOptions({clearOnDefault:true}),
        page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({clearOnDefault:true}),
        status: parseAsStringEnum(Object.values(SessionStatus)),
        coachId: parseAsString.withDefault("").withOptions({clearOnDefault:true}),
        // `?create=1` (optionally with `coachId`) opens the create dialog on
        // arrival. The dashboard's "New session" and coach "Start" buttons link
        // here; they used to just land the learner on this list.
        create: parseAsBoolean.withDefault(false).withOptions({clearOnDefault:true}),
    })
};
