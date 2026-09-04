import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PracticeScript, ScriptRequest } from "@/types/practice";

// Generic API call function
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "API call failed");
  }

  return response.json();
}

// Coaches API hooks
export function useCoaches(params: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
  if (params.search) searchParams.set("search", params.search);

  return useQuery({
    queryKey: ["coaches", params],
    queryFn: () =>
      apiCall<{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: any[];
        total: number;
        totalPages: number;
      }>(`/api/coaches?${searchParams.toString()}`),
  });
}

export function useCoach(id: string) {
  return useQuery({
    queryKey: ["coach", id],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiCall<any>(`/api/coaches/${id}`),
    enabled: !!id,
  });
}

export function useCreateCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiCall<any>("/api/coaches", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
  });
}

export function useUpdateCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiCall<any>(`/api/coaches/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
      queryClient.invalidateQueries({ queryKey: ["coach", variables.id] });
    },
  });
}

export function useDeleteCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiCall<any>(`/api/coaches/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
  });
}

// Sessions API hooks
export function usePracticeSessions(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  coachId?: string;
  status?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
  if (params.search) searchParams.set("search", params.search);
  if (params.coachId) searchParams.set("coachId", params.coachId);
  if (params.status) searchParams.set("status", params.status);

  return useQuery({
    queryKey: ["sessions", params],
    queryFn: () =>
      apiCall<{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: any[];
        total: number;
        totalPages: number;
      }>(`/api/sessions?${searchParams.toString()}`),
  });
}

export function usePracticeSession(id: string) {
  return useQuery({
    queryKey: ["session", id],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => apiCall<any>(`/api/sessions/${id}`),
    enabled: !!id,
  });
}

export function useCreatePracticeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: (data: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiCall<any>("/api/sessions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useUpdatePracticeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      id: string;
      name?: string;
      coachId?: string | null;
      script?: PracticeScript;
      difficulty?: string;
      sourceText?: string | null;
      phonemeData?: unknown;
      status?: string;
      startedAt?: string;
      endedAt?: string;
    }) => {
      const { id, ...data } = variables;
      return apiCall<unknown>(`/api/sessions/${id}`, {
        method: "PUT",
        body: JSON.stringify({ id, ...data }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session", variables.id] });
    },
  });
}

export function useDeletePracticeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      apiCall<any>(`/api/sessions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

/**
 * Build a practice script for preview, before the session exists.
 *
 * The result is handed back to POST /api/sessions on submit so the steps the
 * user reviewed (and possibly edited) are exactly the ones that get saved.
 */
export function useGenerateScript() {
  return useMutation({
    mutationFn: (data: ScriptRequest) =>
      apiCall<PracticeScript>("/api/practice/script", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}
