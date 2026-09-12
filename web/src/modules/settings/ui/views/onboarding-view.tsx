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
import { Label } from "@/components/ui/label";
import { CommandSelect } from "@/components/command-select";
import { useUpdateSettings } from "@/hooks/use-settings";
import type { SettingsCatalog } from "@/types/settings";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface Props {
  catalog: SettingsCatalog;
  defaults: {
    displayName: string;
    nativeLanguage: string;
    targetAccent: string;
    level: string;
  };
}

const LEVELS = [
  { value: "beginner", label: "Just starting out" },
  { value: "intermediate", label: "Comfortable, want polish" },
  { value: "advanced", label: "Advanced — refining details" },
];

const STEPS = ["Your first language", "Where you are now", "What to aim for"];

/**
 * First-run setup.
 *
 * Three questions, because the two answers that actually change the product —
 * first language and target accent — have to be given *before* the first session
 * rather than discovered in settings: they decide the scoring reference and which
 * sounds get coached, and neither can be applied retroactively to a session that
 * already ran.
 *
 * Skipping is allowed and writes `onboardedAt`, so the gate never traps anyone,
 * but it leaves the accent at its default and the L1 blank.
 */
export function OnboardingView({ catalog, defaults }: Props) {
  const router = useRouter();
  const updateSettings = useUpdateSettings();

  const [step, setStep] = useState(0);
  const [nativeLanguage, setNativeLanguage] = useState(defaults.nativeLanguage);
  const [level, setLevel] = useState(defaults.level || "beginner");
  const [practiceGoal, setPracticeGoal] = useState("");
  const [targetAccent, setTargetAccent] = useState(defaults.targetAccent || "en-US");
  const [error, setError] = useState<string | null>(null);

  const l1 = useMemo(
    () => catalog.l1Profiles.find((option) => option.code === nativeLanguage),
    [catalog.l1Profiles, nativeLanguage]
  );
  const accent = useMemo(
    () => catalog.accents.find((option) => option.code === targetAccent),
    [catalog.accents, targetAccent]
  );

  const finish = async () => {
    setError(null);
    try {
      await updateSettings.mutateAsync({
        nativeLanguage,
        level,
        practiceGoal,
        targetAccent,
        onboarded: true,
      });
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-2 flex gap-1">
            {STEPS.map((label, index) => (
              <span
                key={label}
                className={`h-1 flex-1 rounded-full ${
                  index <= step ? "bg-primary" : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 &&
              "Sounds that are hard for speakers of your language differ from those that are hard for everyone else. This is a hint for the coach, not a limit on what you can practise."}
            {step === 1 && "So the first session is at the right level."}
            {step === 2 &&
              "The accent your pronunciation is compared against. Pick the English you actually need to be understood in."}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-6">
          {step === 0 && (
            <div className="grid gap-2">
              <Label>First language</Label>
              <CommandSelect
                options={catalog.l1Profiles.map((option) => ({
                  id: option.code,
                  value: option.code,
                  children: option.label,
                }))}
                value={nativeLanguage}
                onSelect={setNativeLanguage}
                placeholder="Select your first language"
              />
              {!!l1?.weak_phones.length && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {l1.weak_phones.map((phone) => (
                    <Badge key={phone} variant="secondary">
                      /{phone}/
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="grid gap-2">
                <Label>How comfortable is your spoken English?</Label>
                <CommandSelect
                  options={LEVELS.map((option) => ({
                    id: option.value,
                    value: option.value,
                    children: option.label,
                  }))}
                  value={level}
                  onSelect={setLevel}
                  placeholder="Pick a level"
                />
              </div>
              <div className="grid gap-2">
                <Label>What are you practising for?</Label>
                <CommandSelect
                  options={[
                    { value: "interviews", label: "Interviews and work" },
                    { value: "presentations", label: "Presentations and meetings" },
                    { value: "conversation", label: "Everyday conversation" },
                    { value: "clarity", label: "Being understood clearly" },
                  ].map((option) => ({
                    id: option.value,
                    value: option.value,
                    children: option.label,
                  }))}
                  value={practiceGoal}
                  onSelect={setPracticeGoal}
                  placeholder="Pick a goal"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="grid gap-2">
              <Label>Target accent</Label>
              <CommandSelect
                options={catalog.accents.map((option) => ({
                  id: option.code,
                  value: option.code,
                  children: option.label,
                }))}
                value={targetAccent}
                onSelect={setTargetAccent}
                placeholder="Select an accent"
              />
              <p className="text-xs text-muted-foreground">
                {accent
                  ? `${accent.label} is ${
                      accent.rhotic
                        ? "rhotic, so /r/ in words like “car” is scored."
                        : "non-rhotic, so a dropped /r/ in words like “car” is not counted against you."
                    }`
                  : "The accent your pronunciation is compared against."}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center gap-3">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button onClick={finish} disabled={updateSettings.isPending}>
                {updateSettings.isPending ? "Saving…" : "Start practising"}
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            )}
            <Button
              variant="link"
              className="ml-auto text-muted-foreground"
              onClick={finish}
              disabled={updateSettings.isPending}
            >
              Skip for now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
