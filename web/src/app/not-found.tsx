import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
        <Compass className="h-7 w-7" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you were looking for doesn&apos;t exist, moved, or was
          deleted. Your practice data is safe — it lives under your sessions.
        </p>
      </div>
      <div className="flex flex-col-reverse items-center gap-2 sm:flex-row">
        <ButtonLink href="/sessions" variant="outline">
          Your sessions
        </ButtonLink>
        <ButtonLink href="/home">Go to dashboard</ButtonLink>
      </div>
    </div>
  );
}

function ButtonLink({
  href,
  variant,
  children,
}: {
  href: string;
  variant?: "outline";
  children: React.ReactNode;
}) {
  const base =
    "inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors";
  const styles =
    variant === "outline"
      ? "border border-border bg-background hover:bg-muted"
      : "bg-primary text-primary-foreground hover:bg-primary/90";
  return (
    <Link href={href} className={`${base} ${styles}`}>
      {children}
    </Link>
  );
}
