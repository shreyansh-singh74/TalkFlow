function collectVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return [];
  }
  return window.speechSynthesis.getVoices() ?? [];
}

function normLocale(s: string): string {
  return s.replace(/_/g, "-").trim();
}

function pickVoiceForLang(lang: string): SpeechSynthesisVoice | null {
  const voices = collectVoices();
  if (!voices.length) {
    return null;
  }
  const L = normLocale(lang).toLowerCase();
  const exact = voices.find((v) => normLocale(v.lang).toLowerCase() === L);
  if (exact) {
    return exact;
  }
  const base = L.split("-")[0];
  const byPrefix = voices.find((v) => {
    const bl = normLocale(v.lang).toLowerCase();
    return bl === L || bl.startsWith(`${L}-`) || (base && (bl === base || bl.startsWith(`${base}-`)));
  });
  if (byPrefix) {
    return byPrefix;
  }
  return (
    voices.find((v) => normLocale(v.lang).toLowerCase().startsWith("en-")) ?? voices[0] ?? null
  );
}

function whenVoicesReady(fn: () => void): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  const synth = window.speechSynthesis;
  if (collectVoices().length > 0) {
    fn();
    return;
  }
  let done = false;
  const go = () => {
    if (done) {
      return;
    }
    done = true;
    fn();
  };
  const onVoices = () => {
    if (collectVoices().length > 0) {
      synth.removeEventListener("voiceschanged", onVoices);
      go();
    }
  };
  synth.addEventListener("voiceschanged", onVoices);
  synth.getVoices();
  window.setTimeout(() => {
    synth.removeEventListener("voiceschanged", onVoices);
    go();
  }, 500);
}

export type SpeakWordOptions = {
  rate?: number;
  /** BCP-47, e.g. en-IN, en-US */
  lang?: string;
};

export function speakWord(text: string, options: SpeakWordOptions = {}): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return;
  }
  const lang = options.lang || "en-US";
  const rate = options.rate ?? 1;

  const doSpeak = () => {
    const utter = new SpeechSynthesisUtterance(trimmed);
    const v = pickVoiceForLang(lang);
    utter.text = trimmed;
    utter.lang = (v && normLocale(v.lang)) || normLocale(lang);
    if (v) {
      utter.voice = v;
    }
    utter.volume = 1;
    utter.pitch = 1;
    utter.rate = Math.min(2, Math.max(0.4, rate));
    window.speechSynthesis.cancel();
    window.setTimeout(() => {
      window.speechSynthesis.speak(utter);
    }, 0);
  };

  const synth = window.speechSynthesis;
  synth.getVoices();
  if (collectVoices().length > 0) {
    doSpeak();
    return;
  }
  queueMicrotask(() => {
    synth.getVoices();
    if (collectVoices().length > 0) {
      doSpeak();
      return;
    }
    requestAnimationFrame(() => {
      synth.getVoices();
      if (collectVoices().length > 0) {
        doSpeak();
        return;
      }
      whenVoicesReady(doSpeak);
    });
  });
}

export function requestSpeechVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

export const DIALECTS = [
  { label: "US English", value: "en-US" },
  { label: "Indian English", value: "en-IN" },
  { label: "UK English", value: "en-GB" },
] as const;
