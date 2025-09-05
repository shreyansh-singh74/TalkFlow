import { MeetingsView } from "@/modules/meetings/ui/views/meetings-view";

interface Props {
  params: Promise<{ meetingId: string }>;
}

export default async function Page({ params }: Props) {
  const { meetingId } = await params;

  return (
    <div>
      <MeetingsView />
    </div>
  );
}
