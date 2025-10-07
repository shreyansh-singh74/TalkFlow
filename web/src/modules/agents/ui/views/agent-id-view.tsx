"use client";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useAgent, useDeleteAgent } from "@/hooks/use-api";
import { AgentIdViewHeader } from "../components/agent-id-view-header";
import { NameAvatar } from "@/components/name-avatar";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "../../hooks/use-confirm";
import { useState } from "react";
import { UpdateAgentDialog } from "../components/update-agent-dialog";

interface Props {
  agentId: string;
}

export const AgentIdView = ({ agentId }: Props) => {
  const [updateAgentDialogOpen,setUpdateAgentDialogOpen] = useState(false);
  const router = useRouter();
  const { data, isLoading, error } = useAgent(agentId);
  const removeAgent = useDeleteAgent();

  // Handle success and error for delete
  if (removeAgent.isSuccess) {
    router.push("/agents");
    toast.success("Agent deleted successfully");
  }
  if (removeAgent.isError) {
    toast.error(removeAgent.error?.message || "Failed to delete agent");
  }

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Are you sure",
    `The following action will remove ${data?.meetingCount} associated meetings`
  );

  const handleRemoveAgent = async () => {
    const ok = await confirmRemove();

    if (!ok) return;

    await removeAgent.mutateAsync({ id: agentId });
  };

  if (isLoading) {
    return <AgentsIdViewLoading />;
  }

  if (error) {
    return (
      <ErrorState
        title="Agent Not Found"
        description={
          error.message ||
          "The agent you're looking for doesn't exist or you don't have access to it."
        }
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Agent Not Found"
        description="The agent you're looking for doesn't exist."
      />
    );
  }

  return (
    <>
      <RemoveConfirmation />
      <UpdateAgentDialog 
        open={updateAgentDialogOpen}
        onOpenChange={setUpdateAgentDialogOpen}
        initialValues={data}
      />
      <div className="flex-1 py-4 md:px-8 flex flex-col gap-y-4">
        <AgentIdViewHeader
          agentId={agentId}
          agentName={data.name}
          onEdit={() => setUpdateAgentDialogOpen(true)}
          onRemove={handleRemoveAgent}
        />
        <div className="bg-white rounded-lg border">
          <div className="px-4 py-5 gap-y-5 flex flex-col col-span-5">
            <div className="flex items-center gap-x-3">
              <NameAvatar name={data.name} size={40} />
              <h2 className="text-2xl font-medium">{data.name}</h2>
            </div>
            <Badge
              variant="outline"
              className="flex items-center gap-x-2 [&>svg]:size-4"
            >
              <VideoIcon className="text-blue-700" />
              {data.meetingCount}{" "}
              {data.meetingCount === 1 ? "meeting" : "meetings"}
            </Badge>
            <div className="flex flex-col gap-y-4">
              <p className="text-lg font-medium">Instructions</p>
              <p className="text-neutral-800">{data.instructions}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const AgentsIdViewLoading = () => {
  return (
    <LoadingState
      title="Loading Agents"
      description="This may take few seconds"
    />
  );
};

export const AgentsIdViewError = () => {
  return (
    <ErrorState
      title="Error Loading Agents"
      description="Something went wrong"
    />
  );
};
