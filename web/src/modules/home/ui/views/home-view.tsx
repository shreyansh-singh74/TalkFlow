"use client";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { MicIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export const HomeView = () => {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  const handleStartConversation = () => {
    router.push('/meetings');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center space-y-12">
        {/* Welcome Message */}
        <div className="space-y-4">
          {isPending ? (
            <div className="h-10 bg-muted animate-pulse rounded w-64 mx-auto" />
          ) : (
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              Welcome, {userName}
            </h1>
          )}
          <p className="text-lg md:text-xl text-muted-foreground">
            Ready to have a conversation?
          </p>
        </div>

        {/* Main CTA Button */}
        <div className="flex flex-col items-center gap-6">
          <Button 
            size="lg"
            onClick={handleStartConversation}
            className="h-20 px-12 text-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
          >
            <MicIcon className="mr-3 h-6 w-6" />
            Start Conversation
          </Button>
          
          <p className="text-sm text-muted-foreground">
            Simple. Natural. Chat.
          </p>
        </div>
      </div>
    </div>
  );
};