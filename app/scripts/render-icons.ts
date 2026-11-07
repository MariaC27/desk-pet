// Generates the menu-bar template icon and the 1024px app icon source.
// Usage: npm run icons   (then `tauri icon` turns icon-source.png into all sizes)
import { writeFileSync } from "node:fs";
import { H, W, composePet } from "../src/pet/sprite";
import { Raster } from "./png";

// Menu-bar icon: a leafy stem in a pot, as a black silhouette (macOS tints
// template images for light/dark). Drawn from smooth shapes and antialiased.
type Pt = [number, number];
// A leaf is a lens (intersection of two circles) from base to tip.
function lens(base: Pt, tip: Pt, halfWidth: number) {
  const mx = (base[0] + tip[0]) / 2, my = (base[1] + tip[1]) / 2;
  const dx = tip[0] - base[0], dy = tip[1] - base[1];
  const half = Math.hypot(dx, dy) / 2;
  const nx = -dy / (2 * half), ny = dx / (2 * half);
  const R = (half * half + halfWidth * halfWidth) / (2 * halfWidth);
  const d = R - halfWidth;
  const c1: Pt = [mx + nx * d, my + ny * d], c2: Pt = [mx - nx * d, my - ny * d];
  return (x: number, y: number, grow = 0) =>
    Math.hypot(x - c1[0], y - c1[1]) < R + grow && Math.hypot(x - c2[0], y - c2[1]) < R + grow;
}
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number) {
  return (x: number, y: number, grow = 0) => {
    const ax = x0 - grow, ay = y0 - grow, bx = x1 + grow, by = y1 + grow, rr = r + grow;
    if (x < ax || x > bx || y < ay || y > by) return false;
    const cx = Math.min(Math.max(x, ax + rr), bx - rr), cy = Math.min(Math.max(y, ay + rr), by - rr);
    return Math.hypot(x - cx, y - cy) <= rr;
  };
}
function trapezoid(y0: number, y1: number, top: [number, number], bottom: [number, number], r: number) {
  return (x: number, y: number, grow = 0) => {
    if (y < y0 - grow || y > y1 + grow) return false;
    const t = Math.min(Math.max((y - y0) / (y1 - y0), 0), 1);
    let l = top[0] + (bottom[0] - top[0]) * t - grow, rt = top[1] + (bottom[1] - top[1]) * t + grow;
    // round the bottom corners
    if (y > y1 - r) {
      const k = r - Math.sqrt(Math.max(0, r * r - (y - (y1 - r)) ** 2));
      l += k; rt -= k;
    }
    return x >= l && x <= rt;
  };
}

const S = 32, GAP = 1;
type Shape = (x: number, y: number, grow?: number) => boolean;
const union =
  (...parts: Shape[]): Shape =>
  (x, y, grow) =>
    parts.some((p) => p(x, y, grow));
// Front to back. Each shape cuts a thin gap into the shapes behind it.
const shapes: Shape[] = [
  roundRect(5, 18, 27, 21, 1.5), // pot rim
  trapezoid(22, 31, [7, 25], [9.5, 22.5], 2.5), // pot body
  union(
    roundRect(15, 5, 17, 19, 1), // stem
    lens([15.5, 16], [6, 11.5], 2.7), // leaves, alternating up the stem
    lens([16.5, 12], [26, 7.5], 2.7),
    lens([15.5, 8], [7.5, 3.5], 2.4),
    lens([16, 7], [16, 0.5], 2.1), // single leaf at the tip
  ),
];
function covered(x: number, y: number) {
  for (const s of shapes) {
    if (s(x, y)) return true;
    if (s(x, y, GAP)) return false;
  }
  return false;
}
const SS = 5;
const alpha = new Float32Array(S * S);
for (let py = 0; py < S; py++)
  for (let px = 0; px < S; px++) {
    let n = 0;
    for (let sy = 0; sy < SS; sy++)
      for (let sx = 0; sx < SS; sx++) if (covered(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS)) n++;
    alpha[py * S + px] = n / (SS * SS);
  }

const tray = new Raster(S, S);
alpha.forEach((a, i) => a && tray.rect(i % S, Math.floor(i / S), 1, 1, "#000000", Math.round(a * 255)));
writeFileSync("src-tauri/icons/tray.png", tray.png());

// App icon: the flowering plant on a rounded cream tile.
const SIZE = 1024;
const TILE = 824;
const RADIUS = 185;
const icon = new Raster(SIZE, SIZE);
const o = (SIZE - TILE) / 2;
for (let y = 0; y < TILE; y++) {
  for (let x = 0; x < TILE; x++) {
    const cx = Math.min(Math.max(x, RADIUS), TILE - RADIUS);
    const cy = Math.min(Math.max(y, RADIUS), TILE - RADIUS);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2) icon.rect(o + x, o + y, 1, 1, "#fbf1dc");
  }
}
const SCALE = 15;
const ox = Math.round((SIZE - W * SCALE) / 2);
const oy = Math.round((SIZE - H * SCALE) / 2) + 10;
composePet(
  { plant: "blossom", stage: 7, extraBlooms: 0, ladybug: false, mood: "happy", emotion: null, offline: false, hasNote: false },
  { t: 0, blink: false },
).forEach(
  (color, i) => {
    if (color) icon.rect(ox + (i % W) * SCALE, oy + Math.floor(i / W) * SCALE, SCALE, SCALE, color);
  },
);
writeFileSync("icon-source.png", icon.png());
console.log("wrote src-tauri/icons/tray.png and icon-source.png");
