"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  SettingsPatch,
  SettingsResponse,
  UserSettings,
} from "@/types/settings";

/**
 * Read and write the learner's settings.
 *
 * `useUserSettings` is used by the voice surface as well as the settings page:
 * the accent and TTS rate it returns are what the session is configured with and
 * what the reference clip is synthesised at, so a learner changing the accent
 * hears the new one on the next word without a reload.
 */
export function useUserSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<SettingsResponse> => {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Could not load your settings");
      return response.json();
    },
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: SettingsPatch): Promise<UserSettings> => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not save your settings");
      }
      const data = await response.json();
      return data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

/** Delete every retained raw-audio clip belonging to this learner. */
export function useDeleteStoredAudio() {
  return useMutation({
    mutationFn: async (): Promise<{ deleted: number; sessions: number }> => {
      const response = await fetch("/api/settings/audio", { method: "DELETE" });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Could not delete stored audio");
      }
      return response.json();
    },
  });
}

/** Hand off to Stripe. The route returns a URL; the browser does the rest. */
export function useBillingRedirect() {
  return useMutation({
    mutationFn: async (kind: "checkout" | "portal"): Promise<void> => {
      const response = await fetch(`/api/stripe/${kind}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Billing is unavailable right now");
      }
      window.location.href = data.url;
    },
  });
}
