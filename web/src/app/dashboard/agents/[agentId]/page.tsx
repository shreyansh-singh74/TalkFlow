import { AgentIdView } from "@/modules/agents/ui/views/agent-id-view";

interface Props {
  params: Promise<{ agentId: string }>;
}

export default async function Page({ params }: Props) {
    const {agentId} = await params;

    return <AgentIdView agentId={agentId} />;
}
