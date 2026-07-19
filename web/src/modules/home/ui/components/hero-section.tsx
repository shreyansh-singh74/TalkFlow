"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Mic, Play } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Phoneme = { s: string; ok: boolean } | null;

const PHONEMES: Phoneme[] = [
  { s: "p", ok: true },
  { s: "r", ok: true },
  { s: "ə", ok: false }, // mismatch → amber
  null,
  { s: "n", ok: true },
  { s: "ʌ", ok: false }, // mismatch → amber
  { s: "n", ok: true },
  null,
  { s: "s", ok: true },
  { s: "i", ok: true },
  null,
  { s: "eɪ", ok: true },
  null,
  { s: "ʃ", ok: false }, // mismatch → amber
  { s: "ə", ok: true },
  { s: "n", ok: true },
];

const REAL_COUNT = PHONEMES.filter(Boolean).length;

const STATS = [
  { value: "<150ms", label: "phoneme feedback latency" },
  { value: "40+", label: "accents & dialects" },
  { value: "95%+", label: "phoneme-diff accuracy" },
  { value: "Real-time", label: "spoken-word streaming" },
];

const TECH_LOGOS = [
  "Deepgram",
  "Google Cloud TTS",
  "Next.js",
  "FastAPI",
  "HuggingFace",
  "wav2vec2",
];

export function HeroSection() {
  const [activeRealIdx, setActiveRealIdx] = useState(-1);
  const pausedRef = useRef(false);
  const { data: session } = authClient.useSession();

  useEffect(() => {
    let idx = 0;
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActiveRealIdx(idx);
      idx++;
      if (idx >= REAL_COUNT) {
        pausedRef.current = true;
        setTimeout(() => {
          idx = 0;
          setActiveRealIdx(-1);
          pausedRef.current = false;
        }, 2000);
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-6 overflow-hidden">
      {/* Subtle single warm-neutral vignette — no blue glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(0, 168, 120, 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto w-full text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8"
          style={{
            border: "1px solid rgba(0, 168, 120, 0.4)",
            backgroundColor: "rgba(0, 168, 120, 0.08)",
            color: "#00d196",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--amber-warm)" }}
          />
          Live Pronunciation Scoring — Try it now
        </div>

        {/* H1 */}
        <h1
          className="text-5xl md:text-6xl lg:text-[4.25rem] font-semibold tracking-tight leading-[1.08] mb-5"
          style={{ color: "var(--parchment)" }}
        >
          Speak with confidence.
          <br />
          {/* Emerald reserved for the brand accent line only */}
          <span style={{ color: "var(--emerald)" }}>Sound like it too.</span>
        </h1>

        <p
          className="text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8"
          style={{ color: "rgba(239, 234, 225, 0.6)" }}
        >
          TalkFlow listens to how you actually speak, maps it against native
          pronunciation, and shows you exactly what to fix — in real time.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
          <Link
            href={session?.user ? "/dashboard" : "/sign-up"}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-white text-sm font-medium transition-all"
            style={{
              backgroundColor: "var(--emerald)",
              boxShadow: "0 0 24px rgba(0, 168, 120, 0.4)",
            }}
          >
            <Mic className="w-4 h-4" />
            {session?.user ? "Go to Dashboard" : "Try for free"}
          </Link>
          <Link
            href="#demo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors"
            style={{
              border: "1px solid rgba(239, 234, 225, 0.15)",
              color: "rgba(239, 234, 225, 0.7)",
            }}
          >
            <Play className="w-4 h-4" />
            Watch a demo
          </Link>
        </div>

        {/* Stats strip — white numbers, no blue */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 mb-10 rounded-xl overflow-hidden"
          style={{ border: "1px solid rgba(239, 234, 225, 0.08)" }}
        >
          {STATS.map(({ value, label }, i) => (
            <div
              key={label}
              className="px-5 py-5 text-center"
              style={{
                backgroundColor: "#1C1E22",
                borderRight:
                  i < STATS.length - 1 ? "1px solid rgba(239, 234, 225, 0.08)" : "none",
              }}
            >
              <div
                className="text-2xl md:text-[1.7rem] font-semibold font-mono tracking-tight mb-1"
                style={{ color: "var(--parchment)" }}
              >
                {value}
              </div>
              <div className="text-[11px]" style={{ color: "rgba(239, 234, 225, 0.4)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Phoneme Staff Visual */}
        <PhonemeStaff activeRealIdx={activeRealIdx} />

        {/* Logo marquee */}
        <div className="pt-10">
          <p
            className="text-[10px] uppercase tracking-widest mb-5 font-mono"
            style={{ color: "#3F3F46" }}
          >
            Built with
          </p>
          <div className="relative overflow-hidden">
            <div
              className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none z-10"
              style={{
                background:
                  "linear-gradient(to right, var(--ink), transparent)",
              }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10"
              style={{
                background:
                  "linear-gradient(to left, var(--ink), transparent)",
              }}
            />
            <div className="flex animate-marquee gap-14 whitespace-nowrap w-max">
              {[...TECH_LOGOS, ...TECH_LOGOS].map((logo, i) => (
                <span
                  key={i}
                  className="text-[13px] font-mono cursor-default select-none"
                  style={{ color: "#3F3F46" }}
                >
                  {logo}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhonemeStaff({ activeRealIdx }: { activeRealIdx: number }) {
  let realSeen = -1;

  // Count mismatches scanned so far
  let scannedMismatches = 0;
  let scannedTotal = 0;
  PHONEMES.forEach((ph) => {
    if (!ph) return;
    if (scannedTotal <= activeRealIdx) {
      if (!ph.ok) scannedMismatches++;
      scannedTotal++;
    }
  });
  const accuracy =
    activeRealIdx < 0
      ? 0
      : Math.round(((activeRealIdx + 1 - scannedMismatches) / (activeRealIdx + 1)) * 100);

  return (
    <div
      className="rounded-xl p-6 overflow-hidden text-left"
      style={{
        backgroundColor: "#1C1E22",
        border: "1px solid rgba(239, 234, 225, 0.08)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p
            className="text-[10px] uppercase tracking-widest font-mono mb-0.5"
            style={{ color: "rgba(239, 234, 225, 0.4)" }}
          >
            Analyzing
          </p>
          <p className="text-xl font-semibold" style={{ color: "var(--parchment)" }}>
            pronunciation
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--amber-warm)" }}
          />
          <span
            className="text-[10px] font-mono tracking-widest"
            style={{ color: "rgba(239, 234, 225, 0.4)" }}
          >
            LIVE
          </span>
        </div>
      </div>

      {/* Staff lines + phoneme tokens */}
      <div className="relative py-4">
        {/* Decorative staff lines */}
        <div
          className="absolute inset-x-0 top-1/3 h-px"
          style={{ backgroundColor: "rgba(239, 234, 225, 0.04)" }}
        />
        <div
          className="absolute inset-x-0 top-2/3 h-px"
          style={{ backgroundColor: "rgba(239, 234, 225, 0.04)" }}
        />

        <div className="relative z-10 flex items-center gap-1.5 flex-wrap">
          {PHONEMES.map((ph, idx) => {
            // Word boundary separator
            if (!ph) {
              return (
                <span
                  key={idx}
                  className="text-xs mx-0.5"
                  style={{ color: "rgba(239, 234, 225, 0.15)" }}
                >
                  |
                </span>
              );
            }

            realSeen++;
            const thisRealIdx = realSeen;
            const isActive = thisRealIdx === activeRealIdx;
            const isPast = thisRealIdx < activeRealIdx;

            // Correct phoneme (scanned) — neutral silver, subtle
            // Mismatch phoneme (scanned) — vivid amber, stands out
            // Not yet scanned — very dark, unlit

            let bgColor = "rgba(239, 234, 225, 0.04)";
            let borderColor = "rgba(239, 234, 225, 0.08)";
            let textColor = "rgba(239, 234, 225, 0.25)";
            let shadow = "none";
            let scale = "scale-100";

            if (isPast || isActive) {
              if (ph.ok) {
                bgColor = "rgba(239, 234, 225, 0.08)";
                borderColor = "rgba(239, 234, 225, 0.15)";
                textColor = "var(--parchment)";
              } else {
                bgColor = "var(--amber-muted)";
                borderColor = "rgba(194, 94, 47, 0.45)";
                textColor = "var(--amber-warm)";
              }
            }

            if (isActive) {
              scale = "scale-110";
              if (ph.ok) {
                shadow = "0 0 12px rgba(239, 234, 225, 0.15)";
                borderColor = "rgba(239, 234, 225, 0.3)";
              } else {
                shadow = "0 0 14px rgba(194, 94, 47, 0.5)";
                borderColor = "rgba(194, 94, 47, 0.7)";
              }
            }

            return (
              <div
                key={idx}
                className={`relative flex flex-col items-center transition-transform duration-150 ${scale}`}
              >
                <span
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-mono font-medium transition-all duration-200"
                  style={{
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    color: textColor,
                    boxShadow: shadow,
                  }}
                >
                  {ph.s}
                </span>
                {/* Status tick/cross below token */}
                {isPast && (
                  <span
                    className="absolute -bottom-4 text-[8px] font-mono"
                    style={{ color: ph.ok ? "rgba(239, 234, 225, 0.4)" : "var(--amber-warm)" }}
                  >
                    {ph.ok ? "✓" : "✗"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Accuracy meter */}
      <div
        className="mt-8 pt-4 flex items-center gap-4"
        style={{ borderTop: "1px solid rgba(239, 234, 225, 0.05)" }}
      >
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: "rgba(239, 234, 225, 0.4)" }}>Phoneme accuracy</span>
            <span className="font-mono" style={{ color: "var(--parchment)" }}>
              {activeRealIdx < 0 ? "—" : `${accuracy}%`}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "rgba(239, 234, 225, 0.05)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: activeRealIdx < 0 ? "0%" : `${accuracy}%`,
                backgroundColor: "var(--emerald)",
              }}
            />
          </div>
        </div>
        <div
          className="text-xs whitespace-nowrap"
          style={{ color: "rgba(239, 234, 225, 0.4)" }}
        >
          <span style={{ color: "var(--amber-warm)" }}>3</span> mismatches found
        </div>
      </div>
    </div>
  );
}
