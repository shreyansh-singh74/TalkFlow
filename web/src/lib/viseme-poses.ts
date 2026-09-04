/**
 * Mouth-shape (viseme) poses for the pronunciation reference card.
 *
 * The backend returns a coarse `viseme_id` (0–9) per phoneme from
 * `arpabet_tables.VISEME_ID_MAP`. Those ten groups are a stable coding target
 * shared by the scorer and the aligner, and they are deliberately not changed
 * here — but two of their merges are wrong for a *teaching* diagram:
 *
 *   - group 4 puts interdental /θ ð/ and sibilant /s z/ in one pose, while the
 *     backend's own coaching copy tells the learner "you're making an 's'
 *     instead of 'th' — place your tongue between your teeth"
 *     (`phoneme_analysis_service.CONFUSION_TIPS`). Identical pictures next to
 *     that sentence teach the opposite of what it says.
 *   - group 7 puts spread /iː/ and rounded /w/ together, which inverts lip
 *     rounding — the single most visible parameter of the whole diagram.
 *
 * So the pose is refined here, on the client, from the ARPABET symbol that is
 * returned alongside `viseme_id`. The backend table stays byte-identical and
 * every existing consumer keeps receiving exactly what it receives today.
 *
 * A pose is not a hand-drawn path. It is a point in a small articulatory
 * parameter space (jaw opening, lip rounding, lip spreading, protrusion, teeth
 * and tongue visibility), and the SVG geometry is generated from that vector.
 * That is what makes the shapes interpolable: morphing between two poses is
 * just lerping two vectors, so diphthongs and consonant transitions glide
 * instead of snapping, and there are no path-compatibility constraints to
 * maintain across fifteen separate drawings.
 */

/** Refined pose ids. 0–9 keep the backend's meaning; 10–14 are subdivisions. */
export type PoseId =
  | 0 // closed lips        P B M
  | 1 // teeth on lip       F V
  | 2 // tongue tip         D T N
  | 3 // tongue back        K G NG
  | 4 // narrow teeth gap   S Z
  | 5 // open               AE EH AA AY AW
  | 6 // neutral schwa      AH
  | 7 // spread lips        IY IH EY Y
  | 8 // rounded lips       UW OW OY W UH
  | 9 // r-coloured         ER R
  | 10 // tongue between teeth   TH DH
  | 11 // rounded sibilant       SH ZH CH JH
  | 12 // tongue tip raised      L
  | 13 // open + rounded         AO
  | 14; // breathy neutral       HH

/**
 * Symbol-level overrides applied on top of `viseme_id`.
 *
 * Only these nine entries differ from the backend grouping. Everything else
 * falls through to the id the backend already sent, so an unknown or future
 * symbol degrades to the coarse pose rather than to nothing.
 */
const POSE_OVERRIDES: Record<string, PoseId> = {
  TH: 10,
  DH: 10,
  SH: 11,
  ZH: 11,
  CH: 11,
  JH: 11,
  L: 12,
  AO: 13,
  HH: 14,
  W: 8, // backend groups /w/ with spread /iː/; /w/ is rounded
  UH: 8, // "book" is rounded, not a plain schwa
};

/** Resolve the pose for a phoneme. Falls back to the backend's id, then to rest. */
export function poseIdFor(symbol: string, visemeId: number): PoseId {
  const override = POSE_OVERRIDES[(symbol || "").toUpperCase()];
  if (override !== undefined) return override;
  if (Number.isInteger(visemeId) && visemeId >= 0 && visemeId <= 9) {
    return visemeId as PoseId;
  }
  return 6;
}

/**
 * An articulatory pose. All values are 0–1.
 *
 * `jaw` and `round`/`spread` set the aperture; `protrude` pushes the lips
 * forward (drawn as a second outer ring, since this is a front view);
 * `teeth`/`lowerTeeth` reveal each row; `tongue` raises the tongue body toward
 * the palate; `tongueOut` pushes the tip between the teeth, which is the one
 * feature that distinguishes /θ ð/ from /s z/.
 */
export interface PoseVector {
  jaw: number;
  round: number;
  spread: number;
  protrude: number;
  teeth: number;
  lowerTeeth: number;
  tongue: number;
  tongueOut: number;
}

const P = (
  jaw: number,
  round: number,
  spread: number,
  protrude: number,
  teeth: number,
  lowerTeeth: number,
  tongue: number,
  tongueOut = 0
): PoseVector => ({ jaw, round, spread, protrude, teeth, lowerTeeth, tongue, tongueOut });

/**
 * The rest pose — deliberately *not* pose 0.
 *
 * Pose 0 is an articulated /p/: lips actively pressed together. A mouth at rest
 * is passively, slightly parted. Reusing pose 0 for idle would make a silent
 * card look like it is pronouncing a stop consonant.
 */
export const REST_POSE: PoseVector = P(0.09, 0.12, 0.06, 0, 0.05, 0, 0.08);

export const POSES: Record<PoseId, PoseVector> = {
  //          jaw  round spread protr teeth lower tongue (tongueOut)
  0: /* PBM */ P(0.0, 0.18, 0.02, 0.05, 0.0, 0.0, 0.0),
  1: /* FV  */ P(0.1, 0.05, 0.3, 0.0, 0.95, 0.0, 0.05),
  2: /* DTN */ P(0.3, 0.05, 0.28, 0.0, 0.5, 0.2, 0.85),
  3: /* KGN */ P(0.34, 0.08, 0.2, 0.0, 0.35, 0.15, 0.25),
  4: /* SZ  */ P(0.11, 0.0, 0.5, 0.0, 1.0, 0.8, 0.2),
  5: /* AE  */ P(0.78, 0.02, 0.32, 0.0, 0.3, 0.15, 0.2),
  6: /* AH  */ P(0.44, 0.1, 0.12, 0.0, 0.16, 0.06, 0.16),
  7: /* IY  */ P(0.24, 0.0, 0.88, 0.0, 0.58, 0.32, 0.4),
  8: /* UW  */ P(0.32, 0.85, 0.0, 0.9, 0.0, 0.0, 0.1),
  9: /* ER  */ P(0.36, 0.42, 0.08, 0.38, 0.14, 0.05, 0.55),
  10: /* TH */ P(0.2, 0.0, 0.26, 0.0, 0.85, 0.35, 0.3, 1.0),
  11: /* SH */ P(0.17, 0.52, 0.0, 0.62, 0.9, 0.6, 0.25),
  12: /* L  */ P(0.42, 0.04, 0.24, 0.0, 0.3, 0.1, 1.0),
  13: /* AO */ P(0.64, 0.48, 0.0, 0.32, 0.14, 0.05, 0.12),
  14: /* HH */ P(0.36, 0.06, 0.14, 0.0, 0.1, 0.04, 0.1),
};

/**
 * Plain-language articulation notes. Used for the screen-reader description and
 * the pose tooltip, so the information survives with the animation switched off.
 */
export const POSE_HINTS: Record<PoseId, string> = {
  0: "Lips pressed together, then released",
  1: "Top teeth resting on the lower lip",
  2: "Tongue tip touching the ridge behind the top teeth",
  3: "Back of the tongue raised against the soft palate",
  4: "Teeth almost closed, air hissing through a narrow gap",
  5: "Jaw dropped, mouth wide open",
  6: "Mouth relaxed and half open",
  7: "Lips spread wide, corners pulled back",
  8: "Lips rounded and pushed forward",
  9: "Lips slightly rounded, tongue curled back",
  10: "Tongue tip between the teeth",
  11: "Lips rounded and pushed forward, teeth close together",
  12: "Tongue tip raised to the roof of the mouth, sides open",
  13: "Mouth open and rounded",
  14: "Mouth relaxed, a quiet breath of air",
};

export const REST_HINT = "Mouth at rest";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Interpolate two poses. `t` 0 → `a`, 1 → `b`. */
export function blendPose(a: PoseVector, b: PoseVector, t: number): PoseVector {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return {
    jaw: lerp(a.jaw, b.jaw, k),
    round: lerp(a.round, b.round, k),
    spread: lerp(a.spread, b.spread, k),
    protrude: lerp(a.protrude, b.protrude, k),
    teeth: lerp(a.teeth, b.teeth, k),
    lowerTeeth: lerp(a.lowerTeeth, b.lowerTeeth, k),
    tongue: lerp(a.tongue, b.tongue, k),
    tongueOut: lerp(a.tongueOut, b.tongueOut, k),
  };
}

/* ------------------------------------------------------------------ geometry */

/** Mouth centre and size limits, in the 0–100 viewBox of `VisemeMouth`. */
const CX = 50;
const CY = 50;
const W_BASE = 17;
const W_SPREAD = 13;
const W_ROUND = 7.5;
/**
 * Half-height at full jaw opening.
 *
 * `oval()` pushes its control points out by `upperBias`/`lowerBias`, so the
 * rendered height is ~2.75× this value while the rendered width is exactly 2×
 * `halfW`. This constant is therefore chosen against the *rendered* height, not
 * the nominal one: at 21 a fully-open /æ/ came out 18% taller than it was wide
 * and read as an upright slot rather than a dropped jaw.
 */
const H_JAW = 16;

/** Vermillion thickness. The lower lip is fuller than the upper — real ones are. */
const LIP_UPPER_T = 4.4;
const LIP_LOWER_T = 5.6;

/** Underside of the nose. Static: the nose does not move when the jaw does. */
const NOSE_Y = 24;
const NOSTRIL_DX = 5.4;

export interface MouthGeometry {
  /* --- the face frame. Static except `jaw`/`chinCrease`, which follow the jaw. */
  /** Nose underside — the wings sweeping down to the nostrils. */
  nose: string;
  nostrils: string;
  /** Groove from nose to upper lip. Fades out when a wide jaw closes the gap. */
  philtrum: string;
  /** Lower-face contour. Drops as the jaw opens; this is the whole point of it. */
  jaw: string;
  /** Soft crease between lower lip and chin. */
  chinCrease: string;

  /* ------------------------------------------------------------- the mouth */
  /** Upper vermillion, filled. Its inner edge *is* the aperture's upper edge. */
  upperLip: string;
  /** Lower vermillion, filled. */
  lowerLip: string;
  /** Aperture outline, stroked thin. Defines the opening; does not draw the lips. */
  lips: string;
  /** Second ring outside the lips, revealed by protrusion. */
  protrusion: string;
  /** Dark oral cavity — filled, so the shape reads as a mouth, not an eye. */
  cavity: string;
  upperTeeth: string;
  lowerTeeth: string;
  /** Tongue body inside the mouth. */
  tongue: string;
  /** Tongue tip pushed out between the teeth (/θ/, /ð/). Painted above the lips. */
  tongueTip: string;

  philtrumOpacity: number;
  /** Zero at a sealed pose — /p b m/ must show no opening at all. */
  cavityOpacity: number;
  upperTeethOpacity: number;
  lowerTeethOpacity: number;
  tongueOpacity: number;
  tongueTipOpacity: number;
  protrusionOpacity: number;
}

const n = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Closed lens/oval through the two mouth corners. */
function oval(halfW: number, halfH: number, upperBias = 1.35, lowerBias = 1.4): string {
  const l = n(CX - halfW);
  const r = n(CX + halfW);
  const cl = n(CX - halfW * 0.55);
  const cr = n(CX + halfW * 0.55);
  const up = n(CY - halfH * upperBias);
  const dn = n(CY + halfH * lowerBias);
  return `M ${l},${CY} C ${cl},${up} ${cr},${up} ${r},${CY} C ${cr},${dn} ${cl},${dn} ${l},${CY} Z`;
}

/** A tooth row: flat outer edge, gently curved biting edge. */
function teethRow(halfW: number, y: number, height: number, down: boolean): string {
  const x0 = n(CX - halfW * 0.7);
  const x1 = n(CX + halfW * 0.7);
  const edge = n(down ? y + height : y - height);
  const bow = n(down ? edge + 1.7 : edge - 1.7);
  return `M ${x0},${n(y)} L ${x1},${n(y)} L ${x1},${edge} Q ${CX},${bow} ${x0},${edge} Z`;
}

/**
 * Build the SVG paths for a pose.
 *
 * Every path is emitted at every pose — only opacity varies — so the renderer
 * can morph attribute-by-attribute without elements appearing and disappearing
 * mid-transition.
 *
 * Two things here are answers to the diagram reading as a floating blob rather
 * than a face:
 *
 *   - **The lips are filled bodies, not a stroked ring.** A 4-unit stroke on a
 *     resting aperture 8.4 units tall consumed 4.4 of it, so a closed mouth
 *     rendered as a solid lozenge. Two crescents that meet at the aperture
 *     cannot degenerate that way: as the opening closes they simply touch.
 *   - **The aperture has no floor height.** It is `jaw × H_JAW`, so /p b m/ seal
 *     completely. A mouth that keeps a minimum gap can never show a stop.
 */
export function mouthGeometry(p: PoseVector): MouthGeometry {
  const halfW = Math.max(8, W_BASE + p.spread * W_SPREAD - p.round * W_ROUND);
  const halfH = p.jaw * H_JAW;

  const apertureUp = CY - halfH * 1.35;
  const apertureDn = CY + halfH * 1.4;

  const l = n(CX - halfW);
  const r = n(CX + halfW);
  const cl = n(CX - halfW * 0.55);
  const cr = n(CX + halfW * 0.55);

  // Upper lip: outer border with a cupid's bow, then back along the aperture.
  const upOuter = apertureUp - LIP_UPPER_T;
  const upNotch = apertureUp - LIP_UPPER_T * 0.42;
  const bx = halfW * 0.24;
  const upperLip =
    `M ${l},${CY} ` +
    `C ${cl},${n(upOuter)} ${n(CX - bx)},${n(upOuter)} ${CX},${n(upNotch)} ` +
    `C ${n(CX + bx)},${n(upOuter)} ${cr},${n(upOuter)} ${r},${CY} ` +
    `C ${cr},${n(apertureUp)} ${cl},${n(apertureUp)} ${l},${CY} Z`;

  // Lower lip: along the aperture, then out to a fuller border.
  const dnOuter = apertureDn + LIP_LOWER_T;
  const lowerLip =
    `M ${l},${CY} C ${cl},${n(apertureDn)} ${cr},${n(apertureDn)} ${r},${CY} ` +
    `C ${cr},${n(dnOuter)} ${cl},${n(dnOuter)} ${l},${CY} Z`;

  const lips = oval(halfW, halfH);
  // The cavity is inset from the lip line by the lip thickness.
  const inset = Math.min(halfH * 0.55, 3.4);
  const cavity = oval(Math.max(3, halfW - 3.2), Math.max(0.35, halfH - inset));

  const upperY = CY - halfH * 0.72;
  const lowerY = CY + halfH * 0.78;
  const upperH = 2.2 + p.teeth * 4.6;
  const lowerH = 1.8 + p.lowerTeeth * 3.6;

  // Tongue rides higher as `tongue` grows, approaching the palate.
  const tw = halfW * 0.6;
  const ty = CY + halfH * 0.45 - p.tongue * halfH * 0.85;
  const th = 3.4 + p.tongue * 4.4;
  const tongue =
    `M ${n(CX - tw)},${n(ty + th)} C ${n(CX - tw)},${n(ty - th)} ` +
    `${n(CX + tw)},${n(ty - th)} ${n(CX + tw)},${n(ty + th)} Z`;

  // The /θ ð/ signature: a tip crossing the lower lip, so it is unmistakably
  // *between* the lips rather than behind the teeth. Measured from the aperture
  // edge, so it pokes out by the same amount however far the jaw is open.
  const ptw = halfW * 0.4;
  const tipTop = CY - halfH * 0.45;
  const tipBottom = apertureDn + p.tongueOut * 4;
  const tongueTip =
    `M ${n(CX - ptw)},${n(tipTop)} C ${n(CX - ptw)},${n(tipBottom)} ` +
    `${n(CX + ptw)},${n(tipBottom)} ${n(CX + ptw)},${n(tipTop)} Z`;

  /* ------------------------------------------------------------ face frame */

  const nose =
    `M ${CX - 8.4},${NOSE_Y - 7.5} C ${CX - 6.8},${NOSE_Y - 2.6} ${CX - 7.2},${NOSE_Y} ` +
    `${CX - NOSTRIL_DX},${NOSE_Y} C ${CX - 2.3},${NOSE_Y + 1.7} ${CX + 2.3},${NOSE_Y + 1.7} ` +
    `${CX + NOSTRIL_DX},${NOSE_Y} C ${CX + 7.2},${NOSE_Y} ${CX + 6.8},${NOSE_Y - 2.6} ` +
    `${CX + 8.4},${NOSE_Y - 7.5}`;

  const nostrilY = NOSE_Y - 0.4;
  const nostrils =
    `M ${CX - NOSTRIL_DX - 1.5},${nostrilY} Q ${CX - NOSTRIL_DX},${nostrilY + 2.1} ` +
    `${CX - NOSTRIL_DX + 1.5},${nostrilY} ` +
    `M ${CX + NOSTRIL_DX - 1.5},${nostrilY} Q ${CX + NOSTRIL_DX},${nostrilY + 2.1} ` +
    `${CX + NOSTRIL_DX + 1.5},${nostrilY}`;

  // The philtrum runs nose-to-lip. A wide-open jaw pulls the upper lip up to
  // meet the nose, leaving no groove to draw — so it fades rather than clipping.
  const philtrumTop = NOSE_Y + 1.6;
  const philtrumGap = upOuter - philtrumTop;
  const philtrum = `M ${CX},${n(philtrumTop)} L ${CX},${n(Math.max(philtrumTop + 0.4, upOuter))}`;

  // The chin drops with the jaw. In a front view this is the clearest signal
  // that the *face* is opening and not just a shape on a card.
  const chinY = dnOuter + 7.5;
  const jaw =
    `M 13,33 C 15,${n(chinY - 13)} 27,${n(chinY + 2.5)} ${CX},${n(chinY)} ` +
    `C 73,${n(chinY + 2.5)} 85,${n(chinY - 13)} 87,33`;

  const creaseY = dnOuter + 2.8;
  const chinCrease = `M ${CX - 9.5},${n(creaseY)} Q ${CX},${n(creaseY + 3.1)} ${CX + 9.5},${n(creaseY)}`;

  // Visible only through an actual opening.
  const openness = clamp01(halfH / 2.2);

  return {
    nose,
    nostrils,
    philtrum,
    jaw,
    chinCrease,
    upperLip,
    lowerLip,
    lips,
    cavity,
    protrusion: oval(halfW + 3.4 * p.protrude, halfH + 2.2 * p.protrude),
    upperTeeth: teethRow(halfW, upperY, upperH, true),
    lowerTeeth: teethRow(halfW, lowerY, lowerH, false),
    tongue,
    tongueTip,
    philtrumOpacity: n(clamp01(philtrumGap / 3) * 0.75),
    cavityOpacity: n(openness * 0.92),
    upperTeethOpacity: n(p.teeth * Math.min(1, p.jaw * 3.2 + 0.25) * openness),
    lowerTeethOpacity: n(p.lowerTeeth * Math.min(1, p.jaw * 3.2 + 0.25) * openness),
    tongueOpacity: n(p.tongue * Math.min(1, p.jaw * 2.6) * (1 - p.tongueOut)),
    tongueTipOpacity: n(p.tongueOut),
    protrusionOpacity: n(p.protrude * 0.55),
  };
}
