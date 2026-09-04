"use client";

/**
 * The mouth diagram, drawn inside a face.
 *
 * React re-renders this component only when the *target* pose changes — roughly
 * ten times per word. The easing between two poses runs on a self-contained
 * `requestAnimationFrame` loop that writes SVG attributes straight through refs,
 * so a 60 Hz transition costs zero React work. Driving sub-frame interpolation
 * through state would re-render the whole card sixty times a second to move two
 * bezier handles.
 *
 * Transitions are eased rather than snapped because real articulation is
 * continuous: the lips are already moving toward /uː/ while /k/ is still being
 * released. A hard cut between poses reads as a strobe and, worse, teaches that
 * speech is a sequence of held positions. ~70 ms is roughly the duration of a
 * natural co-articulatory glide.
 *
 * The nose and jaw contour are not decoration. A pair of lips alone gives the
 * viewer no scale and no frame, so a closed mouth reads as an abstract lozenge
 * and a jaw drop reads as "the shape got taller" rather than "the jaw came
 * down". The chin line moves with `jaw`, which is what makes an open vowel look
 * like an open *face*.
 */

import { useEffect, useMemo, useRef } from "react";

import {
  POSES,
  POSE_HINTS,
  REST_HINT,
  REST_POSE,
  blendPose,
  mouthGeometry,
  type MouthGeometry,
  type PoseId,
  type PoseVector,
} from "@/lib/viseme-poses";
import { cn } from "@/lib/utils";

const TRANSITION_MS = 70;

/** Smoothstep: zero velocity at both ends, so poses settle instead of arriving. */
const ease = (t: number) => t * t * (3 - 2 * t);

const vectorFor = (pose: PoseId | null): PoseVector =>
  pose === null ? REST_POSE : POSES[pose];

export const hintFor = (pose: PoseId | null): string =>
  pose === null ? REST_HINT : POSE_HINTS[pose];

/** Paths whose geometry changes with the pose. */
const SHAPES = [
  "philtrum",
  "jaw",
  "chinCrease",
  "protrusion",
  "cavity",
  "upperTeeth",
  "lowerTeeth",
  "tongue",
  "upperLip",
  "lowerLip",
  "lips",
  "tongueTip",
] as const;

/** Paths whose opacity also changes with the pose. */
const FADES = {
  philtrum: "philtrumOpacity",
  protrusion: "protrusionOpacity",
  cavity: "cavityOpacity",
  upperTeeth: "upperTeethOpacity",
  lowerTeeth: "lowerTeethOpacity",
  tongue: "tongueOpacity",
  tongueTip: "tongueTipOpacity",
} as const;

type ShapeKey = (typeof SHAPES)[number];

interface Props {
  /** `null` renders the rest pose — a mouth passively parted, not a held /p/. */
  pose: PoseId | null;
  /** Snap instead of easing. Mirrors `prefers-reduced-motion`. */
  snap?: boolean;
  /** Dim the whole diagram while audio is still loading. */
  dimmed?: boolean;
  size?: number;
  className?: string;
}

export function VisemeMouth({
  pose,
  snap = false,
  dimmed = false,
  size = 132,
  className,
}: Props) {
  const refs = useRef<Partial<Record<ShapeKey, SVGPathElement | null>>>({});

  /** The vector currently on screen — the origin of the next transition. */
  const currentRef = useRef<PoseVector>(REST_POSE);
  const fromRef = useRef<PoseVector>(REST_POSE);
  const toRef = useRef<PoseVector>(REST_POSE);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  /** Server render and first paint both show rest; the effect takes over after. */
  const initial = useMemo(() => mouthGeometry(REST_POSE), []);

  useEffect(() => {
    const apply = (g: MouthGeometry) => {
      for (const key of SHAPES) {
        refs.current[key]?.setAttribute("d", g[key]);
      }
      for (const [key, prop] of Object.entries(FADES) as [
        ShapeKey,
        keyof MouthGeometry,
      ][]) {
        refs.current[key]?.setAttribute("opacity", String(g[prop]));
      }
    };

    const target = vectorFor(pose);
    toRef.current = target;

    if (snap) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      currentRef.current = target;
      apply(mouthGeometry(target));
      return;
    }

    // Restart from wherever the mouth actually is, not from the previous
    // target — interrupting mid-glide must not teleport the lips backwards.
    fromRef.current = currentRef.current;
    startRef.current = performance.now();

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const t = Math.min(1, (performance.now() - startRef.current) / TRANSITION_MS);
      const v = blendPose(fromRef.current, toRef.current, ease(t));
      currentRef.current = v;
      apply(mouthGeometry(v));
      rafRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [pose, snap]);

  const bind = (key: ShapeKey) => (el: SVGPathElement | null) => {
    refs.current[key] = el;
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("select-none transition-opacity duration-200", className)}
      style={{ opacity: dimmed ? 0.45 : 1 }}
      role="img"
      aria-label={`Mouth position: ${hintFor(pose)}`}
    >
      {/* ---------------------------------------------------- the face frame */}
      {/* Lower-face contour. Follows the jaw, so an open vowel visibly drops
          the chin instead of merely enlarging a shape. */}
      <path
        ref={bind("jaw")}
        d={initial.jaw}
        fill="none"
        stroke="var(--tf-green)"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.42}
      />
      <path
        ref={bind("chinCrease")}
        d={initial.chinCrease}
        fill="none"
        stroke="var(--tf-green)"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.28}
      />
      {/* Nose and nostrils are pose-independent — no ref, never rewritten. */}
      <path
        d={initial.nose}
        fill="none"
        stroke="var(--tf-green)"
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.42}
      />
      <path
        d={initial.nostrils}
        fill="none"
        stroke="var(--tf-green)"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.5}
      />
      <path
        ref={bind("philtrum")}
        d={initial.philtrum}
        fill="none"
        stroke="var(--tf-green)"
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={initial.philtrumOpacity}
      />

      {/* -------------------------------------------------------- the mouth */}
      {/* Lip protrusion, drawn as a soft ring outside the lips. This is a front
          view, so forward movement has to be encoded as a halo. */}
      <path
        ref={bind("protrusion")}
        d={initial.protrusion}
        fill="none"
        stroke="var(--tf-green)"
        strokeWidth={1.4}
        strokeDasharray="4 3"
        opacity={initial.protrusionOpacity}
      />

      {/* Oral cavity. Fades to nothing at a sealed pose, so /p b m/ show no
          opening at all rather than a permanent dark slot. */}
      <path
        ref={bind("cavity")}
        d={initial.cavity}
        fill="var(--tf-deep)"
        opacity={initial.cavityOpacity}
      />

      <path
        ref={bind("upperTeeth")}
        d={initial.upperTeeth}
        fill="#FFFFFF"
        opacity={initial.upperTeethOpacity}
      />
      <path
        ref={bind("lowerTeeth")}
        d={initial.lowerTeeth}
        fill="#F4F8F5"
        opacity={initial.lowerTeethOpacity}
      />
      <path
        ref={bind("tongue")}
        d={initial.tongue}
        fill="#D9636A"
        opacity={initial.tongueOpacity}
      />

      {/* The lips themselves: two filled crescents meeting at the aperture.
          Painted after the cavity so they occlude everything outside the
          opening, and filled rather than stroked so a closed mouth cannot
          collapse into a solid lozenge the way a 4-unit ring did. */}
      <path
        ref={bind("upperLip")}
        d={initial.upperLip}
        fill="var(--tf-green)"
        fillOpacity={0.22}
        stroke="var(--tf-green-strong)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path
        ref={bind("lowerLip")}
        d={initial.lowerLip}
        fill="var(--tf-green)"
        fillOpacity={0.22}
        stroke="var(--tf-green-strong)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* Aperture edge, thin. Defines the opening; it does not draw the lips. */}
      <path
        ref={bind("lips")}
        d={initial.lips}
        fill="none"
        stroke="var(--tf-green-strong)"
        strokeWidth={1.2}
        strokeLinejoin="round"
        opacity={0.85}
      />

      {/* The /θ ð/ signature. Painted last — it is the one articulator that is
          genuinely in front of the lips, so it must not be occluded by them. */}
      <path
        ref={bind("tongueTip")}
        d={initial.tongueTip}
        fill="#E07A80"
        stroke="#B94C55"
        strokeWidth={0.8}
        opacity={initial.tongueTipOpacity}
      />
    </svg>
  );
}
