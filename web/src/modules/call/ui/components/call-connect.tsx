import { CallUI } from "./call-ui";

interface Props {
  meetingId: string;
  meetingName: string;
  agentId: string;
  userId: string;
  userName: string;
  userImage: string;
}

export const CallConnect = ({
  meetingName,
  meetingId,
  agentId,
  userId,
  userName,
  userImage,
}: Props) => {
  return (
    <div className="flex flex-col h-full">
      <CallUI
        meetingId={meetingId}
        meetingName={meetingName}
        agentId={agentId}
        userId={userId}
        userName={userName}
        userImage={userImage}
      />
    </div>
  );
};
