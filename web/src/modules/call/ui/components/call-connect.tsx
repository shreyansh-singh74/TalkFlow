import { CallUI } from "./call-ui";

interface Props {
  meetingId: string;
  meetingName: string;
  userId: string;
  userName: string;
  userImage: string;
}

export const CallConnect = ({
  meetingName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  meetingId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userImage,
}: Props) => {
  
  // TODO: Implement custom WebRTC connection logic
  // This will be replaced with your own WebRTC implementation
  
  return (
    <div className="flex flex-col h-full">
      <CallUI meetingName={meetingName} />
    </div>
  );
};
