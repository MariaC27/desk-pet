// Renders a contact sheet of every plant style, stage, mood and emotion so the
// art can be reviewed without running the app.  Usage: npm run sprites [-- out.png]
import { writeFileSync } from "node:fs";
import { EMOTIONS } from "../src/lib/emotions";
import { MAX_STAGE } from "../src/lib/growth";
import { H, PLANT_STYLES, W, composePet, type Mood, type PetView } from "../src/pet/sprite";
import { Raster } from "./png";

const SCALE = 4;
const GAP = 8;
const out = process.argv[2] ?? "sprites.png";

const base: PetView = {
  plant: "blossom",
  stage: 4,
  extraBlooms: 0,
  ladybug: false,
  mood: "idle",
  emotion: null,
  offline: false,
  hasNote: false,
};

const rows: PetView[][] = [
  // every style at every stage, then past full bloom
  ...PLANT_STYLES.map(({ id }) => [
    ...Array.from({ length: MAX_STAGE + 1 }, (_, stage) => ({ ...base, plant: id, stage })),
    { ...base, plant: id, stage: MAX_STAGE, extraBlooms: 4, ladybug: true },
  ]),
  // the pet's own moods + overlays
  [
    ...(["idle", "happy", "resting", "celebrating"] as Mood[]).map((mood) => ({ ...base, mood })),
    { ...base, offline: true },
    { ...base, hasNote: true },
  ],
  // emotions someone can send
  EMOTIONS.map((e) => ({ ...base, emotion: e.id })),
];

const cols = Math.max(...rows.map((r) => r.length));
const cell = (n: number) => n * SCALE + GAP;
const sheet = new Raster(cols * cell(W) + GAP, rows.length * cell(H) + GAP, "#f3ead9");

rows.forEach((row, ry) =>
  row.forEach((view, cx) => {
    const ox = GAP + cx * cell(W);
    const oy = GAP + ry * cell(H);
    sheet.rect(ox, oy, W * SCALE, H * SCALE, "#fbf6ee");
    // t chosen so animated effects are mid-motion; emotionAge 0 = arrival animation
    composePet(view, { t: 1000, blink: false, emotionAge: 0 }).forEach((color, i) => {
      if (color) sheet.rect(ox + (i % W) * SCALE, oy + Math.floor(i / W) * SCALE, SCALE, SCALE, color);
    });
  }),
);

writeFileSync(out, sheet.png());
console.log(`wrote ${out}`);
