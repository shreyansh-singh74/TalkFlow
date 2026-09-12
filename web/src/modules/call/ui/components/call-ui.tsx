import { useState } from "react";
import { CallLobby } from "./call-lobby";
import { CallActive } from "./call-active";
import { CallEnded } from "./call-ended";
import { useUpdatePracticeSession } from "@/hooks/use-api";
import { SessionStatus } from "@/modules/sessions/types";
import type { Difficulty, PracticeScript, SessionSource } from "@/types/practice";

interface Props {
  sessionId: string;
  sessionName: string;
  coachName: string;
  coachInstructions: string;
  /** Null for sessions created before scripts existed; the engine then falls
   * back to a generic bank for the difficulty. */
  script: PracticeScript | null;
  source: SessionSource;
  difficulty: Difficulty;
  topic: string;
  accent: string;
  /** Learner settings that shape the session: L1 coaching bias, audio-retention
   * consent, and listening speed. */
  l1?: string;
  retainAudio?: boolean;
  listeningRate?: number;
}

export const CallUI = ({
  sessionId,
  sessionName,
  coachName,
  coachInstructions,
  script,
  source,
  difficulty,
  topic,
  accent,
  l1,
  retainAudio,
  listeningRate,
}: Props) => {
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");
  const updateSession = useUpdatePracticeSession();

  const handleJoin = async () => {
    updateSession.mutate({
      id: sessionId,
      status: SessionStatus.Active,
      startedAt: new Date().toISOString(),
    });
    setShow("call");
  };

  const handleLeave = async () => {
    updateSession.mutate({
      id: sessionId,
      status: SessionStatus.Completed,
      endedAt: new Date().toISOString(),
    });
    setShow("ended");
  };

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
      {show == "lobby" && (
        <CallLobby
          onJoin={handleJoin}
          sessionName={sessionName}
          coachName={coachName}
          script={script}
          source={source}
          difficulty={difficulty}
        />
      )}
      {show == "call" && (
        <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
          <CallActive
            onLeave={handleLeave}
            sessionName={sessionName}
            sessionId={sessionId}
            coachName={coachName}
            coachInstructions={coachInstructions}
            script={script}
            source={source}
            difficulty={difficulty}
            topic={topic}
            accent={accent}
            l1={l1}
            retainAudio={retainAudio}
            listeningRate={listeningRate}
          />
        </div>
      )}
      {show == "ended" && <CallEnded sessionId={sessionId} />}
    </div>
  );
};
