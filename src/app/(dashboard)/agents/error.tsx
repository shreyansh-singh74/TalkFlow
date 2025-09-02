"use client";

import { ErrorState } from "@/components/error-state";

const ErrorPage = () => {
    return (
        <ErrorState 
            title="Error loading Agents"
            description="Something went wrong"
        />
    );
};
