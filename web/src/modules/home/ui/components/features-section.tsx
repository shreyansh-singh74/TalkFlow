import {
  Waves,
  Zap,
  Volume2,
  GitCompare,
  Globe,
  BookOpen,
} from "lucide-react";

const FEATURES = [
  {
    icon: Waves,
    title: "Phoneme-level accuracy",
    desc: "wav2vec2-based extraction catches mispronunciations standard speech-to-text misses. Every sound, analyzed.",
  },
  {
    icon: Zap,
    title: "Real-time streaming",
    desc: "Deepgram-powered live transcription with sub-150ms turnaround. No waiting, no interruptions.",
  },
  {
    icon: Volume2,
    title: "Natural TTS modeling",
    desc: "Google Cloud TTS reference audio shows you the target pronunciation the moment you need it.",
  },
  {
    icon: GitCompare,
    title: "Visual phoneme diff",
    desc: "Edit-distance diffing renders exactly which sounds were off — and how far off they were.",
  },
  {
    icon: Globe,
    title: "Works on any device",
    desc: "Browser-based practice with no install. Mobile and desktop. Start speaking in seconds.",
  },
  {
    icon: BookOpen,
    title: "Built on open speech research",
    desc: "Grounded in established ASR/phoneme research. Transparent methodology, not a black box.",
  },
];

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(239, 234, 225, 0.08)" }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-14 max-w-2xl">
          <p
            className="text-[10px] uppercase tracking-widest mb-4 font-mono"
            style={{ color: "rgba(239, 234, 225, 0.4)" }}
          >
            Built by learners. Designed for real speech.
          </p>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight mb-4"
            style={{ color: "var(--parchment)" }}
          >
            Ship real spoken-English feedback into your practice — every session.
          </h2>
          <p className="text-[15px]" style={{ color: "rgba(239, 234, 225, 0.6)" }}>
            No linguistics background required. No manual grading.
          </p>
        </div>

        {/* 3×2 feature grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ border: "1px solid rgba(239, 234, 225, 0.08)", borderRadius: "0.75rem", overflow: "hidden" }}
        >
          {FEATURES.map(({ icon: Icon, title, desc }, i) => {
            const isBottomRow = i >= 3;
            return (
              <div
                key={title}
                className="p-7 group transition-colors"
                style={{
                  backgroundColor: "#1C1E22",
                  borderRight: (i % 3 !== 2) ? "1px solid rgba(239, 234, 225, 0.08)" : "none",
                  borderBottom: !isBottomRow ? "1px solid rgba(239, 234, 225, 0.08)" : "none",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-5"
                  style={{ backgroundColor: "rgba(239, 234, 225, 0.05)" }}
                >
                  <Icon
                    className="w-4 h-4"
                    strokeWidth={1.5}
                    style={{ color: "rgba(239, 234, 225, 0.6)" }}
                  />
                </div>
                <h3
                  className="font-medium mb-2 text-[15px]"
                  style={{ color: "var(--parchment)" }}
                >
                  {title}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(239, 234, 225, 0.6)" }}>
                  {desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
