// Mock-ups of alternative art directions, three growth stages each, for
// choosing a style. Not used by the app.  Usage: npx tsx scripts/art-options.ts out.png
import { writeFileSync } from "node:fs";
import { H, W, composePet } from "../src/pet/sprite";
import { OUTLINE, Layer, compose, type Grid } from "./pixel";
import { Raster } from "./png";

function face(l: Layer, cx: number, y: number, gap: number, opts: { big?: boolean } = {}) {
  const lx = Math.round(cx - gap / 2 - 1);
  const rx = Math.round(cx + gap / 2);
  for (const x of [lx, rx]) {
    l.set(x, y, opts.big ? "#ffffff" : "#3a2626");
    l.set(x, y + 1, "#3a2626");
    if (opts.big) {
      l.set(x + 1, y, "#3a2626");
      l.set(x + 1, y + 1, "#3a2626");
    }
  }
  const w = opts.big ? 2 : 1;
  l.set(lx - 1, y + 2, "#f59a9a");
  l.set(rx + w, y + 2, "#f59a9a");
  const mx = Math.round(cx - 1);
  l.set(mx - 1, y + 2, "#3a2626");
  l.set(mx + 2, y + 2, "#3a2626");
  l.set(mx, y + 3, "#3a2626");
  l.set(mx + 1, y + 3, "#3a2626");
}

function flower(l: Layer, cx: number, cy: number, petal = "#ffb3d1", center = "#ffd95e") {
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) l.set(cx + dx, cy + dy, petal);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) l.set(cx + dx, cy + dy, petal);
  l.set(cx, cy, center);
}

const CX = 19.5;

// ---- B: cactus buddy (the cactus is the character) -----------------------------------

function cactus(stage: number): Grid {
  const pot = new Layer();
  pot.taper(CX, 33, 34, 18, 18, (x, _y, l) => (x <= l + 1 ? "#fff8ea" : "#f3e6cf"));
  pot.taper(CX, 35, 42, 16, 12, (x, y, l, r) => (y === 38 || y === 39 ? "#7fb3c8" : x >= r - 1 ? "#d9c7a8" : x <= l ? "#fff8ea" : "#f3e6cf"));

  const [w, h] = [[9, 9], [10, 13], [11, 19]][stage];
  const body = new Layer();
  const top = 33 - h;
  const col = (x: number) => {
    const rel = x - (CX - w / 2);
    return rel < 1.5 ? "#a6dd8c" : Math.round(rel) % 3 === 0 ? "#5ea052" : "#7cc06a";
  };
  body.ellipse(CX - 0.5, top + w / 2, w / 2, w / 2, (x) => col(x));
  body.taper(CX, Math.round(top + w / 2), 33, w, w, (x) => col(x));
  if (stage >= 1) {
    // right arm
    body.rect(Math.round(CX + w / 2), 24, 3, 3, "#7cc06a");
    body.ellipse(CX + w / 2 + 3.5, 21, 2, 4, (x) => (x > CX + w / 2 + 4 ? "#5ea052" : "#7cc06a"));
  }
  if (stage >= 2) {
    // left arm
    body.rect(Math.round(CX - w / 2) - 3, 26, 3, 3, "#7cc06a");
    body.ellipse(CX - w / 2 - 3.5, 23.5, 2, 3.5, (x) => (x < CX - w / 2 - 4 ? "#a6dd8c" : "#7cc06a"));
  }
  const b = body.outlined();
  // spines
  for (const [x, y] of [[-3, 8], [2, 5], [-1, 13], [3, 15], [-3, 17]]) {
    if (y < h - 1) b.set(CX + x, 33 - y, "#fff5d6");
  }
  face(b, CX - 0.5, 33 - Math.min(h - 3, 7), 4);
  if (stage === 2) flower(b, Math.round(CX - 0.5), top - 1);
  return compose(b, pot.outlined());
}

// ---- C: leafy monstera in a white pot -------------------------------------------------

function monstera(stage: number): Grid {
  const pot = new Layer();
  pot.taper(CX, 32, 33, 20, 20, (x, _y, l) => (x <= l + 1 ? "#ffffff" : "#efe9de"));
  pot.taper(CX, 34, 42, 18, 14, (x, _y, l, r) => (x >= r - 1 ? "#d4cbbd" : x <= l ? "#ffffff" : "#efe9de"));
  const p = pot.outlined();
  face(p, CX - 0.5, 37, 6, { big: true });

  const leaves = new Layer();
  const stems = new Layer();
  const leaf = (cx: number, cy: number, rx: number, ry: number, notches: number) => {
    // stem down to the soil
    for (let y = Math.round(cy); y <= 31; y++) stems.set(Math.round(cx + (CX - cx) * ((y - cy) / (31 - cy))), y, "#4c8a46");
    leaves.ellipse(cx, cy, rx, ry, (x, y) => (Math.abs(x - cx) < 0.6 ? "#2d6b40" : x < cx && y < cy ? "#5fb06d" : "#3f8f55"));
    // monstera slits
    for (let n = 0; n < notches; n++) {
      const yy = Math.round(cy - ry / 2 + (n * ry) / Math.max(1, notches - 1));
      for (const side of [-1, 1]) {
        leaves.clear(Math.round(cx + side * rx), yy);
        leaves.clear(Math.round(cx + side * (rx - 1)), yy);
      }
    }
  };
  if (stage === 0) leaf(CX, 26, 3, 2.5, 0);
  if (stage === 1) {
    leaf(13, 22, 4.5, 3.5, 2);
    leaf(26, 19, 5, 4, 2);
    leaf(20, 26, 3, 2.5, 0);
  }
  if (stage === 2) {
    leaf(10, 20, 6, 4.5, 3);
    leaf(28, 15, 6.5, 5, 3);
    leaf(18, 10, 5.5, 4.5, 3);
    leaf(24, 25, 4.5, 3.5, 2);
    leaf(13, 28, 3.5, 2.5, 0);
  }
  const plant = compose(stems, leaves.outlined());
  const out: Grid = compose(Object.assign(new Layer(), { px: plant }), p);
  if (stage === 2) {
    // tiny butterfly
    const bf = new Layer();
    for (const [x, y, c] of [[33, 5, "#ffd95e"], [35, 5, "#ffd95e"], [34, 6, OUTLINE], [33, 6, "#f4a64a"], [35, 6, "#f4a64a"]] as const) bf.set(x, y, c);
    bf.px.forEach((c, i) => c && (out[i] = c));
  }
  return out;
}

// ---- D: sprout creature (a little leafy spirit sitting in its pot) ------------------------

function creature(stage: number): Grid {
  const pot = new Layer();
  pot.taper(CX, 34, 35, 20, 20, (x, _y, l) => (x <= l + 1 ? "#b6e3da" : "#8fd0c2"));
  pot.taper(CX, 36, 42, 18, 14, (x, _y, l, r) => (x >= r - 1 ? "#6bb0a3" : x <= l ? "#b6e3da" : "#8fd0c2"));

  const [rx, ry] = [[5, 4], [7, 6], [8, 7]][stage];
  const bodyCy = 34 - ry + 2;
  const body = new Layer();
  body.ellipse(CX - 0.5, bodyCy, rx, ry, (x, y) => (y > bodyCy + ry * 0.4 ? "#79b85f" : x < CX - rx * 0.4 && y < bodyCy ? "#c3eba6" : "#9fd67f"));
  // little arms
  if (stage >= 1) {
    body.set(CX - rx - 1.5, bodyCy + 1, "#9fd67f");
    body.set(CX + rx + 0.5, bodyCy + 1, "#9fd67f");
  }
  // sprout on its head
  const headTop = Math.round(bodyCy - ry);
  const stemH = [2, 3, 4][stage];
  for (let i = 1; i <= stemH; i++) body.set(CX - 0.5, headTop - i, "#5ea052");
  const lt = headTop - stemH;
  const leafW = [2, 3, 4][stage];
  for (let i = 1; i <= leafW; i++) {
    body.set(CX - 0.5 - i, lt - Math.floor(i / 2), "#7cc06a");
    body.set(CX - 0.5 + i, lt - Math.floor(i / 2), "#7cc06a");
    if (i < leafW) {
      body.set(CX - 0.5 - i, lt - Math.floor(i / 2) + 1, "#5ea052");
      body.set(CX - 0.5 + i, lt - Math.floor(i / 2) + 1, "#5ea052");
    }
  }
  const b = body.outlined();
  face(b, CX - 0.5, Math.round(bodyCy - (stage === 0 ? 3 : 1)), stage === 0 ? 4 : 6, { big: stage > 0 });
  if (stage === 2) {
    flower(b, Math.round(CX - 6), Math.round(bodyCy - ry + 2), "#ffe08a", "#f4a64a");
    flower(b, Math.round(CX + 5), Math.round(bodyCy - ry + 1), "#ffb3d1", "#ffd95e");
  }
  return compose(b, pot.outlined());
}

// ---- sheet ----------------------------------------------------------------------------------

const current = (stage: number) =>
  composePet({ count: [3, 10, 30][stage], mood: "idle", offline: false, hasMessage: false }, { t: 0, blink: false });

const rows = [current, cactus, monstera, creature];
const SCALE = 5;
const GAP = 12;
const out = process.argv[2] ?? "art-options.png";
const sheet = new Raster(3 * (W * SCALE + GAP) + GAP, rows.length * (H * SCALE + GAP) + GAP, "#f3ead9");
rows.forEach((fn, r) =>
  [0, 1, 2].forEach((stage) => {
    const ox = GAP + stage * (W * SCALE + GAP);
    const oy = GAP + r * (H * SCALE + GAP);
    sheet.rect(ox, oy, W * SCALE, H * SCALE, "#fbf6ee");
    fn(stage).forEach((c, i) => c && sheet.rect(ox + (i % W) * SCALE, oy + Math.floor(i / W) * SCALE, SCALE, SCALE, c));
  }),
);
writeFileSync(out, sheet.png());
console.log(`wrote ${out}`);
