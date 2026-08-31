import { TICKER_PAIRS } from "./phoneme-data";

/**
 * Deep-forest band of word → IPA pairs that runs between the hero and the
 * feature grid. Replaces the pair of curved SVG marquees that used to sit behind
 * the headline: same idea, but it no longer competes with the h1 for attention.
 *
 * The track holds two identical halves, each padded by exactly the item gap, so
 * the shared `animate-marquee` keyframe (translateX(-50%)) loops seamlessly.
 */
export function PhonemeTicker() {
  return (
    <div
      className="phoneme-ticker relative overflow-hidden border-y border-tf-deep-line py-5"
      aria-hidden="true"
    >
      <div className="tf-dots-deep pointer-events-none absolute inset-0 opacity-70" />

      <div className="relative flex w-max animate-marquee">
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 items-center gap-10 pr-10 md:gap-14 md:pr-14"
          >
            {TICKER_PAIRS.map(({ word, ipa }) => (
              <span
                key={word}
                className="phoneme-ticker-pair flex shrink-0 items-baseline gap-2.5 text-sm"
              >
                <span className="font-sans font-medium text-tf-deep-text/85">
                  {word}
                </span>
                <span className="text-tf-mint/40">/</span>
                <span className="text-tf-mint">{ipa}</span>
                <span className="text-tf-mint/40">/</span>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Feather the ends so items enter and leave instead of popping. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-tf-deep to-transparent md:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-tf-deep to-transparent md:w-32" />
    </div>
  );
}
