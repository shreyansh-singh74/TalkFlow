import { TICKER_PAIRS } from "./phoneme-data";

/**
 * A straight, legible band of word → "sounds like" pairs that runs between the
 * hero and the feature grid. Each word is respelled into plain-English syllables
 * with the stressed syllable highlighted, so it reads like a dictionary entry
 * instead of an IPA string.
 *
 * The track holds two identical halves, each padded by exactly the item gap, so
 * the shared `animate-marquee` keyframe (translateX(-50%)) loops seamlessly.
 */
export function PhonemeTicker() {
  return (
    <div
      className="relative overflow-hidden border-y border-tf-border bg-tf-surface py-5"
      aria-hidden="true"
    >
      <div className="relative flex w-max animate-marquee">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 items-center gap-8 pr-8 md:gap-12 md:pr-12"
          >
            {TICKER_PAIRS.map(({ word, sounds }) => (
              <span
                key={word}
                className="flex shrink-0 items-baseline gap-3 text-sm md:text-[15px]"
              >
                <span className="font-sans font-medium text-tf-subtle">
                  {word}
                </span>
                <span className="flex items-baseline gap-1.5">
                  {sounds.map((s, i) => (
                    <span key={`${word}-${i}`} className="flex items-baseline gap-1.5">
                      {i > 0 ? (
                        <span className="text-tf-green/40" aria-hidden="true">
                          ·
                        </span>
                      ) : null}
                      <span
                        className={
                          s.stress
                            ? "font-semibold text-tf-green"
                            : "text-tf-text/80"
                        }
                      >
                        {s.text}
                      </span>
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Feather the ends so items enter and leave instead of popping. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-tf-surface to-transparent md:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-tf-surface to-transparent md:w-32" />
    </div>
  );
}
