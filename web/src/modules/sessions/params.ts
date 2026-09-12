import {
  createLoader,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { DEFAULT_PAGE } from "@/constants";
import { SessionStatus } from "./types";

export const filterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum(Object.values(SessionStatus)),
  coachId: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  // Opens the create dialog on arrival, optionally with a coach pre-selected.
  create: parseAsBoolean.withDefault(false).withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
