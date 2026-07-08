"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

const TABS = ["Practice Session", "API / SDK", "Diff Engine"] as const;
type Tab = (typeof TABS)[number];

const SNIPPETS: Record<Tab, { lang: string; raw: string; html: string }> = {
  "Practice Session": {
    lang: "typescript",
    raw: `// Practice Session — live phoneme feedback
const session = await talkflow.startSession({
  targetText: "pronunciation accuracy",
  streamAudio: true,
});

session.on("phoneme", (result) => {
  console.log(result);
  // { expected: "ə", actual: "ɛ", correct: false, latency_ms: 142 }
});

session.on("complete", ({ accuracy, misses }) => {
  console.log(\`Score: \${accuracy}% — \${misses} misses\`);
});`,
    html: `<span class="t-comment">// Practice Session — live phoneme feedback</span>
<span class="t-kw">const</span> session = <span class="t-dim">await</span> talkflow.<span class="t-white">startSession</span>({
  targetText: <span class="t-str">"pronunciation accuracy"</span>,
  streamAudio: <span class="t-amber">true</span>,
});

session.<span class="t-white">on</span>(<span class="t-str">"phoneme"</span>, (result) =&gt; {
  console.<span class="t-white">log</span>(result);
  <span class="t-comment">// { expected: "ə", actual: "ɛ", correct: false, latency_ms: 142 }</span>
});

session.<span class="t-white">on</span>(<span class="t-str">"complete"</span>, ({ accuracy, misses }) =&gt; {
  console.<span class="t-white">log</span>(<span class="t-str">\`Score: \${accuracy}% — \${misses} misses\`</span>);
});`,
  },
  "API / SDK": {
    lang: "python",
    raw: `import talkflow

client = talkflow.Client(api_key="tf_live_...")

result = client.score_pronunciation(
    audio="path/to/recording.wav",
    target_text="pronunciation accuracy",
    return_phonemes=True,
)

# { "accuracy": 0.83, "latency_ms": 142,
#   "phonemes": [
#     { "expected": "p", "actual": "p", "correct": True  },
#     { "expected": "ə", "actual": "ɛ", "correct": False },
#   ] }`,
    html: `<span class="t-kw">import</span> talkflow

client = talkflow.<span class="t-white">Client</span>(api_key=<span class="t-str">"tf_live_..."</span>)

result = client.<span class="t-white">score_pronunciation</span>(
    audio=<span class="t-str">"path/to/recording.wav"</span>,
    target_text=<span class="t-str">"pronunciation accuracy"</span>,
    return_phonemes=<span class="t-amber">True</span>,
)

<span class="t-comment"># { "accuracy": 0.83, "latency_ms": 142,</span>
<span class="t-comment">#   "phonemes": [</span>
<span class="t-comment">#     { "expected": "p", "actual": "p", "correct": True  },</span>
<span class="t-miss">#     { "expected": "ə", "actual": "ɛ", "correct": False },</span>
<span class="t-comment">#   ] }</span>`,
  },
  "Diff Engine": {
    lang: "python",
    raw: `from talkflow.diff import phoneme_diff

diff = phoneme_diff(
    expected="p r ə n ʌ n . s i . eɪ . ʃ ə n",
    actual  ="p r ɛ n ʌ n . s i . eɪ . s ə n",
)

for op in diff.operations:
    print(op)

# { "op": "keep",    "phoneme": "p" }
# { "op": "keep",    "phoneme": "r" }
# { "op": "replace", "from": "ə", "to": "ɛ" }  ← mismatch
# { "op": "keep",    "phoneme": "n" }
# { "op": "replace", "from": "ʃ", "to": "s" }  ← mismatch`,
    html: `<span class="t-kw">from</span> talkflow.diff <span class="t-kw">import</span> phoneme_diff

diff = <span class="t-white">phoneme_diff</span>(
    expected=<span class="t-str">"p r ə n ʌ n . s i . eɪ . ʃ ə n"</span>,
    actual  =<span class="t-str">"p r ɛ n ʌ n . s i . eɪ . s ə n"</span>,
)

<span class="t-dim">for</span> op <span class="t-dim">in</span> diff.operations:
    <span class="t-white">print</span>(op)

<span class="t-comment"># { "op": "keep",    "phoneme": "p" }</span>
<span class="t-comment"># { "op": "keep",    "phoneme": "r" }</span>
<span class="t-miss"># { "op": "replace", "from": "ə", "to": "ɛ" }  ← mismatch</span>
<span class="t-comment"># { "op": "keep",    "phoneme": "n" }</span>
<span class="t-miss"># { "op": "replace", "from": "ʃ", "to": "s" }  ← mismatch</span>`,
  },
};

export function CodeSection() {
  const [activeTab, setActiveTab] = useState<Tab>("Practice Session");
  const [copied, setCopied] = useState(false);

  const snippet = SNIPPETS[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.raw).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className="py-24 px-6"
      style={{ borderTop: "1px solid rgba(239, 234, 225, 0.08)" }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center md:text-left">
          <p
            className="text-[10px] uppercase tracking-widest mb-3 font-mono"
            style={{ color: "rgba(239, 234, 225, 0.4)" }}
          >
            Integration
          </p>
          <h2
            className="text-3xl md:text-4xl font-semibold tracking-tight"
            style={{ color: "var(--parchment)" }}
          >
            From raw speech to structured feedback — one call.
          </h2>
        </div>

        {/* Code panel */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: "#1C1E22",
            border: "1px solid rgba(239, 234, 225, 0.08)",
          }}
        >
          {/* Tab bar */}
          <div
            className="flex items-center px-2 overflow-x-auto"
            style={{ borderBottom: "1px solid rgba(239, 234, 225, 0.08)" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-shrink-0 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap"
                style={{
                  borderColor: activeTab === tab ? "var(--emerald)" : "transparent",
                  color: activeTab === tab ? "#00d196" : "rgba(239, 234, 225, 0.4)",
                }}
              >
                {tab}
              </button>
            ))}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="ml-auto flex-shrink-0 flex items-center gap-1.5 text-xs transition-colors px-3 py-2 mr-1 rounded"
              style={{ color: "rgba(239, 234, 225, 0.4)" }}
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" style={{ color: "#22C55E" }} />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Code body */}
          <div className="p-6 overflow-x-auto">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
                style={{
                  color: "rgba(239, 234, 225, 0.4)",
                  border: "1px solid rgba(239, 234, 225, 0.08)",
                }}
              >
                {snippet.lang}
              </span>
            </div>
            <pre
              className="text-[13px] leading-[1.8] font-mono"
              style={{ color: "rgba(239, 234, 225, 0.7)" }}
            >
              <code dangerouslySetInnerHTML={{ __html: snippet.html }} />
            </pre>
          </div>
        </div>
      </div>

      {/* Syntax token colors */}
      <style>{`
        .t-kw      { color: #6C8BFF; }
        .t-dim     { color: rgba(239, 234, 225, 0.4); }
        .t-str     { color: #86EFAC; }
        .t-amber   { color: #FF8F5B; }
        .t-white   { color: var(--parchment); }
        .t-comment { color: rgba(239, 234, 225, 0.25); }
        .t-miss    { color: var(--amber-warm); }
      `}</style>
    </section>
  );
}
