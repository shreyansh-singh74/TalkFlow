import { CoachGetOne } from "../../types";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { coachesInsertSchema } from "../../schemas";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { NameAvatar } from "@/components/name-avatar";
import { SegmentedControl } from "@/components/segmented-control";
import { CommandSelect } from "@/components/command-select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { useCreateCoach, useUpdateCoach } from "@/hooks/use-api";
import { ACCENT_OPTIONS, type Difficulty } from "@/types/practice";

interface CoachFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialValues?: CoachGetOne;
}

const DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: Difficulty;
  label: string;
  description: string;
}> = [
  { value: "easy", label: "Easy", description: "4–7 words" },
  { value: "medium", label: "Medium", description: "7–12 words" },
  { value: "hard", label: "Hard", description: "12–20 words" },
];

export const CoachForm = ({
  onSuccess,
  onCancel,
  initialValues,
}: CoachFormProps) => {
  const createCoach = useCreateCoach();
  const updateCoach = useUpdateCoach();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const form = useForm<z.input<typeof coachesInsertSchema>>({
    resolver: zodResolver(coachesInsertSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      topic: initialValues?.topic ?? "",
      difficulty: initialValues?.difficulty ?? "medium",
      accent: initialValues?.accent ?? "en-US",
      focusSounds: initialValues?.focusSounds ?? [],
      instructions: initialValues?.instructions ?? "",
    },
  });

  const isEdit = !!initialValues?.id;
  const isPending = createCoach.isPending || updateCoach.isPending;

  const onSubmit = (values: z.input<typeof coachesInsertSchema>) => {
    if (isEdit) {
      updateCoach.mutate(
        { ...values, id: initialValues.id },
        {
          onSuccess,
          onError: (error) => {
            toast.error(error.message || "Failed to update coach");
          },
        }
      );
    } else {
      createCoach.mutate(values, {
        onSuccess,
        onError: (error) => {
          toast.error(error.message || "Failed to create coach");
        },
      });
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <NameAvatar name={field.value} />
              <FormLabel>Coach name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Interview Prep Coach" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="topic"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>What should this coach drill?</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g. Job interviews for software engineers"
                />
              </FormControl>
              <FormDescription>
                Practice sentences are written from this topic, so be specific.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
                Sets sentence length and the score you need to advance a step.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground flex items-center gap-x-1 text-sm"
            >
              <ChevronRightIcon
                className={`size-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              />
              Advanced
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-5 pt-4">
            <FormField
              name="accent"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target accent</FormLabel>
                  <FormControl>
                    <CommandSelect
                      options={ACCENT_OPTIONS.map((accent) => ({
                        id: accent.value,
                        value: accent.value,
                        children: <span>{accent.label}</span>,
                      }))}
                      onSelect={field.onChange}
                      value={field.value ?? "en-US"}
                      placeholder="Select an accent"
                      className="w-full"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="instructions"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coaching style (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="e.g. Be blunt about mistakes and keep corrections to one sentence."
                    />
                  </FormControl>
                  <FormDescription>
                    Shapes how feedback is worded. It does not choose the
                    practice content — topic and difficulty do that.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="flex justify-between gap-x-2">
          {onCancel && (
            <Button
              variant={"ghost"}
              disabled={isPending}
              type="button"
              onClick={() => onCancel()}
            >
              Cancel
            </Button>
          )}
          <Button disabled={isPending} type="submit">
            {isPending ? "Saving..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
