/**
 * Renders every mouth pose to a static HTML sheet for visual inspection.
 *
 * Not part of the app bundle — nothing imports it. Run it from `web/`:
 *   npx tsx scripts/preview-visemes.ts
 *
 * It imports the real geometry module, so what you see here is exactly what
 * `VisemeMouth` paints — the component only binds these path strings to SVG
 * elements. Keep it: editing the pose vectors blind is how `H_JAW` ended up
 * rendering a fully-open /æ/ taller than it was wide, and this sheet is how
 * that was caught.
 */

import { writeFileSync, mkdirSync } from "node:fs";

import {
  POSES,
  POSE_HINTS,
  REST_HINT,
  REST_POSE,
  blendPose,
  mouthGeometry,
  type PoseId,
  type PoseVector,
} from "../src/lib/viseme-poses";

const OUT_DIR = "/tmp/viseme-preview";

const LABELS: Record<PoseId, string> = {
  0: "P B M", 1: "F V", 2: "D T N", 3: "K G NG", 4: "S Z",
  5: "AE EH AA", 6: "AH", 7: "IY IH EY Y", 8: "UW OW W UH", 9: "ER R",
  10: "TH DH", 11: "SH ZH CH JH", 12: "L", 13: "AO", 14: "HH",
};

function svg(p: PoseVector, size = 150): string {
  const g = mouthGeometry(p);
  // Paint order mirrors `VisemeMouth` exactly, including the tongue tip last.
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}">
  <path d="${g.jaw}" fill="none" stroke="#18A44B" stroke-width="1.5" stroke-linecap="round" opacity="0.42"/>
  <path d="${g.chinCrease}" fill="none" stroke="#18A44B" stroke-width="1.2" stroke-linecap="round" opacity="0.28"/>
  <path d="${g.nose}" fill="none" stroke="#18A44B" stroke-width="1.5" stroke-linecap="round" opacity="0.42"/>
  <path d="${g.nostrils}" fill="none" stroke="#18A44B" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
  <path d="${g.philtrum}" fill="none" stroke="#18A44B" stroke-width="1.1" stroke-linecap="round" opacity="${g.philtrumOpacity}"/>
  <path d="${g.protrusion}" fill="none" stroke="#18A44B" stroke-width="1.4" stroke-dasharray="4 3" opacity="${g.protrusionOpacity}"/>
  <path d="${g.cavity}" fill="#061A15" opacity="${g.cavityOpacity}"/>
  <path d="${g.upperTeeth}" fill="#FFFFFF" opacity="${g.upperTeethOpacity}"/>
  <path d="${g.lowerTeeth}" fill="#F4F8F5" opacity="${g.lowerTeethOpacity}"/>
  <path d="${g.tongue}" fill="#D9636A" opacity="${g.tongueOpacity}"/>
  <path d="${g.upperLip}" fill="#18A44B" fill-opacity="0.22" stroke="#087A35" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${g.lowerLip}" fill="#18A44B" fill-opacity="0.22" stroke="#087A35" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${g.lips}" fill="none" stroke="#087A35" stroke-width="1.2" stroke-linejoin="round" opacity="0.85"/>
  <path d="${g.tongueTip}" fill="#E07A80" stroke="#B94C55" stroke-width="0.8" opacity="${g.tongueTipOpacity}"/>
</svg>`;
}

const card = (title: string, sub: string, p: PoseVector) => `
<figure>
  ${svg(p)}
  <figcaption><b>${title}</b><span>${sub}</span></figcaption>
</figure>`;

const ids = Object.keys(POSES).map(Number).sort((a, b) => a - b) as PoseId[];

// A real transition, sampled. If any intermediate frame collapses or inverts,
// it shows up here rather than as a flicker at 60 Hz.
const from = POSES[0];
const to = POSES[8];
const morph = [0, 0.25, 0.5, 0.75, 1]
  .map((t) => card(`t=${t}`, "P → UW", blendPose(from, to, t)))
  .join("");

const html = `<!doctype html><meta charset="utf-8"><title>Viseme poses</title>
<style>
  body { font: 13px/1.4 ui-sans-serif, system-ui; background:#F7FAF8; color:#08201A; margin:24px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.15em; color:#4A5F57; margin:28px 0 10px; }
  .grid { display:flex; flex-wrap:wrap; gap:14px; }
  figure { margin:0; width:172px; background:#fff; border:1px solid #DDE8E1; border-radius:12px; padding:8px; text-align:center; }
  figcaption { display:flex; flex-direction:column; gap:2px; margin-top:4px; }
  figcaption b { font-size:12px; }
  figcaption span { font-size:10px; color:#7C9089; }
</style>
<h2>All poses</h2>
<div class="grid">
  ${card("rest", REST_HINT, REST_POSE)}
  ${ids.map((id) => card(`${id} · ${LABELS[id]}`, POSE_HINTS[id], POSES[id])).join("")}
</div>
<h2>Interpolation check</h2>
<div class="grid">${morph}</div>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/index.html`, html);
console.log(`wrote ${OUT_DIR}/index.html`);
