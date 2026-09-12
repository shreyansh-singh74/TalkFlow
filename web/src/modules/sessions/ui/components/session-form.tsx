import { useForm } from "react-hook-form";
import { z } from "zod";
import { sessionsInsertSchema } from "../../schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SessionGetOne } from "../../types";
import { useEffect, useMemo, useState } from "react";
import { CommandSelect } from "@/components/command-select";
import { SegmentedControl } from "@/components/segmented-control";
import { NameAvatar } from "@/components/name-avatar";
import { NewCoachDialog } from "@/modules/coaches/ui/components/new-coach-dialog";
import {
  useCoaches,
  useCreatePracticeSession,
  useGenerateScript,
  useUpdatePracticeSession,
} from "@/hooks/use-api";
import {
  DIFFICULTY_LABELS,
  type Difficulty,
  type PracticeScript,
  type SessionSource,
} from "@/types/practice";
import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react";

interface SessionFormProps {
  onSuccess?: (id?: string) => void;
  onCancel?: () => void;
  initialValues?: SessionGetOne;
  /** Pre-selects a coach when the form was opened from a coach's "Start". */
  initialCoachId?: string;
}

const SOURCE_OPTIONS: ReadonlyArray<{
  value: SessionSource;
  label: string;
  description: string;
}> = [
  {
    value: "coach",
    label: "Practise with a coach",
    description: "Sentences written for your topic",
  },
  {
    value: "custom",
    label: "Use my own text",
    description: "Rehearse a speech or script",
  },
];

const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: Difficulty;
  label: string;
  description: string;
}> = [
  { value: "easy", label: "Easy", description: "4–7 words" },
  { value: "medium", label: "Medium", description: "7–12 words" },
  { value: "hard", label: "Hard", description: "12–20 words" },
];

const STEP_COUNT_OPTIONS = [
  { value: "5", label: "5 steps", description: "~3 min" },
  { value: "10", label: "10 steps", description: "~6 min" },
  { value: "15", label: "15 steps", description: "~10 min" },
] as const;

export const SessionForm = ({
  onSuccess,
  onCancel,
  initialValues,
  initialCoachId,
}: SessionFormProps) => {
  const [openNewCoachDialog, setOpenNewCoachDialog] = useState(false);
  const [coachSearch, setCoachSearch] = useState("");
  const [script, setScript] = useState<PracticeScript | null>(
    initialValues?.script ?? null
  );

  const coaches = useCoaches({ pageSize: 100, search: coachSearch });
  const createSession = useCreatePracticeSession();
  const updateSession = useUpdatePracticeSession();
  const generateScript = useGenerateScript();

  const form = useForm<z.input<typeof sessionsInsertSchema>>({
    resolver: zodResolver(sessionsInsertSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      coachId: initialValues?.coachId ?? initialCoachId ?? null,
      source: initialValues?.source ?? "coach",
      sourceText: initialValues?.sourceText ?? "",
      difficulty: initialValues?.difficulty ?? "medium",
      stepCount: 10,
    },
  });

  const source = form.watch("source") as SessionSource;
  const coachId = form.watch("coachId");
  const difficulty = form.watch("difficulty") as Difficulty;
  const sourceText = form.watch("sourceText") ?? "";
  const stepCount = form.watch("stepCount");

  const selectedCoach = useMemo(
    () => coaches.data?.items?.find((coach) => coach.id === coachId),
    [coaches.data, coachId]
  );

  // A coach carries its own difficulty; mirror it so the preview and the saved
  // session agree with what the coach was set up to teach.
  useEffect(() => {
    if (source === "coach" && selectedCoach?.difficulty) {
      form.setValue("difficulty", selectedCoach.difficulty);
    }
  }, [source, selectedCoach, form]);

  // Any change to the inputs invalidates a script built from the old ones.
  useEffect(() => {
    setScript(null);
  }, [source, coachId, difficulty, sourceText, stepCount]);

  const isEdit = !!initialValues?.id;
  const isPending = createSession.isPending || updateSession.isPending;

  const canPreview =
    source === "custom"
      ? sourceText.trim().length >= 120
      : Boolean(coachId);

  const handlePreview = () => {
    generateScript.mutate(
      {
        source,
        difficulty,
        step_count: Number(stepCount),
        topic: selectedCoach?.topic || undefined,
        coach_name: selectedCoach?.name,
        accent: selectedCoach?.accent ?? "en-US",
        focus_sounds: selectedCoach?.focusSounds ?? [],
        source_text: source === "custom" ? sourceText : undefined,
      },
      {
        onSuccess: setScript,
        onError: (error) =>
          toast.error(error.message || "Could not build a practice script"),
      }
    );
  };

  const removeStep = (index: number) => {
    if (!script || script.steps.length <= 1) return;
    setScript({
      ...script,
      steps: script.steps
        .filter((step) => step.index !== index)
        .map((step, i) => ({ ...step, index: i })),
    });
  };

  const onSubmit = (values: z.input<typeof sessionsInsertSchema>) => {
    const payload = {
      ...values,
      // Send the reviewed script so the server saves exactly what was shown.
      ...(script ? { script } : {}),
    };

    if (isEdit) {
      updateSession.mutate(
        { ...payload, id: initialValues.id },
        {
          onSuccess: () => onSuccess?.(),
          onError: (error) =>
            toast.error(error.message || "Failed to update session"),
        }
      );
    } else {
      createSession.mutate(payload, {
        onSuccess: (createdSession) => onSuccess?.(createdSession?.id),
        onError: (error) =>
          toast.error(error.message || "Failed to create session"),
      });
    }
  };

  return (
    <>
      <NewCoachDialog
        open={openNewCoachDialog}
        onOpenChange={setOpenNewCoachDialog}
      />
      <Form {...form}>
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Session name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. Monday warm-up" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="source"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>What do you want to practise?</FormLabel>
                <FormControl>
                  <SegmentedControl
                    options={SOURCE_OPTIONS}
                    value={field.value as SessionSource}
                    stackOnMobile
                    onChange={(value) => {
                      field.onChange(value);
                      // The two modes are mutually exclusive on the server.
                      form.setValue(
                        "coachId",
                        value === "custom" ? null : (coachId ?? null)
                      );
                    }}
                    disabled={isPending}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {source === "coach" ? (
            <FormField
              name="coachId"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coach</FormLabel>
                  <FormControl>
                    <CommandSelect
                      options={(coaches.data?.items ?? []).map((coach) => ({
                        id: coach.id,
                        value: coach.id,
                        children: (
                          <div className="flex items-center gap-x-2">
                            <NameAvatar name={coach.name} size={25} />
                            <span>{coach.name}</span>
                          </div>
                        ),
                      }))}
                      onSelect={field.onChange}
                      onSearch={setCoachSearch}
                      value={field.value ?? ""}
                      placeholder="Select a coach"
                      className="w-full"
                    />
                  </FormControl>
                  {selectedCoach?.topic && (
                    <FormDescription>
                      Drills <strong>{selectedCoach.topic}</strong> at{" "}
                      {DIFFICULTY_LABELS[selectedCoach.difficulty as Difficulty]}{" "}
                      difficulty.
                    </FormDescription>
                  )}
                  <FormDescription>
                    Not found what you&apos;re looking for?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setOpenNewCoachDialog(true)}
                    >
                      Create a new coach
                    </button>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              name="sourceText"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paste your text</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={8}
                      placeholder="Paste the speech, presentation or script you want to rehearse. It gets split into practice steps you can work through one at a time."
                    />
                  </FormControl>
                  <FormDescription>
                    {sourceText.trim().length} characters — every word is kept,
                    nothing is rewritten.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {source === "coach" && (
            <FormField
              name="stepCount"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session length</FormLabel>
                  <FormControl>
                    <SegmentedControl
                      options={STEP_COUNT_OPTIONS}
                      value={String(field.value)}
                      onChange={(value) => field.onChange(Number(value))}
                      disabled={isPending}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}

          <FormField
            name="difficulty"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Difficulty</FormLabel>
                <FormControl>
                  <SegmentedControl
                    options={DIFFICULTY_OPTIONS}
                    value={field.value as Difficulty}
                    onChange={field.onChange}
                    disabled={isPending}
                  />
                </FormControl>
                <FormDescription>
                  {source === "custom"
                    ? "Controls how finely your text is split, and the score needed to advance."
                    : "Inherited from the coach; override it for this session only."}
                </FormDescription>
              </FormItem>
            )}
          />

          <div className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Practice steps</p>
                <p className="text-muted-foreground text-xs">
                  {script
                    ? `${script.steps.length} steps · pass at ${script.pass_threshold}%`
                    : "Preview what you'll practise before you start."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPreview || generateScript.isPending}
                onClick={handlePreview}
              >
                {generateScript.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <SparklesIcon className="size-4" />
                )}
                {script ? "Regenerate" : "Preview"}
              </Button>
            </div>

            {script && (
              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{script.source_label}</Badge>
                  {script.generated_by === "fallback" && (
                    <Badge variant="secondary">
                      Generic sentences — topic generation was unavailable
                    </Badge>
                  )}
                  {script.truncated && (
                    <Badge variant="secondary">
                      Text was long — practising the first {script.steps.length}{" "}
                      steps
                    </Badge>
                  )}
                </div>
                <ol className="max-h-48 space-y-1 overflow-y-auto sm:max-h-64">
                  {script.steps.map((step) => (
                    <li
                      key={step.index}
                      className="group flex items-start gap-x-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                    >
                      <span className="text-muted-foreground w-5 shrink-0 tabular-nums">
                        {step.index + 1}.
                      </span>
                      <span className="flex-1">{step.text}</span>
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {step.word_count}w
                      </span>
                      {script.steps.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove step ${step.index + 1}`}
                          className="text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => removeStep(step.index)}
                        >
                          <XIcon className="size-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">
            {onCancel && (
              <Button
                variant={"ghost"}
                disabled={isPending}
                type="button"
                onClick={() => onCancel()}
                className="w-full min-[420px]:w-auto"
              >
                Cancel
              </Button>
            )}
            <Button
              className="w-full min-[420px]:w-auto"
              disabled={isPending}
              type="submit"
            >
              {isPending
                ? "Saving..."
                : isEdit
                  ? "Update"
                  : script
                    ? "Create session"
                    : "Create & build steps"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
};
