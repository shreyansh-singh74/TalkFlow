import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Small uppercase pill above the heading. */
  eyebrow?: string;
  /** First clause, set in the sans face. */
  title: string;
  /** Second clause, set in italic serif. */
  accent?: string;
  /** Put the accent clause on its own line. */
  accentOnNewLine?: boolean;
  sub?: string;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
}

/**
 * The heading rhythm every landing section shares: eyebrow pill, then a heading
 * split into a sans clause and an italic-serif clause, then an optional subhead.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  accentOnNewLine = false,
  sub,
  align = "center",
  as: Tag = "h2",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "flex flex-col",
        centered ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? <span className="tf-eyebrow mb-5">{eyebrow}</span> : null}

      <Tag
        className={cn(
          "text-balance text-tf-text",
          Tag === "h1"
            ? "text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.03em]"
            : "text-3xl font-semibold leading-[1.12] tracking-tight md:text-4xl",
        )}
      >
        {title}
        {accent ? (
          <>
            {accentOnNewLine ? <br /> : " "}
            <span className="h-accent">{accent}</span>
          </>
        ) : null}
      </Tag>

      {sub ? (
        <p
          className={cn(
            "mt-5 text-balance text-[15px] leading-relaxed text-tf-muted",
            centered ? "max-w-xl" : "max-w-lg",
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
