"use client";
import { Button } from "@/components/ui/button";
import { PlusIcon, XCircleIcon } from "lucide-react";
import { NewSessionDialog } from "./new-session-dialog";
import { useEffect, useState } from "react";
import { SessionsSearchFilter } from "./sessions-search-filter";
import { StatusFilter } from "./status-filter";
import { CoachIdFilter } from "./coach-id-filter";
import { useSessionsFilter } from "../../hooks/use-sessions-filter";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const SessionsListHeader = () => {
  const [filters, setFilters] = useSessionsFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // `?create=1&coachId=...` is how the dashboard's "New session" and every
  // coach's "Start" button reach this screen. Opening on arrival means those
  // buttons do what they say instead of dropping the learner on a list.
  useEffect(() => {
    if (filters.create) setIsDialogOpen(true);
  }, [filters.create]);

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open && filters.create) {
      // Clear the deep link so a refresh or Back doesn't reopen the dialog.
      setFilters({ create: null });
    }
  };

  const isAnyFilterModified =
    !!filters.status || !!filters.search || !!filters.coachId;

  const onClearFilters = () => {
    setFilters({
      status: null,
      coachId: "",
      search: "",
      page: 1,
    });
  };

  return (
    <>
      <NewSessionDialog
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        initialCoachId={filters.coachId || null}
      />
      <div className="py-4 px-4 md:px-8 flex flex-col gap-y-4">
        <div className="flex items-center justify-between ">
          <h5 className="font-medium text-xl">Practice Sessions</h5>
          <Button onClick={() => handleDialogOpenChange(true)}>
            <PlusIcon />
            New Session
          </Button>
        </div>
        <ScrollArea>
          <div className="flex items-center gap-x-2 p-1">
            <SessionsSearchFilter />
            <StatusFilter />
            <CoachIdFilter />
            {isAnyFilterModified && (
              <Button variant="outline" onClick={onClearFilters}>
                <XCircleIcon className="size-4" />
                Clear
              </Button>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </>
  );
};
