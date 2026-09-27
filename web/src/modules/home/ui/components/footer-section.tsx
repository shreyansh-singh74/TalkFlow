import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const FOOTER_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "See a session", href: "#demo" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create an account", href: "/sign-up" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="relative overflow-hidden border-t border-tf-border bg-tf-surface px-6 pb-10 pt-16">
      {/* The wordmark's own pronunciation, oversized and nearly invisible. */}
      <p
        className="pointer-events-none absolute -bottom-4 left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-mono text-[clamp(4rem,17vw,13rem)] font-medium leading-none text-tf-text/[0.04]"
        aria-hidden="true"
      >
        /ˈtɔːk.fləʊ/
      </p>

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="mb-4 flex w-fit items-center">
              <Image src="/Talkflow_logo.svg" alt="TalkFlow" width={44} height={44} className="h-11 w-11 object-contain" />
            </Link>
            <p className="max-w-[260px] text-[12.5px] leading-relaxed text-tf-muted">
              Pronunciation feedback at the level of individual sounds. Be
              understood clearly, keep your accent.
            </p>

            <Link
              href="/sign-up"
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-tf-green px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-tf-green-strong"
            >
              Start practicing free
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {FOOTER_LINKS.map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-tf-subtle">
                {heading}
              </h4>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group inline-flex items-center gap-1 text-[12.5px] text-tf-muted transition-colors hover:text-tf-green"
                    >
                      {label}
                      <ArrowRight className="tf-link-arrow size-3" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-tf-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-tf-subtle">
            © {new Date().getFullYear()} TalkFlow. All rights reserved.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-tf-subtle">
            Clarity, not accent
          </p>
        </div>
      </div>
    </footer>
  );
}
