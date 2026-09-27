import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — TalkFlow",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">
          Last updated: September 2026
        </p>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            TalkFlow provides AI-assisted English pronunciation practice. By
            creating an account you agree to use the service for lawful,
            personal learning purposes.
          </p>
          <p>
            Your practice audio is not stored unless you explicitly opt in from
            Settings, and stored audio is deleted after 24 hours or whenever you
            ask us to delete it. Session transcripts and scores are kept to
            power your progress page and can be exported or removed at any time.
          </p>
          <p>
            The service is provided &ldquo;as is&rdquo;, without warranties of
            any kind. Scores and feedback are learning aids, not certified
            assessments of language proficiency.
          </p>
          <p>
            These terms are a placeholder summary. The governing, full-length
            document will replace this page before general availability.
          </p>
        </div>
      </main>
    </div>
  );
}
