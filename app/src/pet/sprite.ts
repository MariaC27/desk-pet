// Pixel-art composer for the plant. Pure: (pet view, animation frame) -> pixel grid.
// Art is written as character grids; each character maps to a palette color
// ("." is transparent). Coordinates are in sprite pixels on a W x H canvas.

import type { Emotion } from "../lib/emotions";

export const W = 40;
export const H = 44;

/** The pet's own state; an emotion someone sent overrides the face. */
export type Mood = "idle" | "happy" | "resting" | "celebrating";

export type PlantStyle = "blossom" | "cactus" | "aloe";

export const PLANT_STYLES: { id: PlantStyle; label: string }[] = [
  { id: "blossom", label: "Blossom" },
  { id: "cactus", label: "Cactus" },
  { id: "aloe", label: "Aloe" },
];

export interface PetView {
  plant: PlantStyle;
  stage: number; // 0 (seed) .. 7 (full bloom)
  extraBlooms: number; // past full bloom, 0..4
  ladybug: boolean;
  mood: Mood;
  emotion: Emotion | null;
  offline: boolean;
  hasNote: boolean; // unread message with text -> envelope
}

export interface Frame {
  t: number; // ms, drives sway / sparkles / bobbing
  blink: boolean;
  /** ms since the current emotion arrived; effects are livelier at first. */
  emotionAge?: number;
}

/** How long an arriving emotion plays its full animation before settling. */
export const EMOTION_INTRO_MS = 6_000;

export const PALETTE: Record<string, string> = {
  o: "#4a3432", // outline
  p: "#d9825b", // pot
  P: "#b8623f", // pot shade
  h: "#f2a67c", // pot highlight
  s: "#6b4a3a", // soil
  S: "#8a6450", // soil highlight
  g: "#6cb35a", // stem / leaf
  G: "#3f7a3a", // dark green
  l: "#9bd977", // leaf highlight
  q: "#fff5d6", // cactus spines / aloe teeth
  e: "#3a2626", // eyes / mouth
  w: "#ffffff",
  b: "#f59a9a", // blush
  B: "#ef7b7b", // flushed (angry)
  f: "#ffb3d1", // petals
  F: "#ef7fae", // petal shade
  y: "#ffd95e", // flower center / gold
  Y: "#f4b63a", // gold shade
  O: "#f08a3c", // aloe flowers
  u: "#f48fb1", // bud
  d: "#b48a5e", // seed
  D: "#7a5636", // seed shade
  c: "#eef2f7", // cloud / cup / steam
  C: "#a9b6c6", // cloud outline / steam shade
  m: "#fff7e3", // envelope
  n: "#d8bd85", // envelope fold
  k: "#e0484c", // ladybug / heart / anger
  K: "#b8323a", // heart shade
  x: "#fff2a8", // sparkle
  z: "#8fa3c4", // sleepy z
};

export type Grid = (string | null)[];

class Canvas {
  px: Grid = new Array(W * H).fill(null);

  set(x: number, y: number, ch: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H || ch === ".") return;
    this.px[y * W + x] = PALETTE[ch] ?? ch;
  }

  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < W && y < H ? this.px[y * W + x] : null;
  }

  stamp(art: readonly string[], x: number, y: number, mirror = false) {
    art.forEach((row, dy) => {
      const r = mirror ? [...row].reverse().join("") : row;
      [...r].forEach((ch, dx) => this.set(x + dx, y + dy, ch));
    });
  }

  rect(x: number, y: number, w: number, h: number, ch: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, ch: (x: number, y: number) => string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, ch(x, y));
  }

  /** Add a 1px outline around everything drawn so far. */
  outline(ch = "o"): Canvas {
    const out = new Canvas();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = this.get(x, y);
        if (c) out.px[y * W + x] = c;
        else if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) out.set(x, y, ch);
      }
    return out;
  }

  /** Copy another layer on top, shifting rows above `cutY` by `dx`. */
  composite(layer: Canvas, cutY = 0, dx = 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = layer.px[y * W + x];
        if (!c) continue;
        const nx = y < cutY ? x + dx : x;
        if (nx >= 0 && nx < W) this.px[y * W + nx] = c;
      }
    }
  }
}

// ---- shared art --------------------------------------------------------------------

const POT = [
  "oooooooooooooooooooo",
  "ohhppppppppppppppPPo",
  "oPPPPPPPPPPPPPPPPPPo",
  "oooooooooooooooooooo",
  ".ohpppppppppppppPPo.",
  ".ohpppppppppppppPPo.",
  ".ohpppppppppppppPPo.",
  "..ohpppppppppppPPo..",
  "..ohpppppppppppPPo..",
  "..ohpppppppppppPPo..",
  "...ohpppppppppPPo...",
  "...ohpppppppppPPo...",
  "....oooooooooooo....",
];
const POT_X = 10;
const POT_Y = 31;

const SOIL = [
  ".....SSssssss.....",
  "..sssssssssssssss.",
];

const SEED = [".ddd.", "dddDD", ".dDD."];

const STEM_X = 19; // stem is 2px wide: x = 19 (light), 20 (dark)
const BASE_Y = 28; // bottom stem pixel, just above the soil mound
const CX = 19.5; // horizontal center of the pot

const BUD = [".uu.", "uFFu", ".GG."];
const FLOWER = ["..ff..", ".ffff.", "ffyyff", ".fFFf.", "..FF.."];
const SMALL_FLOWER = [".f.", "fyf", ".F."];
const LADYBUG = ["ok", "kk"];

const SPARKLE = [".x.", "xwx", ".x."];
const ZZZ = ["zzzz", "..z.", ".z..", "zzzz"];
const CLOUD = ["..CCC...", ".CcccCC.", "CcccccccC", "CcccccccC", ".CCCCCCC."];
const ENVELOPE = [
  "oooooooooo",
  "onmmmmmmno",
  "omnmmmmnmo",
  "ommnmkmnmo",
  "ommmkkmmmo",
  "oooooooooo",
];
// Centered on the plant, resting on the soil in front of the stem, so it never sits at the
// window edge where it can get cut off.
export const ENVELOPE_POS = { x: 15, y: 22, w: 10, h: 6 };

// ---- blossom: one stem with leaves, pink flowers at full bloom ---------------------------

// Left-facing leaves; the attach pixel is the right-most pixel of `attach` row.
const LEAVES = {
  s: { art: ["ll.", ".lG"], attach: 1 },
  m: { art: [".ll..", "lllgG", "..GG."], attach: 1 },
  l: { art: [".lll..", "llllg.", ".lgggG", "..GG.."], attach: 2 },
} as const;
type LeafSize = keyof typeof LEAVES;

interface Leaf {
  k: number; // rows above BASE_Y where the leaf attaches
  size: LeafSize;
  side: "L" | "R";
}
interface Branch {
  k: number;
  side: "L" | "R";
  tip: "bud" | "flower" | "small";
}
interface StageLayout {
  height: number;
  leaves: Leaf[];
  top?: "bud" | "flower";
  branches?: Branch[];
}

const pair = (k: number, size: LeafSize): Leaf[] => [
  { k, size, side: "L" },
  { k, size, side: "R" },
];

const BLOSSOM: StageLayout[] = [
  { height: 0, leaves: [] },
  { height: 3, leaves: pair(2, "s") },
  { height: 6, leaves: pair(5, "m") },
  { height: 9, leaves: [...pair(8, "m"), { k: 3, size: "s", side: "R" }] },
  {
    height: 12,
    leaves: [...pair(11, "m"), { k: 6, size: "l", side: "L" }, { k: 3, size: "m", side: "R" }],
  },
  {
    height: 14,
    top: "bud",
    leaves: [
      ...pair(12, "s"),
      { k: 9, size: "l", side: "L" },
      { k: 6, size: "l", side: "R" },
      { k: 2, size: "m", side: "L" },
    ],
  },
  {
    height: 16,
    top: "flower",
    leaves: [
      ...pair(13, "s"),
      { k: 9, size: "l", side: "R" },
      { k: 6, size: "l", side: "L" },
      { k: 2, size: "m", side: "R" },
    ],
    branches: [{ k: 11, side: "L", tip: "bud" }],
  },
  {
    height: 18,
    top: "flower",
    leaves: [
      ...pair(15, "s"),
      { k: 10, size: "l", side: "R" },
      { k: 7, size: "l", side: "L" },
      { k: 3, size: "m", side: "R" },
      { k: 1, size: "m", side: "L" },
    ],
    branches: [
      { k: 12, side: "L", tip: "flower" },
      { k: 13, side: "R", tip: "flower" },
    ],
  },
];

// Extra flowers past full bloom, added in this order.
const EXTRA_BRANCHES: Branch[] = [
  { k: 5, side: "L", tip: "small" },
  { k: 6, side: "R", tip: "small" },
  { k: 9, side: "L", tip: "small" },
  { k: 8, side: "R", tip: "small" },
];

function drawLeaf(c: Canvas, leaf: Leaf) {
  const { art, attach } = LEAVES[leaf.size];
  const y = BASE_Y - leaf.k - attach;
  const width = art[0].length;
  if (leaf.side === "L") c.stamp(art, STEM_X - width, y);
  else c.stamp(art, STEM_X + 2, y, true);
}

function drawBranch(c: Canvas, b: Branch) {
  const dir = b.side === "L" ? -1 : 1;
  const startX = b.side === "L" ? STEM_X - 1 : STEM_X + 2;
  const y0 = BASE_Y - b.k;
  // 3px diagonal twig going up and outward
  for (let i = 0; i < 3; i++) c.set(startX + dir * i, y0 - i, "G");
  const tipX = startX + dir * 3;
  const tipY = y0 - 3;
  if (b.tip === "bud") c.stamp(BUD, tipX - 1 - (dir < 0 ? 1 : 0), tipY - 2);
  else if (b.tip === "small") c.stamp(SMALL_FLOWER, tipX - 1, tipY - 2);
  else c.stamp(FLOWER, tipX - 3 + (dir > 0 ? 1 : 0), tipY - 4);
}

function drawBlossom(view: PetView): { layer: Canvas; topY: number } {
  const layer = new Canvas();
  const layout = BLOSSOM[view.stage];
  const topY = BASE_Y - layout.height + 1;
  for (let y = topY; y <= BASE_Y; y++) {
    layer.set(STEM_X, y, "g");
    layer.set(STEM_X + 1, y, "G");
  }
  layout.leaves.forEach((leaf) => drawLeaf(layer, leaf));
  const branches = [...(layout.branches ?? []), ...EXTRA_BRANCHES.slice(0, view.extraBlooms)];
  branches.forEach((b) => drawBranch(layer, b));

  if (layout.top === "bud") layer.stamp(BUD, STEM_X - 1, topY - 3);
  if (layout.top === "flower") layer.stamp(FLOWER, STEM_X - 2, topY - 5);
  if (view.ladybug) layer.stamp(LADYBUG, STEM_X + 5, BASE_Y - 10);
  return { layer, topY };
}

// ---- cactus: grows taller, gets arms, flowers on top -------------------------------------

interface CactusLayout {
  w: number;
  h: number;
  right?: 1 | 2; // arm size
  left?: 1 | 2;
  bud?: boolean;
  flowers?: number; // 1 = top, 3 = top + arm tips
}

const CACTUS: (CactusLayout | null)[] = [
  null,
  { w: 5, h: 4 },
  { w: 6, h: 7 },
  { w: 7, h: 10 },
  { w: 8, h: 13, right: 1 },
  { w: 8, h: 15, right: 2, bud: true },
  { w: 9, h: 17, right: 2, left: 1, flowers: 1 },
  { w: 9, h: 19, right: 2, left: 2, flowers: 3 },
];

function drawCactus(view: PetView): { layer: Canvas; topY: number } {
  const c = CACTUS[view.stage]!;
  const body = new Canvas();
  const bottom = 30; // hidden behind the soil/rim
  const top = bottom - c.h + 1;
  const left = Math.round(CX - c.w / 2);
  const color = (x: number) => (x === left ? "l" : (x - left) % 3 === 2 ? "G" : "g");

  body.ellipse(CX - 0.5, top + c.w / 2 - 0.5, c.w / 2, c.w / 2, color);
  for (let y = Math.round(top + c.w / 2); y <= bottom; y++) for (let x = left; x < left + c.w; x++) body.set(x, y, color(x));

  const armY = Math.round(bottom - c.h * 0.5);
  const arm = (side: -1 | 1, size: 1 | 2, y: number) => {
    // elbow out from the body, then up, with a rounded tip; the 3px gap
    // keeps background visible between arm and body once outlined
    const x0 = side > 0 ? left + c.w : left - 4;
    body.rect(x0, y, 4, 3, "g");
    const ax = side > 0 ? x0 + 3 : x0 - 2;
    const len = size === 1 ? 4 : 7;
    body.rect(ax, y - len + 1, 3, len, "g");
    body.set(side > 0 ? ax : ax + 2, y - len + 2, side > 0 ? "l" : "G");
    body.ellipse(ax + 1, y - len + 1, 1.5, 1, () => "g");
    return { x: ax + 1, y: y - len };
  };
  const tips: { x: number; y: number }[] = [];
  if (c.right) tips.push(arm(1, c.right, armY));
  if (c.left) tips.push(arm(-1, c.left, armY + 2));

  const layer = body.outline();
  // spines
  for (const [dx, dy] of [[1, 3], [c.w - 2, 6], [2, 9], [c.w - 3, 12], [1, 15], [c.w - 2, 17]])
    if (dy < c.h - 1) layer.set(left + dx, bottom - dy, "q");

  const flowerAt = (x: number, y: number) => layer.stamp(SMALL_FLOWER, x - 1, y - 2);
  if (c.bud) layer.stamp([".u.", "uFu"], Math.round(CX) - 2, top - 2);
  if (c.flowers) {
    layer.stamp(FLOWER, Math.round(CX) - 3, top - 4);
    if (c.flowers >= 3) tips.forEach((t) => flowerAt(t.x + 0.5, t.y));
  }
  // extra blooms on the body's sides
  [[left - 1, bottom - 6], [left + c.w, bottom - 9], [left - 1, bottom - 12], [left + c.w, bottom - 3]]
    .slice(0, view.extraBlooms)
    .forEach(([x, y]) => flowerAt(x, y));
  if (view.ladybug) layer.stamp(LADYBUG, left + 2, bottom - 8);
  return { layer, topY: top };
}

// ---- aloe: a rosette of spiky leaves, an orange flower spike at full bloom ----------------

const ALOE: { leaves: number[]; len: number; spike?: "bud" | "bloom" }[] = [
  { leaves: [], len: 0 },
  { leaves: [-0.45, 0.45], len: 3 },
  { leaves: [-0.7, 0.1, 0.8], len: 5 },
  { leaves: [-1.0, -0.3, 0.35, 1.05], len: 7 },
  { leaves: [-1.2, -0.6, 0, 0.6, 1.2], len: 9 },
  { leaves: [-1.3, -0.8, -0.3, 0.25, 0.8, 1.3], len: 10 },
  { leaves: [-1.35, -0.85, -0.35, 0.05, 0.4, 0.9, 1.35], len: 11, spike: "bud" },
  { leaves: [-1.4, -0.9, -0.4, 0.05, 0.45, 0.95, 1.4], len: 12, spike: "bloom" },
];

function drawAloe(view: PetView): { layer: Canvas; topY: number } {
  const a = ALOE[view.stage];
  const leaves = new Canvas();
  let topY = BASE_Y;

  const spike = (x: number, height: number, bloom: boolean) => {
    for (let i = 0; i < height; i++) leaves.set(x, BASE_Y - i, "G");
    const top = BASE_Y - height;
    if (bloom) {
      // hanging tubular flowers
      for (let i = 0; i < 6; i++) {
        leaves.set(x - 1, top + i, i % 2 ? "O" : "Y");
        leaves.set(x + 1, top + i + 1, i % 2 ? "Y" : "O");
      }
      leaves.set(x, top - 1, "O");
    } else {
      leaves.rect(x - 1, top - 2, 3, 3, "g");
      leaves.set(x, top - 3, "O");
    }
    topY = Math.min(topY, top - 3);
  };
  if (a.spike) spike(STEM_X + 1, a.spike === "bloom" ? 22 : 16, a.spike === "bloom");
  // extra blooms = more flower spikes
  [[STEM_X - 4, 17], [STEM_X + 5, 15], [STEM_X - 7, 13], [STEM_X + 8, 12]]
    .slice(0, view.extraBlooms)
    .forEach(([x, h]) => spike(x, h, true));

  for (const angle of a.leaves) {
    const outer = Math.abs(angle) > 0.9;
    const len = outer ? a.len - 2 : a.len;
    for (let i = 0; i <= len; i++) {
      const t = i / len;
      const x = CX + Math.sin(angle) * i;
      const y = BASE_Y + 1 - Math.cos(angle) * i + (outer ? t * t * len * 0.35 : 0);
      // plump succulent leaves: 3px at the base, tapering to a point
      leaves.set(x, y, t < 0.15 ? "G" : "g");
      if (t < 0.8) leaves.set(x - Math.sign(angle || 1), y, "l");
      if (t < 0.35) leaves.set(x + Math.sign(angle || 1), y, "G");
    }
    topY = Math.min(topY, Math.round(BASE_Y + 1 - Math.cos(angle) * len));
  }
  const layer = leaves.outline();
  // a few pale teeth along the leaves
  if (view.stage >= 3)
    for (const angle of a.leaves.filter((_, i) => i % 2 === 0)) {
      const i = Math.round(a.len * 0.6);
      layer.set(CX + Math.sin(angle) * i + Math.cos(angle) * 1.5, BASE_Y + 1 - Math.cos(angle) * i, "q");
    }
  if (view.ladybug) layer.stamp(LADYBUG, STEM_X - 6, BASE_Y - 4);
  return { layer, topY };
}

function drawPlant(view: PetView): { layer: Canvas; topY: number } {
  if (view.stage === 0) {
    const layer = new Canvas();
    layer.stamp(SEED, STEM_X - 2, BASE_Y - 2);
    return { layer, topY: BASE_Y };
  }
  if (view.plant === "cactus") return drawCactus(view);
  if (view.plant === "aloe") return drawAloe(view);
  return drawBlossom(view);
}

// ---- face (on the pot) ---------------------------------------------------------------------

const EYE_L = 15;
const EYE_R = 23;
const EYE_Y = 37;

function drawFace(c: Canvas, mood: Mood, emotion: Emotion | null, blink: boolean, t: number) {
  const dots = (pts: [number, number][], ch = "e") => pts.forEach(([x, y]) => c.set(x, y, ch));
  const bothEyes = (fn: (x: number) => [number, number][], ch = "e") => [EYE_L, EYE_R].forEach((x) => dots(fn(x), ch));

  const eyesOpen = () => {
    bothEyes((x) => [[x + 1, EYE_Y], [x, EYE_Y + 1], [x + 1, EYE_Y + 1]]);
    bothEyes((x) => [[x, EYE_Y]], "w");
  };
  const eyesClosed = () => bothEyes((x) => [[x, EYE_Y + 1], [x + 1, EYE_Y + 1]]);
  const eyesHappy = () => bothEyes((x) => [[x - 1, EYE_Y + 1], [x, EYE_Y], [x + 1, EYE_Y], [x + 2, EYE_Y + 1]]);
  const eyesRelaxed = () => bothEyes((x) => [[x - 1, EYE_Y], [x, EYE_Y + 1], [x + 1, EYE_Y + 1], [x + 2, EYE_Y]]);
  const blush = (big = false, ch = "b") => {
    dots([[EYE_L - 1, EYE_Y + 2], [EYE_R + 2, EYE_Y + 2]], ch);
    if (big) dots([[EYE_L - 2, EYE_Y + 2], [EYE_R + 3, EYE_Y + 2], [EYE_L - 1, EYE_Y + 3], [EYE_R + 2, EYE_Y + 3]], ch);
  };
  const smile = () => dots([[18, EYE_Y + 2], [21, EYE_Y + 2], [19, EYE_Y + 3], [20, EYE_Y + 3]]);
  const openMouth = () => {
    dots([[18, EYE_Y + 2], [19, EYE_Y + 2], [20, EYE_Y + 2], [21, EYE_Y + 2]]);
    dots([[19, EYE_Y + 3], [20, EYE_Y + 3]], "F");
  };
  const bigGrin = () => {
    dots([[17, EYE_Y + 2], [18, EYE_Y + 2], [19, EYE_Y + 2], [20, EYE_Y + 2], [21, EYE_Y + 2], [22, EYE_Y + 2], [18, EYE_Y + 3], [21, EYE_Y + 3]]);
    dots([[19, EYE_Y + 3], [20, EYE_Y + 3]], "F");
  };
  const smallMouth = () => dots([[19, EYE_Y + 3], [20, EYE_Y + 3]]);

  switch (emotion) {
    case "love":
      return eyesHappy(), smile(), blush(true);
    case "proud":
      bothEyes((x) => [[x, EYE_Y - 1], [x - 1, EYE_Y], [x + 1, EYE_Y], [x, EYE_Y + 1]], "Y");
      bothEyes((x) => [[x, EYE_Y]], "x");
      return openMouth(), blush();
    case "luck":
      if (blink) eyesClosed();
      else eyesOpen();
      dots([[18, EYE_Y + 2], [19, EYE_Y + 3], [20, EYE_Y + 3], [21, EYE_Y + 3], [22, EYE_Y + 2]]);
      return blush();
    case "break":
      return eyesRelaxed(), smallMouth(), blush();
    case "celebrate":
      return eyesHappy(), bigGrin(), blush(true);
    case "angry": {
      // brows slanting down toward the middle, squinted eyes, small frown.
      // The brows dip a pixel every so often, like a little huff.
      const huff = Math.floor(t / 900) % 3 === 0 ? 1 : 0;
      dots([[EYE_L - 1, EYE_Y - 2], [EYE_L, EYE_Y - 2], [EYE_L + 1, EYE_Y - 1 + huff], [EYE_L + 2, EYE_Y - 1 + huff]]);
      dots([[EYE_R + 2, EYE_Y - 2], [EYE_R + 1, EYE_Y - 2], [EYE_R, EYE_Y - 1 + huff], [EYE_R - 1, EYE_Y - 1 + huff]]);
      bothEyes((x) => [[x, EYE_Y + 1], [x + 1, EYE_Y + 1]]);
      dots([[18, EYE_Y + 3], [19, EYE_Y + 2], [20, EYE_Y + 2], [21, EYE_Y + 3]]);
      return blush(false, "B");
    }
  }

  if (mood === "happy" || mood === "celebrating") eyesHappy();
  else if (mood === "resting" || blink) eyesClosed();
  else eyesOpen();
  blush();
  if (mood === "happy" || mood === "celebrating") openMouth();
  else if (mood === "resting") smallMouth();
  else smile();
}

// ---- emotion effects around the plant ---------------------------------------------------

const HEART = [".k.k.", "kkkkk", "kkkkK", ".kkK.", "..K.."];
const SMALL_HEART = ["k.k", "kkK", ".K."];
const STAR = ["..y..", ".yyy.", "yyyyy", ".yYy.", "y...y"];
const CLOVER = [".gg.gg.", "glggllg", "gggGggg", "..gGg..", "glggllg", ".gg.gg.", "...G...", "..G...."];
const CUP = ["cccccC.", "cccccCC", "cccccC.", ".cccC.."];
const STEAM = [".c.", "c..", ".c."];
const ANGER = ["k.k", ".k.", "k.k"];
const PUFF = [".CC.", "CccC", ".CC."];
const CONFETTI_COLORS = ["k", "y", "g", "F", "z"];

function drawEmotion(c: Canvas, emotion: Emotion, t: number, age: number) {
  const intro = age < EMOTION_INTRO_MS;
  const outlined = (draw: (o: Canvas) => void) => {
    const o = new Canvas();
    draw(o);
    c.composite(o.outline());
  };

  switch (emotion) {
    case "love": {
      if (intro) {
        // hearts drifting up
        [[30, 0], [6, 700], [33, 1400]].forEach(([x, offset], i) => {
          const y = 26 - (((t + offset) / 90) % 24);
          c.stamp(i === 0 ? HEART : SMALL_HEART, x + Math.round(Math.sin((t + offset) / 400)), Math.round(y));
        });
      } else {
        c.stamp(SMALL_HEART, 32, 10 + (Math.floor(t / 900) % 2));
      }
      break;
    }
    case "proud":
      c.stamp(STAR, 31, 4 + (Math.floor(t / 700) % 2));
      if (intro || Math.floor(t / 1500) % 3 === 0) {
        const phase = Math.floor(t / 250) % 2;
        [[5, 9], [34, 15], [7, 22]].forEach(([x, y], i) => (i % 2 === phase || intro) && c.stamp(SPARKLE, x, y));
      }
      break;
    case "luck":
      outlined((o) => o.stamp(CLOVER, 31, 21 - (intro ? Math.floor(t / 300) % 2 : 0)));
      if (Math.floor(t / 400) % 3 !== 2) c.stamp(SPARKLE, 34, 16);
      break;
    case "break":
      outlined((o) => o.stamp(CUP, 32, 38));
      // steam curling up from the cup
      [0, 1].forEach((i) => {
        const rise = Math.floor((t / 500 + i * 2) % 4);
        c.stamp(STEAM, 33 + i * 2, 34 - rise);
      });
      break;
    case "celebrate":
      if (intro) {
        for (let i = 0; i < 14; i++) {
          const x = (i * 11 + 3) % 38;
          const y = Math.floor((i * 7 + t / 70) % 30);
          c.rect(x + Math.round(Math.sin((t + i * 300) / 300)), y, 2, 1, CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
        }
      } else {
        [[4, 10, "k"], [33, 6, "y"], [36, 18, "F"], [6, 20, "g"]].forEach(([x, y, ch]) => c.rect(x as number, y as number, 2, 1, ch as string));
      }
      break;
    case "angry":
      if (intro || Math.floor(t / 600) % 2 === 0) c.stamp(ANGER, 30, 24);
      if (intro) {
        const rise = Math.floor(t / 400) % 3;
        c.stamp(PUFF, 4, 26 - rise);
        c.stamp(PUFF, 33, 29 - ((rise + 1) % 3));
      }
      break;
  }
}

// ---- compose -------------------------------------------------------------------------------

const CELEBRATE_SPOTS = [
  [5, 10],
  [31, 7],
  [3, 22],
  [34, 18],
  [10, 3],
  [27, 1],
  [8, 16],
  [30, 25],
];

export function composePet(view: PetView, frame: Frame): Grid {
  const c = new Canvas();
  const { t } = frame;

  // plant behind the pot rim, with a gentle 1px sway on the upper half
  const { layer, topY } = drawPlant(view);
  const swayPhase = Math.floor(t / 1200) % 2;
  const tall = BASE_Y - topY >= 6 && view.plant === "blossom";
  const cutY = Math.floor((topY + BASE_Y) / 2);
  c.composite(layer, cutY, tall && swayPhase ? 1 : 0);

  c.stamp(SOIL, POT_X + 1, POT_Y - 2);
  c.stamp(POT, POT_X, POT_Y);
  // a stage-up celebration briefly wins over a sent emotion
  const emotion = view.mood === "celebrating" ? null : view.emotion;
  drawFace(c, view.mood, emotion, frame.blink, t);

  if (emotion) {
    drawEmotion(c, emotion, t, frame.emotionAge ?? Infinity);
  } else if (view.mood === "celebrating") {
    const phase = Math.floor(t / 220) % 2;
    CELEBRATE_SPOTS.forEach(([x, y], i) => {
      if (i % 2 === phase) c.stamp(SPARKLE, x, y);
    });
  } else if (view.mood === "happy") {
    if (Math.floor(t / 400) % 3 !== 2) c.stamp(SPARKLE, 26, Math.max(1, topY - 4));
  } else if (view.mood === "resting") {
    const bob = Math.floor(t / 900) % 3;
    c.stamp(ZZZ, 29, 22 - bob * 2);
  }

  if (view.offline) c.stamp(CLOUD, 0, 1);
  if (view.hasNote) {
    const bob = Math.floor(t / 700) % 2;
    c.stamp(ENVELOPE, ENVELOPE_POS.x, ENVELOPE_POS.y - bob);
  }

  return c.px;
}

/**
 * Which sprite pixels should catch the mouse: the plant, pot and overlays,
 * padded by 1px so sway/bobbing and grabbing a thin stem still work.
 * Transient effects (sparkles, zzz, emotions) are excluded. Returns a W*H string of 0/1.
 */
export function hitMask(view: PetView): string {
  const px = composePet({ ...view, mood: "idle", emotion: null }, { t: 0, blink: false });
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && px[y * W + x] !== null;
  let mask = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hit = false;
      for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) hit = solid(x + dx, y + dy);
      mask += hit ? "1" : "0";
    }
  }
  return mask;
}
