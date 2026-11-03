// Pixel-art composer for the plant. Pure: (pet view, animation frame) -> pixel grid.
// Art is written as character grids; each character maps to a palette color
// ("." is transparent). Coordinates are in sprite pixels on a W x H canvas.

import { LADYBUG_AT, extraBloomsFor, stageFor } from "../lib/growth";

export const W = 40;
export const H = 44;

export type Mood = "idle" | "happy" | "resting" | "celebrating";

export interface PetView {
  count: number; // contributions this week
  mood: Mood;
  offline: boolean;
  hasMessage: boolean;
}

export interface Frame {
  t: number; // ms, drives sway / sparkles / bobbing
  blink: boolean;
}

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
  e: "#3a2626", // eyes / mouth
  w: "#ffffff",
  b: "#f59a9a", // blush
  f: "#ffb3d1", // petals
  F: "#ef7fae", // petal shade
  y: "#ffd95e", // flower center
  u: "#f48fb1", // bud
  d: "#b48a5e", // seed
  D: "#7a5636", // seed shade
  c: "#eef2f7", // cloud
  C: "#a9b6c6", // cloud outline
  m: "#fff7e3", // envelope
  n: "#d8bd85", // envelope fold
  k: "#e0484c", // ladybug / heart
  x: "#fff2a8", // sparkle
  z: "#8fa3c4", // sleepy z
};

export type Grid = (string | null)[];

class Canvas {
  px: Grid = new Array(W * H).fill(null);

  set(x: number, y: number, ch: string) {
    if (x < 0 || y < 0 || x >= W || y >= H || ch === ".") return;
    this.px[y * W + x] = PALETTE[ch] ?? ch;
  }

  stamp(art: readonly string[], x: number, y: number, mirror = false) {
    art.forEach((row, dy) => {
      const r = mirror ? [...row].reverse().join("") : row;
      [...r].forEach((ch, dx) => this.set(x + dx, y + dy, ch));
    });
  }

  /** Copy another layer on top, shifting rows above `cutY` by `dx`. */
  composite(layer: Canvas, cutY: number, dx: number) {
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

// ---- art -------------------------------------------------------------------

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

// Left-facing leaves; the attach pixel is the right-most pixel of `attach` row.
const LEAVES = {
  s: { art: ["ll.", ".lG"], attach: 1 },
  m: { art: [".ll..", "lllgG", "..GG."], attach: 1 },
  l: { art: [".lll..", "llllg.", ".lgggG", "..GG.."], attach: 2 },
} as const;
type LeafSize = keyof typeof LEAVES;

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
export const ENVELOPE_POS = { x: 30, y: 33, w: 10, h: 6 };

// ---- plant layout per stage ---------------------------------------------------

const STEM_X = 19; // stem is 2px wide: x = 19 (light), 20 (dark)
const BASE_Y = 28; // bottom stem pixel, just above the soil mound

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

const LAYOUTS: StageLayout[] = [
  { height: 0, leaves: [] },
  { height: 3, leaves: pair(2, "s") },
  { height: 6, leaves: pair(5, "m") },
  { height: 9, leaves: [...pair(8, "m"), { k: 3, size: "s", side: "R" }] },
  {
    height: 12,
    leaves: [
      ...pair(11, "m"),
      { k: 6, size: "l", side: "L" },
      { k: 3, size: "m", side: "R" },
    ],
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

function drawPlant(count: number): { layer: Canvas; topY: number } {
  const layer = new Canvas();
  const stage = stageFor(count);
  const layout = LAYOUTS[stage];

  if (stage === 0) {
    layer.stamp(SEED, STEM_X - 2, BASE_Y - 2);
    return { layer, topY: BASE_Y };
  }

  const topY = BASE_Y - layout.height + 1;
  for (let y = topY; y <= BASE_Y; y++) {
    layer.set(STEM_X, y, "g");
    layer.set(STEM_X + 1, y, "G");
  }
  layout.leaves.forEach((leaf) => drawLeaf(layer, leaf));
  const branches = [...(layout.branches ?? []), ...EXTRA_BRANCHES.slice(0, extraBloomsFor(count))];
  branches.forEach((b) => drawBranch(layer, b));

  if (layout.top === "bud") layer.stamp(BUD, STEM_X - 1, topY - 3);
  if (layout.top === "flower") layer.stamp(FLOWER, STEM_X - 2, topY - 5);
  if (count >= LADYBUG_AT) layer.stamp(LADYBUG, STEM_X + 5, BASE_Y - 10);

  return { layer, topY };
}

// ---- face ----------------------------------------------------------------------

const EYE_L = 15;
const EYE_R = 23;
const EYE_Y = 37;

function drawFace(c: Canvas, mood: Mood, blink: boolean) {
  const eyesOpen = () => {
    for (const x of [EYE_L, EYE_R]) {
      c.set(x, EYE_Y, "w");
      c.set(x + 1, EYE_Y, "e");
      c.set(x, EYE_Y + 1, "e");
      c.set(x + 1, EYE_Y + 1, "e");
    }
  };
  const eyesClosed = () => {
    for (const x of [EYE_L, EYE_R]) {
      c.set(x, EYE_Y + 1, "e");
      c.set(x + 1, EYE_Y + 1, "e");
    }
  };
  const eyesHappy = () => {
    for (const x of [EYE_L, EYE_R]) {
      c.set(x - 1, EYE_Y + 1, "e");
      c.set(x, EYE_Y, "e");
      c.set(x + 1, EYE_Y, "e");
      c.set(x + 2, EYE_Y + 1, "e");
    }
  };

  if (mood === "happy" || mood === "celebrating") eyesHappy();
  else if (mood === "resting" || blink) eyesClosed();
  else eyesOpen();

  // blush
  c.set(EYE_L - 1, EYE_Y + 2, "b");
  c.set(EYE_R + 2, EYE_Y + 2, "b");

  // mouth
  if (mood === "happy" || mood === "celebrating") {
    for (let x = 18; x <= 21; x++) c.set(x, EYE_Y + 2, "e");
    c.set(19, EYE_Y + 3, "F");
    c.set(20, EYE_Y + 3, "F");
  } else if (mood === "resting") {
    c.set(19, EYE_Y + 3, "e");
    c.set(20, EYE_Y + 3, "e");
  } else {
    c.set(18, EYE_Y + 2, "e");
    c.set(21, EYE_Y + 2, "e");
    c.set(19, EYE_Y + 3, "e");
    c.set(20, EYE_Y + 3, "e");
  }
}

// ---- compose -------------------------------------------------------------------

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

/**
 * Which sprite pixels should catch the mouse: the plant, pot and overlays,
 * padded by 1px so sway/bobbing and grabbing a thin stem still work.
 * Transient effects (sparkles, zzz) are excluded. Returns a W*H string of 0/1.
 */
export function hitMask(view: PetView): string {
  const px = composePet({ ...view, mood: "idle" }, { t: 0, blink: false });
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

export function composePet(view: PetView, frame: Frame): Grid {
  const c = new Canvas();
  const { t } = frame;

  // plant behind the pot rim, with a gentle 1px sway on the upper half
  const { layer, topY } = drawPlant(view.count);
  const swayPhase = Math.floor(t / 1200) % 2;
  const tall = BASE_Y - topY >= 6;
  const cutY = Math.floor((topY + BASE_Y) / 2);
  c.composite(layer, cutY, tall && swayPhase ? 1 : 0);

  c.stamp(SOIL, POT_X + 1, POT_Y - 2);
  c.stamp(POT, POT_X, POT_Y);
  drawFace(c, view.mood, frame.blink);

  if (view.mood === "celebrating") {
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
  if (view.hasMessage) {
    const bob = Math.floor(t / 700) % 2;
    c.stamp(ENVELOPE, ENVELOPE_POS.x, ENVELOPE_POS.y - bob);
  }

  return c.px;
}
