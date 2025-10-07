import { AgentGetOne } from "../../types";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { agentsInsertSchema } from "../../schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NameAvatar } from "@/components/name-avatar";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCreateAgent, useUpdateAgent } from "@/hooks/use-api";

interface AgentFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialValues?: AgentGetOne;
}

export const AgentForm = ({
  onSuccess,
  onCancel,
  initialValues,
}: AgentFormProps) => {
  const router = useRouter();

  const createAgent = useCreateAgent();
  const updateAgent = useUpdateAgent();

  // Handle success and error for create
  if (createAgent.isSuccess) {
    onSuccess?.();
  }
  if (createAgent.isError) {
    toast.error(createAgent.error?.message || "Failed to create agent");
  }

  // Handle success and error for update
  if (updateAgent.isSuccess) {
    onSuccess?.();
  }
  if (updateAgent.isError) {
    toast.error(updateAgent.error?.message || "Failed to update agent");
  }

  const form = useForm<z.infer<typeof agentsInsertSchema>>({
    resolver: zodResolver(agentsInsertSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      instructions: initialValues?.instructions ?? "",
    },
  });

  const isEdit = !!initialValues?.id;
  const isPending = !!createAgent.isPending || updateAgent.isPending;

  const onSubmit = (values: z.infer<typeof agentsInsertSchema>) => {
    if (isEdit) {
      updateAgent.mutate({...values,id:initialValues.id})
    } else {
      createAgent.mutate(values);
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <NameAvatar name={field.value} />
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Math A.I." />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          name="instructions"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="You are a helpful math assistant that can answer questions and help with tasks."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
            {isPending ? "Creating..." : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Form>
  );
};