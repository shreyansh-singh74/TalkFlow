const STEPS = [
  {
    number: "01",
    title: "Messy, real spoken practice.",
    desc: "Accents, filler words, mumbling, self-consciousness — most practice tools fail here. TalkFlow doesn't.",
  },
  {
    number: "02",
    title: "Real-time listening.",
    desc: "TalkFlow streams your speech and aligns it to expected phonemes in under 150ms. No delay, no lag.",
  },
  {
    number: "03",
    title: "Instant, precise correction.",
    desc: 'You see exactly which sound broke and how to fix it — not a vague "try again." Specific is useful.',
  },
  {
    number: "04",
    title: "Practice that compounds.",
    desc: "Every session sharpens your accuracy. The improvement is measurable and the feedback is yours to keep.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(239, 234, 225, 0.08)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left — numbered steps */}
          <div>
            <p
              className="text-[10px] uppercase tracking-widest mb-4 font-mono"
              style={{ color: "rgba(239, 234, 225, 0.4)" }}
            >
              How it works
            </p>
            <h2
              className="text-3xl md:text-4xl font-semibold tracking-tight mb-12 leading-tight"
              style={{ color: "var(--parchment)" }}
            >
              Real problems.
              <br />
              Real fixes.
            </h2>

            <div className="space-y-10">
              {STEPS.map(({ number, title, desc }) => (
                <div key={number} className="flex gap-6">
                  <div className="flex-shrink-0 w-10">
                    <span
                      className="text-3xl font-mono font-bold"
                      style={{ color: "rgba(239, 234, 225, 0.15)" }}
                    >
                      {number}
                    </span>
                  </div>
                  <div className="pt-1">
                    <h3
                      className="font-medium text-[15px] mb-2"
                      style={{ color: "var(--parchment)" }}
                    >
                      {title}
                    </h3>
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{ color: "rgba(239, 234, 225, 0.6)" }}
                    >
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — mock practice session UI */}
          <div className="lg:sticky lg:top-24">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: "#1C1E22",
                border: "1px solid rgba(239, 234, 225, 0.08)",
              }}
            >
              {/* Session header bar */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(239, 234, 225, 0.08)" }}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: "var(--amber-warm)" }}
                  />
                  <span
                    className="text-xs font-mono tracking-wide"
                    style={{ color: "rgba(239, 234, 225, 0.6)" }}
                  >
                    LIVE SESSION
                  </span>
                </div>
                <span
                  className="text-xs font-mono"
                  style={{ color: "rgba(239, 234, 225, 0.4)" }}
                >
                  02:14
                </span>
              </div>

              {/* Target phrase */}
              <div className="px-5 pt-5 pb-4">
                <p
                  className="text-[10px] uppercase tracking-widest mb-2 font-mono"
                  style={{ color: "rgba(239, 234, 225, 0.4)" }}
                >
                  Target phrase
                </p>
                <p
                  className="text-lg font-semibold"
                  style={{ color: "var(--parchment)" }}
                >
                  &ldquo;The pronunciation was perfect.&rdquo;
                </p>
              </div>



              {/* Accuracy bar */}
              <div
                className="mx-5 mb-4 p-4 rounded-lg"
                style={{
                  backgroundColor: "rgba(239, 234, 225, 0.03)",
                  border: "1px solid rgba(239, 234, 225, 0.08)",
                }}
              >
                <div className="flex justify-between text-xs mb-2">
                  <span style={{ color: "rgba(239, 234, 225, 0.6)" }}>Session accuracy</span>
                  <span className="font-mono" style={{ color: "var(--parchment)" }}>
                    88%
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: "rgba(239, 234, 225, 0.06)" }}
                >
                  <div
                    className="h-full w-[88%] rounded-full"
                    style={{ backgroundColor: "var(--emerald)" }}
                  />
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[10px]" style={{ color: "rgba(239, 234, 225, 0.4)" }}>
                    <span style={{ color: "var(--amber-warm)" }}>2</span> sounds to fix
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: "rgba(239, 234, 225, 0.4)" }}
                  >
                    ə → ɛ · ʌ → ɔ
                  </span>
                </div>
              </div>

              {/* Fix suggestion */}
              <div
                className="mx-5 mb-5 p-4 rounded-lg"
                style={{
                  backgroundColor: "rgba(194, 94, 47, 0.05)",
                  border: "1px solid rgba(194, 94, 47, 0.15)",
                }}
              >
                <p
                  className="text-[11px] font-medium mb-1"
                  style={{ color: "var(--amber-warm)" }}
                >
                  Fix: /ə/ in &ldquo;pro·nun·ci·a·tion&rdquo;
                </p>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "rgba(239, 234, 225, 0.6)" }}
                >
                  Relax your tongue to center. The schwa is neutral and
                  unstressed — no jaw movement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
