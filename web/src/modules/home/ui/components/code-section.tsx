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
    html: `<span class="t-comment">// Practice Session — live phoneme feedback</span>\n<span class="t-kw">const</span> session = <span class="t-dim">await</span> talkflow.<span class="t-fn">startSession</span>({\n  targetText: <span class="t-str">"pronunciation accuracy"</span>,\n  streamAudio: <span class="t-bool">true</span>,\n});\n\nsession.<span class="t-fn">on</span>(<span class="t-str">"phoneme"</span>, (result) =&gt; {\n  console.<span class="t-fn">log</span>(result);\n  <span class="t-comment">// { expected: "ə", actual: "ɛ", correct: false, latency_ms: 142 }</span>\n});\n\nsession.<span class="t-fn">on</span>(<span class="t-str">"complete"</span>, ({ accuracy, misses }) =&gt; {\n  console.<span class="t-fn">log</span>(<span class="t-str">\`Score: \${accuracy}% — \${misses} misses\`</span>);\n});`,
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
    html: `<span class="t-kw">import</span> talkflow\n\nclient = talkflow.<span class="t-fn">Client</span>(api_key=<span class="t-str">"tf_live_..."</span>)\n\nresult = client.<span class="t-fn">score_pronunciation</span>(\n    audio=<span class="t-str">"path/to/recording.wav"</span>,\n    target_text=<span class="t-str">"pronunciation accuracy"</span>,\n    return_phonemes=<span class="t-bool">True</span>,\n)\n\n<span class="t-comment"># { "accuracy": 0.83, "latency_ms": 142,</span>\n<span class="t-comment">#   "phonemes": [</span>\n<span class="t-comment">#     { "expected": "p", "actual": "p", "correct": True  },</span>\n<span class="t-miss">#     { "expected": "ə", "actual": "ɛ", "correct": False },</span>\n<span class="t-comment">#   ] }</span>`,
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
    html: `<span class="t-kw">from</span> talkflow.diff <span class="t-kw">import</span> phoneme_diff\n\ndiff = <span class="t-fn">phoneme_diff</span>(\n    expected=<span class="t-str">"p r ə n ʌ n . s i . eɪ . ʃ ə n"</span>,\n    actual  =<span class="t-str">"p r ɛ n ʌ n . s i . eɪ . s ə n"</span>,\n)\n\n<span class="t-dim">for</span> op <span class="t-dim">in</span> diff.operations:\n    <span class="t-fn">print</span>(op)\n\n<span class="t-comment"># { "op": "keep",    "phoneme": "p" }</span>\n<span class="t-comment"># { "op": "keep",    "phoneme": "r" }</span>\n<span class="t-miss"># { "op": "replace", "from": "ə", "to": "ɛ" }  ← mismatch</span>\n<span class="t-comment"># { "op": "keep",    "phoneme": "n" }</span>\n<span class="t-miss"># { "op": "replace", "from": "ʃ", "to": "s" }  ← mismatch</span>`,
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
    <section className="border-t border-tf-border bg-tf-bg px-6 py-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center md:text-left">
          <span className="tf-eyebrow mb-3">Integration</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-tf-text md:text-4xl">
            From raw speech to structured feedback — one call.
          </h2>
        </div>

        {/* Code panel */}
        <div className="overflow-hidden rounded-2xl border border-tf-border bg-tf-surface shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {/* Tab bar */}
          <div className="flex items-center overflow-x-auto border-b border-tf-border px-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 py-3.5 text-[13px] font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  activeTab === tab
                    ? "border-tf-green text-tf-green-strong"
                    : "border-transparent text-tf-muted hover:text-tf-text"
                }`}
              >
                {tab}
              </button>
            ))}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="ml-auto flex shrink-0 items-center gap-1.5 rounded px-3 py-2 text-xs text-tf-muted transition-colors hover:text-tf-text"
            >
              {copied ? (
                <Check className="size-3.5 text-tf-green" />
              ) : (
                <Copy className="size-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Code body */}
          <div className="overflow-x-auto bg-[#F8F8F0] p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded border border-tf-border bg-tf-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-tf-muted">
                {snippet.lang}
              </span>
            </div>
            <pre className="font-mono text-[13px] leading-[1.8] text-tf-muted">
              <code dangerouslySetInnerHTML={{ __html: snippet.html }} />
            </pre>
          </div>
        </div>
      </div>

      {/* Syntax token colors — warm cream-compatible palette */}
      <style>{`
        .t-kw      { color: #5B6FD4; }
        .t-dim     { color: rgba(26, 26, 26, 0.35); }
        .t-fn      { color: #1A1A1A; font-weight: 500; }
        .t-str     { color: #18A44B; }
        .t-bool    { color: #C25E2F; }
        .t-comment { color: rgba(26, 26, 26, 0.30); }
        .t-miss    { color: var(--amber-warm); font-weight: 500; }
      `}</style>
    </section>
  );
}
