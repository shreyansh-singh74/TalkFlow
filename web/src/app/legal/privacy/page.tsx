import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — TalkFlow",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-6">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← Back to TalkFlow
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: September 2026
        </p>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            TalkFlow processes your microphone audio in real time to score
            pronunciation. By default the raw audio is discarded immediately
            after a turn is scored — nothing is written to disk.
          </p>
          <p>
            If you turn on &ldquo;Keep my recordings&rdquo; in Settings, turns
            are stored for 24 hours and then deleted automatically; you can also
            delete everything stored at any time from the same screen.
          </p>
          <p>
            We keep your account details (email, display name), your session
            transcripts, and the per-sound scores that power your progress page.
            None of it is sold or shared for advertising. Third-party processors
            involved in running the service are the AI model provider (text
            coaching) and the speech synthesis provider (reference audio).
          </p>
          <p>
            This summary is a placeholder. The full policy will replace this
            page before general availability.
          </p>
        </div>
      </main>
    </div>
  );
}
