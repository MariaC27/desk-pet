// Mock-ups in the terracotta-pot style: different plants in the same pot
// (face on the pot), and emotion faces + effects.  Not used by the app.
// Usage: npx tsx scripts/art-terracotta.ts plants.png emotions.png
import { writeFileSync } from "node:fs";
import { H, W, composePet } from "../src/pet/sprite";
import { Layer, OUTLINE, compose, type Grid } from "./pixel";
import { Raster } from "./png";

const PAL: Record<string, string> = {
  o: OUTLINE, p: "#d9825b", P: "#b8623f", h: "#f2a67c", s: "#6b4a3a", S: "#8a6450",
  e: "#3a2626", w: "#ffffff", b: "#f59a9a", B: "#ef7b7b", F: "#ef7fae",
  g: "#6cb35a", G: "#3f7a3a", l: "#9bd977", k: "#e0484c", K: "#b8323a",
  y: "#ffd95e", Y: "#f4b63a", x: "#fff2a8", c: "#ffffff", C: "#d8d0c2", t: "#a8754f",
};

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
const SOIL = [".....SSssssss.....", "..sssssssssssssss."];

type Mood = "idle" | "love" | "proud" | "hug" | "luck" | "break" | "celebrate" | "thinking" | "angry";

/** Pot + face for a mood. Eyes sit at x=15-16 / 23-24, y=37-38. */
function potWithFace(mood: Mood): Layer {
  const l = new Layer();
  l.stamp(SOIL, 11, 29, PAL);
  l.stamp(POT, 10, 31, PAL);
  const E = (pts: [number, number][], c = "e") => pts.forEach(([x, y]) => l.set(x, y, PAL[c]));

  const openEyes = () => [15, 23].forEach((x) => E([[x, 37], [x + 1, 37], [x, 38], [x + 1, 38]]) || l.set(x, 37, PAL.w));
  const happyEyes = () => [15, 23].forEach((x) => E([[x - 1, 38], [x, 37], [x + 1, 37], [x + 2, 38]]));
  const smile = () => E([[18, 39], [21, 39], [19, 40], [20, 40]]);
  const openMouth = () => {
    E([[18, 39], [19, 39], [20, 39], [21, 39]]);
    E([[19, 40], [20, 40]], "F");
  };
  const blush = (big = false) => {
    E([[14, 39], [25, 39]], "b");
    if (big) E([[13, 39], [26, 39], [14, 40], [25, 40]], "b");
  };

  switch (mood) {
    case "idle":
      openEyes(), smile(), blush();
      break;
    case "love":
      happyEyes(), smile(), blush(true);
      break;
    case "proud":
      // sparkly star eyes
      [15, 23].forEach((x) => {
        E([[x, 36], [x - 1, 37], [x + 1, 37], [x, 38]], "Y");
        E([[x, 37]], "x");
        E([[x + 1, 38], [x + 2, 37]], "e");
      });
      openMouth(), blush();
      break;
    case "hug":
      happyEyes(), smile(), blush(true);
      break;
    case "luck":
      openEyes(), blush();
      E([[18, 39], [19, 40], [20, 40], [21, 40], [22, 39]]); // determined grin
      break;
    case "break":
      // relaxed, eyes gently closed
      [15, 23].forEach((x) => E([[x - 1, 37], [x, 38], [x + 1, 38], [x + 2, 37]]));
      E([[19, 40], [20, 40]]), blush();
      break;
    case "celebrate":
      happyEyes(), blush(true);
      E([[17, 39], [18, 39], [19, 39], [20, 39], [21, 39], [22, 39], [18, 40], [21, 40]]);
      E([[19, 40], [20, 40]], "F");
      break;
    case "thinking":
      // eyes glancing up
      [15, 23].forEach((x) => E([[x + 1, 36], [x + 1, 37]]) || l.set(x, 36, PAL.w));
      E([[19, 40], [20, 40]]), blush();
      break;
    case "angry":
      // slanted brows, small frown, a little flushed
      E([[14, 35], [15, 36], [16, 36]]);
      E([[25, 35], [24, 36], [23, 36]]);
      [15, 23].forEach((x) => E([[x, 37], [x + 1, 37], [x, 38], [x + 1, 38]]));
      E([[19, 39], [20, 39], [18, 40], [21, 40]]);
      E([[14, 39], [25, 39]], "B");
      break;
  }
  return l;
}

// ---- effects around the plant -----------------------------------------------------

const HEART = [".k.k.", "kkkkk", "kkkkk", ".kkk.", "..k.."];
const SMALL_HEART = ["k.k", "kkk", ".k."];
const SPARKLE = [".x.", "xcx", ".x."];
const STAR = ["..y..", ".yyy.", "yyyyy", ".yYy.", "y...y"];
const CLOVER = [".gg.gg.", "glggllg", "gggGggg", "..gGg..", "glggllg", ".gg.gg.", "...G...", "..G...."];
const CUP = ["cccccC.", "cccccCC", "cccccC.", ".cccC.."];
const STEAM = [".C.", "C..", ".C."];
const ANGER = ["k.k", ".k.", "k.k"]; // little anger mark
const PUFF = [".CC.", "CccC", ".CC."];
const CONFETTI: [number, number, string][] = [
  [4, 6, "k"], [9, 2, "y"], [31, 4, "g"], [35, 10, "F"], [3, 17, "y"], [36, 19, "k"], [7, 26, "F"], [33, 26, "y"],
  [14, 1, "F"], [26, 2, "k"], [1, 11, "g"], [38, 14, "y"],
];

function effects(mood: Mood): Grid {
  const l = new Layer(); // loose particles
  const obj = new Layer(); // solid props, outlined
  const at = (art: readonly string[], x: number, y: number) => l.stamp(art, x, y, PAL);
  switch (mood) {
    case "love":
      at(HEART, 30, 8), at(SMALL_HEART, 6, 14), at(SMALL_HEART, 33, 19);
      break;
    case "proud":
      at(STAR, 31, 4), at(SPARKLE, 5, 9), at(SPARKLE, 34, 15), at(SPARKLE, 7, 22);
      break;
    case "hug":
      // leaves wrapping around the pot like arms
      for (const [x, y] of [[9, 35], [8, 36], [8, 37], [9, 38], [10, 39], [11, 39]]) l.set(x, y, PAL.g);
      for (const [x, y] of [[30, 35], [31, 36], [31, 37], [30, 38], [29, 39], [28, 39]]) l.set(x, y, PAL.g);
      at(SMALL_HEART, 32, 24);
      break;
    case "luck":
      obj.stamp(CLOVER, 31, 21, PAL);
      at(SPARKLE, 34, 17);
      break;
    case "break":
      obj.stamp(CUP, 32, 38, PAL);
      at(STEAM, 33, 33), at(STEAM, 35, 32);
      break;
    case "celebrate":
      for (const [x, y, c] of CONFETTI) l.rect(x, y, 2, 1, PAL[c]);
      break;
    case "thinking":
      obj.ellipse(32, 9, 6, 4.5, PAL.c);
      obj.ellipse(27, 16, 1.2, 1.2, PAL.c);
      obj.set(25, 19, PAL.c);
      break;
    case "angry":
      at(ANGER, 30, 24), at(PUFF, 4, 26), at(PUFF, 33, 29);
      break;
  }
  const o = obj.outlined();
  if (mood === "thinking") o.stamp(SMALL_HEART, 31, 8, PAL);
  return compose(o, l);
}

// ---- plants ------------------------------------------------------------------------

const BASE = 28;
const STEM = 19;

/** Thin stem from the soil up to (x, top), with a little curve. */
function stem(l: Layer, x: number, top: number, color = PAL.g, curve = 0) {
  for (let y = BASE; y >= top; y--) {
    const t = (BASE - y) / Math.max(1, BASE - top);
    l.set(STEM + 0.5 + (x - STEM - 0.5) * t + curve * Math.sin(t * Math.PI), y, color);
  }
}

function leafPair(l: Layer, y: number, len: number, droop = 0) {
  for (let i = 1; i <= len; i++) {
    const dy = Math.round(-i / 2 + (droop * i * i) / (len * len));
    l.set(STEM - i, y + dy, PAL.g);
    l.set(STEM + 1 + i, y + dy, PAL.g);
    if (i < len) {
      l.set(STEM - i, y + dy - 1, PAL.l);
      l.set(STEM + 1 + i, y + dy - 1, PAL.l);
    }
  }
}

function tulip(stage: number): Grid {
  const l = new Layer();
  const TULIP = (c: string, C: string) => [`${c}.${c}.${c}`, `${c}${c}${c}${c}${c}`, `${c}${C}${c}${c}${c}`, `.${c}${c}${C}.`];
  const strap = (side: -1 | 1, len: number) => {
    for (let i = 0; i < len; i++) {
      const x = STEM + 0.5 + side * (1 + i * 0.45);
      l.set(x, BASE - i, PAL.g);
      l.set(x + side, BASE - i + 1, PAL.G);
    }
  };
  if (stage === 0) {
    strap(-1, 4), strap(1, 3);
  } else if (stage === 1) {
    strap(-1, 9), strap(1, 7);
    stem(l, 19, 16);
    l.stamp([".gg.", "gllg", ".gg."], 18, 13, PAL);
  } else {
    strap(-1, 11), strap(1, 10);
    stem(l, 13, 12, PAL.g, -1), stem(l, 20, 7), stem(l, 26, 14, PAL.g, 1);
    l.stamp(TULIP("k", "K"), 11, 8, PAL);
    l.stamp(TULIP("y", "Y"), 18, 3, PAL);
    l.stamp(TULIP("F", "k"), 24, 10, PAL);
  }
  return l.outlined().px;
}

function sunflower(stage: number): Grid {
  const l = new Layer();
  const heart = (x: number, y: number, side: -1 | 1, r: number) =>
    l.ellipse(x + side * r, y, r, r * 0.7, (xx) => (Math.abs(xx - x) < 1 ? PAL.G : PAL.g));
  if (stage === 0) {
    stem(l, 19, 25);
    heart(19, 25, -1, 2), heart(20, 25, 1, 2);
  } else if (stage === 1) {
    stem(l, 19, 13);
    l.set(20, 13, PAL.G);
    heart(19, 22, -1, 3), heart(20, 18, 1, 3);
    l.ellipse(19.5, 11.5, 2, 2, PAL.g);
  } else {
    stem(l, 19, 12);
    l.set(20, 12, PAL.G);
    heart(19, 24, -1, 4), heart(20, 19, 1, 4);
    l.ellipse(19.5, 7, 6.5, 6.5, (x, y) => ((x + y) % 2 ? PAL.y : PAL.Y));
    l.ellipse(19.5, 7, 3, 3, (x, y) => ((x * 3 + y) % 4 ? PAL.t : PAL.s));
  }
  return l.outlined().px;
}

function fern(stage: number): Grid {
  const l = new Layer();
  const frond = (angle: number, len: number) => {
    // arching frond with alternating leaflets
    for (let i = 0; i <= len; i++) {
      const t = i / len;
      const x = STEM + 0.5 + Math.sin(angle) * i;
      const y = BASE - Math.cos(angle) * i + t * t * len * 0.45;
      l.set(x, y, PAL.G);
      if (i > 1 && i < len) {
        l.set(x - Math.cos(angle) * 1.4, y - Math.sin(angle) * 0.6 - 1, i % 2 ? PAL.l : PAL.g);
        l.set(x + Math.cos(angle) * 1.4, y + Math.sin(angle) * 0.6 - 1, PAL.g);
      }
    }
  };
  if (stage === 0) {
    // fiddlehead
    stem(l, 19, 25, PAL.G);
    l.stamp([".gg", "g.g", ".gg"], 19, 22, PAL);
  } else if (stage === 1) {
    frond(-0.7, 9), frond(0.75, 9), frond(0.05, 11);
  } else {
    frond(-1.15, 13), frond(1.2, 13), frond(-0.55, 15), frond(0.6, 15), frond(-0.1, 17), frond(0.15, 12);
  }
  return l.outlined().px;
}

function cactus(stage: number): Grid {
  const l = new Layer();
  const [w, h] = [[6, 5], [8, 11], [9, 17]][stage];
  const top = 30 - h;
  const col = (x: number) => (x < STEM + 1 - w / 2 + 1.5 ? PAL.l : Math.round(x) % 3 === 0 ? PAL.G : PAL.g);
  l.ellipse(STEM + 0.5, top + w / 2, w / 2, w / 2, col);
  for (let y = Math.round(top + w / 2); y <= 30; y++)
    for (let x = Math.round(STEM + 0.5 - w / 2); x < Math.round(STEM + 0.5 + w / 2); x++) l.set(x, y, col(x));
  if (stage >= 1) {
    l.rect(STEM + 1 + w / 2, 21, 2, 2, PAL.g);
    l.ellipse(STEM + 3 + w / 2, 18, 1.6, 3.5, PAL.g);
  }
  if (stage === 2) {
    l.rect(STEM - w / 2 - 1, 23, 2, 2, PAL.g);
    l.ellipse(STEM - 1.5 - w / 2, 20.5, 1.6, 3, PAL.l);
  }
  const o = l.outlined();
  for (const [x, y] of [[-2, 4], [1, 7], [-1, 11], [2, 13]]) if (y < h) o.set(STEM + x, 30 - y, "#fff5d6");
  if (stage === 2) o.stamp([".F.", "FyF", ".F."], STEM - 1, top - 2, PAL);
  return o.px;
}

function daisies(stage: number): Grid {
  const l = new Layer();
  const DAISY = [".c.", "cyc", ".c."];
  const BIG_DAISY = [".cc.", "cyyc", "cyyc", ".cc."];
  if (stage === 0) {
    stem(l, 16, 25, PAL.g, -1), stem(l, 23, 26, PAL.g, 1);
    l.set(15, 24, PAL.l), l.set(24, 25, PAL.l);
  } else if (stage === 1) {
    for (const [x, top, c] of [[12, 19, -1], [17, 14, 0], [22, 16, 1], [27, 20, 1]] as const) {
      stem(l, x, top, PAL.g, c);
      l.stamp([".g.", "glg"], x - 1, top - 2, PAL);
    }
    leafPair(l, 25, 3);
  } else {
    for (const [x, top, c] of [[9, 17, -1], [14, 10, -1], [20, 6, 0], [25, 11, 1], [30, 16, 1]] as const) stem(l, x, top, PAL.g, c);
    leafPair(l, 25, 4), leafPair(l, 20, 3);
    l.stamp(DAISY, 8, 14, PAL), l.stamp(BIG_DAISY, 12, 7, PAL), l.stamp(BIG_DAISY, 18, 3, PAL);
    l.stamp(BIG_DAISY, 24, 8, PAL), l.stamp(DAISY, 29, 13, PAL);
  }
  return l.outlined().px;
}

// ---- sheets -------------------------------------------------------------------------

const current = (stage: number) =>
  composePet({ count: [3, 10, 30][stage], mood: "idle", offline: false, hasMessage: false }, { t: 0, blink: false });

const inPot = (plant: (s: number) => Grid) => (stage: number) =>
  compose(Object.assign(new Layer(), { px: plant(stage) }), potWithFace("idle"));

function sheet(cells: Grid[][], out: string, scale = 5, gap = 12) {
  const cols = Math.max(...cells.map((r) => r.length));
  const r = new Raster(cols * (W * scale + gap) + gap, cells.length * (H * scale + gap) + gap, "#f3ead9");
  cells.forEach((row, ry) =>
    row.forEach((g, cx) => {
      const ox = gap + cx * (W * scale + gap);
      const oy = gap + ry * (H * scale + gap);
      r.rect(ox, oy, W * scale, H * scale, "#fbf6ee");
      g.forEach((c, i) => c && r.rect(ox + (i % W) * scale, oy + Math.floor(i / W) * scale, scale, scale, c));
    }),
  );
  writeFileSync(out, r.png());
  console.log(`wrote ${out}`);
}

const plants = [current, inPot(tulip), inPot(sunflower), inPot(fern), inPot(cactus), inPot(daisies)];
sheet(plants.map((fn) => [0, 1, 2].map(fn)), process.argv[2] ?? "plants.png", 4, 10);

// emotions on the current mid-size plant
const midPlant = composePet({ count: 10, mood: "idle", offline: false, hasMessage: false }, { t: 0, blink: false });
const plantOnly = midPlant.map((c, i) => (Math.floor(i / W) < 29 ? c : null));
const moods: Mood[] = ["love", "proud", "hug", "luck", "break", "celebrate", "thinking", "angry"];
const emotionCells = moods.map((m) =>
  compose(Object.assign(new Layer(), { px: plantOnly }), potWithFace(m), Object.assign(new Layer(), { px: effects(m) })),
);
sheet([emotionCells.slice(0, 4), emotionCells.slice(4)], process.argv[3] ?? "emotions.png", 5, 12);
