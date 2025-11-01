import { CallUI } from "./call-ui";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  meetingId: string;
  meetingName: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userName: string;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userImage: string;
}

export const CallConnect = ({
  meetingName,
}: Props) => {
  
  // TODO: Implement custom WebRTC connection logic
  // This will be replaced with your own WebRTC implementation
  
  return (
    <div className="flex flex-col h-full">
      <CallUI meetingName={meetingName} />
    </div>
  );
};
