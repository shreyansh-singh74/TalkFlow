"use client";
import { ErrorState } from "@/components/error-state";
import { useMeeting } from "@/hooks/use-api";
import { CallProvider } from "../components/call-provider";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { useEffect, useMemo, useState } from "react";

interface Props {
  meetingId: string;
}

export const CallView = ({ meetingId }: Props) => {
  const { data, isLoading, error } = useMeeting(meetingId);

  const {
    supported,
    listening,
    transcript,
    error: sttError,
    start,
    stop,
    lastResponse,
  } = useSpeechToText({
    endpoint: process.env.NEXT_PUBLIC_BACKEND_URL
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "")}/api/respond`
      : undefined,
  });

  const [sending, setSending] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const ttsSupported = useMemo(() => typeof window !== "undefined" && !!window.speechSynthesis, []);

  async function handleStop() {
    setSending(true);
    try {
      await stop();
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!autoSpeak || !ttsSupported) return;
    if (!lastResponse) return;
    try {
      const utter = new SpeechSynthesisUtterance(lastResponse);
      utter.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch (_) {
      // no-op
    }
  }, [lastResponse, autoSpeak, ttsSupported]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-white">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <ErrorState 
          title="Failed to Load Meeting"
          description="Could not load the meeting details. Please try again."
        />
      </div>
    );
  }

  if(data.status === "completed"){
    return (
        <div className="flex h-screen items-center justify-center">
            <ErrorState 
                title="Meeting has Ended"
                description="You can no longer join this meeting."
            />
        </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">

      <CallProvider 
          meetingId={meetingId}
          meetingName={data.name}
      />
    </div>
  )
};
