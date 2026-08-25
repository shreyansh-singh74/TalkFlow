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
      { label: "Common questions", href: "#faq" },
    ],
  },
];

export function FooterSection() {
  return (
    <footer className="border-t border-tf-border bg-tf-bg px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <Image
                src="/logo-ink.svg"
                alt=""
                width={18}
                height={18}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-tf-text">TalkFlow</span>
            </Link>
            <p className="max-w-[240px] text-xs leading-relaxed text-tf-muted">
              Real-time pronunciation intelligence, built for real speech. Coach to be
              understood — keep your voice.
            </p>
          </div>

          {/* Link columns — only destinations that exist */}
          {FOOTER_LINKS.map(({ heading, links }) => (
            <div key={heading}>
              <h4 className="mb-4 font-mono text-[10px] font-medium uppercase tracking-widest text-tf-muted">
                {heading}
              </h4>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group inline-flex items-center gap-1 text-xs text-tf-muted transition-colors hover:text-tf-text"
                    >
                      {label}
                      <ArrowRight
                        className="tf-link-arrow size-3"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-tf-border pt-8">
          <p className="text-xs text-tf-muted">
            © {new Date().getFullYear()} TalkFlow. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
