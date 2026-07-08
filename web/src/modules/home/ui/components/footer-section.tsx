import Link from "next/link";
import Image from "next/image";
import { Github, Linkedin, Twitter } from "lucide-react";

const FOOTER_LINKS: Record<string, string[]> = {
  Product: ["Practice Sessions", "Live Scoring", "Pricing", "Solutions"],
  Developers: ["Documentation", "API Reference", "Changelog", "Support"],
  Resources: ["About", "Blog", "Benchmarks", "Demo"],
};

export function FooterSection() {
  return (
    <footer
      className="py-16 px-6"
      style={{ borderTop: "1px solid rgba(239, 234, 225, 0.08)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.svg"
                alt="TalkFlow"
                width={18}
                height={18}
                className="opacity-60"
              />
              <span className="font-semibold text-sm" style={{ color: "var(--parchment)" }}>
                TalkFlow
              </span>
            </Link>
            <p
              className="text-xs leading-relaxed mb-6 max-w-[190px]"
              style={{ color: "rgba(239, 234, 225, 0.4)" }}
            >
              Real-time pronunciation intelligence, built for real speech.
            </p>
            <div className="flex items-center gap-3.5">
              {[
                { Icon: Github, label: "GitHub" },
                { Icon: Linkedin, label: "LinkedIn" },
                { Icon: Twitter, label: "X / Twitter" },
              ].map(({ Icon, label }) => (
                <Link
                  key={label}
                  href="#"
                  className="transition-colors hover:text-white"
                  style={{ color: "rgba(239, 234, 225, 0.4)" }}
                  aria-label={label}
                >
                  <Icon className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4
                className="text-[10px] font-medium mb-4 uppercase tracking-widest font-mono"
                style={{ color: "rgba(239, 234, 225, 0.4)" }}
              >
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-xs transition-colors hover:text-white"
                      style={{ color: "rgba(239, 234, 225, 0.5)" }}
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid rgba(239, 234, 225, 0.08)" }}
        >
          <p className="text-xs" style={{ color: "rgba(239, 234, 225, 0.4)" }}>
            © {new Date().getFullYear()} TalkFlow. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {["Terms", "Privacy"].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-xs transition-colors hover:text-white"
                style={{ color: "rgba(239, 234, 225, 0.5)" }}
              >
                {item}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
