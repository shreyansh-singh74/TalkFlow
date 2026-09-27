"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CommandSelect } from "@/components/command-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBillingRedirect,
  useDeleteStoredAudio,
  useUpdateSettings,
  useUserSettings,
} from "@/hooks/use-settings";
import { cn } from "@/lib/utils";
import type {
  AccentOption,
  L1Option,
  SettingsCatalog,
  SettingsPatch,
} from "@/types/settings";
import { useEffect, useMemo, useState } from "react";

interface Props {
  catalog: SettingsCatalog;
  billingConfigured: boolean;
}

const LEVELS = [
  { value: "beginner", label: "Just starting out" },
  { value: "intermediate", label: "Comfortable, want polish" },
  { value: "advanced", label: "Advanced — refining details" },
];

/**
 * The settings page.
 *
 * Every control here changes something the rest of the system reads, and the
 * copy says which: the accent decides what the scorer compares against, the first
 * language biases which sounds the coach names, the rate is what the reference
 * clip is synthesised at, and audio retention is what the voice socket checks
 * before it writes a turn to disk. None of these are decorative preferences.
 */
export function SettingsView({ catalog, billingConfigured }: Props) {
  const { data, isLoading } = useUserSettings();
  const updateSettings = useUpdateSettings();
  const deleteAudio = useDeleteStoredAudio();
  const billing = useBillingRedirect();

  const settings = data?.settings;
  const quota = data?.quota;

  const [form, setForm] = useState<SettingsPatch>({});
  const [status, setStatus] = useState<string | null>(null);

  // Seed the form from the server value once it arrives, then leave the user's
  // edits alone: re-seeding on every background refetch would discard them.
  useEffect(() => {
    if (!settings || Object.keys(form).length > 0) return;
    setForm({
      displayName: settings.displayName || "",
      nativeLanguage: settings.nativeLanguage || "",
      targetAccent: settings.targetAccent,
      ttsRate: settings.ttsRate,
      retainAudio: settings.retainAudio,
      practiceGoal: settings.practiceGoal || "",
      level: settings.level,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const set = <K extends keyof SettingsPatch>(key: K, value: SettingsPatch[K]) => {
    setStatus(null);
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const accent = useMemo(
    () => catalog.accents.find((option) => option.code === form.targetAccent),
    [catalog.accents, form.targetAccent]
  );
  const l1 = useMemo(
    () =>
      catalog.l1Profiles.find((option) => option.code === form.nativeLanguage),
    [catalog.l1Profiles, form.nativeLanguage]
  );

  const dirty =
    !!settings &&
    (form.displayName !== (settings.displayName || "") ||
      form.nativeLanguage !== (settings.nativeLanguage || "") ||
      form.targetAccent !== settings.targetAccent ||
      form.ttsRate !== settings.ttsRate ||
      form.retainAudio !== settings.retainAudio ||
      form.practiceGoal !== (settings.practiceGoal || "") ||
      form.level !== settings.level);

  const save = async () => {
    setStatus(null);
    try {
      await updateSettings.mutateAsync(form);
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save.");
    }
  };

  // Unsaved edits die silently on navigation — the form is seeded from the
  // server once and nothing else tracks them. Warn on tab close; in-app links
  // are covered by the visible hint next to the Save button.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  if (isLoading || !settings) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          These choices change how you are scored, what you are asked to practise,
          and what is kept afterwards.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            {quota?.limit === null
              ? "Pro — unlimited sessions and audio export."
              : `Free — ${quota?.remaining ?? 0} of ${quota?.limit ?? 0} sessions left this month.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={quota?.plan === "pro" ? "default" : "secondary"}>
            {quota?.plan === "pro" ? "Pro" : "Free"}
          </Badge>
          {quota?.limit !== null && (
            <span className="text-sm text-muted-foreground">
              {quota?.used} used since {new Date(quota?.periodStart ?? Date.now()).toDateString()}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {!billingConfigured && (
              <span className="text-xs text-muted-foreground">
                Billing is not configured on this deployment.
              </span>
            )}
            {billingConfigured && quota?.plan !== "pro" && (
              <Button
                onClick={() => billing.mutate("checkout")}
                disabled={billing.isPending}
              >
                {billing.isPending ? "Opening…" : "Upgrade to Pro"}
              </Button>
            )}
            {billingConfigured && quota?.plan === "pro" && (
              <Button
                variant="outline"
                onClick={() => billing.mutate("portal")}
                disabled={billing.isPending}
              >
                {billing.isPending ? "Opening…" : "Manage billing"}
              </Button>
            )}
          </div>
          {billing.isError && (
            <p className="w-full text-sm text-destructive">
              {billing.error instanceof Error ? billing.error.message : "Billing unavailable"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your practice</CardTitle>
          <CardDescription>
            Your native language tells the coach which sounds to expect trouble
            with. It warns — it never lowers a score.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name shown in the app</Label>
            <Input
              value={form.displayName ?? ""}
              placeholder="Your name"
              onChange={(event) => set("displayName", event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>Level</Label>
            <CommandSelect
              options={LEVELS.map((level) => ({
                id: level.value,
                value: level.value,
                children: level.label,
              }))}
              value={form.level ?? "beginner"}
              onSelect={(value) => set("level", value)}
              placeholder="Pick a level"
            />
          </div>

          <div className="grid gap-2">
            <Label>First language</Label>
            <CommandSelect
              options={catalog.l1Profiles.map((option: L1Option) => ({
                id: option.code,
                value: option.code,
                children: option.label,
              }))}
              value={form.nativeLanguage ?? ""}
              onSelect={(value) => set("nativeLanguage", value)}
              placeholder="Select your first language"
            />
            {!!l1?.weak_phones.length && (
              <div className="flex flex-wrap gap-1">
                {l1.weak_phones.map((phone) => (
                  <Badge key={phone} variant="secondary">
                    /{phone}/
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Target accent</Label>
            <CommandSelect
              options={catalog.accents.map((option: AccentOption) => ({
                id: option.code,
                value: option.code,
                children: option.label,
              }))}
              value={form.targetAccent ?? "en-US"}
              onSelect={(value) => set("targetAccent", value)}
              placeholder="Select an accent"
            />
            <p className="text-xs text-muted-foreground">
              {accent
                ? `${accent.label} is ${
                    accent.rhotic ? "rhotic: /r/ is scored everywhere." : "non-rhotic: a dropped /r/ is not an error."
                  }`
                : "The accent your pronunciation is compared against."}
            </p>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label>What are you practising for?</Label>
            <Input
              value={form.practiceGoal ?? ""}
              placeholder="e.g. a job interview, a conference talk"
              onChange={(event) => set("practiceGoal", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listening speed</CardTitle>
          <CardDescription>
            How fast the reference word is spoken back to you. Separate from the
            Slow button, which is always slower than this.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.05}
            value={form.ttsRate ?? 1}
            onChange={(event) => set("ttsRate", Number(event.target.value))}
            className="h-2 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          />
          <span className="w-12 text-sm tabular-nums">
            {(form.ttsRate ?? 1).toFixed(2)}×
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>
            Your recordings are not stored by default, and are deleted after 24
            hours if you turn this on.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="retain-audio">Keep my recordings</Label>
              <p className="text-xs text-muted-foreground">
                Off by default. Used to improve scoring, and to let you replay a
                turn. Turning it off stops new recordings; it does not delete old
                ones.
              </p>
            </div>
            <Switch
              id="retain-audio"
              checked={!!form.retainAudio}
              onCheckedChange={(checked) => set("retainAudio", checked)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={async () => {
                setStatus(null);
                try {
                  const result = await deleteAudio.mutateAsync();
                  setStatus(
                    result.deleted > 0
                      ? `Deleted ${result.deleted} recording(s).`
                      : "There was nothing stored to delete."
                  );
                } catch (error) {
                  setStatus(
                    error instanceof Error ? error.message : "Could not delete."
                  );
                }
              }}
              disabled={deleteAudio.isPending}
            >
              {deleteAudio.isPending ? "Deleting…" : "Delete stored recordings"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Removes every recording this account has on the server, now.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!dirty || updateSettings.isPending}>
          {updateSettings.isPending ? "Saving…" : "Save changes"}
        </Button>
        <span
          className={cn(
            "text-sm",
            status === "Saved." || status?.startsWith("Deleted")
              ? "text-muted-foreground"
              : "text-destructive"
          )}
          role="status"
        >
          {status}
        </span>
        {dirty && !status && (
          <span className="text-xs text-muted-foreground">
            Unsaved changes — they only apply once you save.
          </span>
        )}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
