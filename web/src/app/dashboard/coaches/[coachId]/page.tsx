import { CoachIdView } from "@/modules/coaches/ui/views/coach-id-view";

interface Props {
  params: Promise<{ coachId: string }>;
}

export default async function Page({ params }: Props) {
    const {coachId} = await params;

    return <CoachIdView coachId={coachId} />;
}
