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
  /** `deep` inverts the type for the dark forest-green sections. */
  tone?: "light" | "deep";
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
  tone = "light",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";
  const deep = tone === "deep";

  return (
    <div
      className={cn(
        "flex flex-col",
        centered ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span className={cn("tf-eyebrow mb-5", deep && "tf-eyebrow-deep")}>
          {eyebrow}
        </span>
      ) : null}

      <Tag
        className={cn(
          "text-balance",
          deep ? "text-tf-deep-text" : "text-tf-text",
          Tag === "h1"
            ? "text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.03em]"
            : "text-[clamp(1.875rem,3.6vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.035em]",
        )}
      >
        {title}
        {accent ? (
          <>
            {accentOnNewLine ? <br /> : " "}
            <span
              className={cn("h-accent", deep ? "text-tf-mint" : "text-tf-green-strong")}
            >
              {accent}
            </span>
          </>
        ) : null}
      </Tag>

      {sub ? (
        <p
          className={cn(
            "mt-5 text-balance text-[15px] leading-relaxed",
            deep ? "text-tf-deep-muted" : "text-tf-muted",
            centered ? "max-w-xl" : "max-w-lg",
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
