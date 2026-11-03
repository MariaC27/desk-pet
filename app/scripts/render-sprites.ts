// Renders a contact sheet of every stage and mood so the art can be reviewed
// without running the app.  Usage: npm run sprites [-- out.png]
import { writeFileSync } from "node:fs";
import { STAGES } from "../src/lib/growth";
import { H, W, composePet, type Mood, type PetView } from "../src/pet/sprite";
import { Raster } from "./png";

const SCALE = 4;
const GAP = 8;
const out = process.argv[2] ?? "sprites.png";

const rows: PetView[][] = [
  // every stage, idle
  STAGES.map((s) => ({ count: s.min, mood: "idle", offline: false, hasMessage: false })),
  // moods + overlays on a mid-size plant, plus extra blooms
  [
    ...(["idle", "happy", "resting", "celebrating"] as Mood[]).map((mood) => ({
      count: 10,
      mood,
      offline: false,
      hasMessage: false,
    })),
    { count: 10, mood: "idle", offline: true, hasMessage: false },
    { count: 10, mood: "idle", offline: false, hasMessage: true },
    { count: 40, mood: "idle", offline: false, hasMessage: false },
    { count: 50, mood: "happy", offline: false, hasMessage: true },
  ],
];

const cols = Math.max(...rows.map((r) => r.length));
const cell = (n: number) => n * SCALE + GAP;
const sheet = new Raster(cols * cell(W) + GAP, rows.length * cell(H) + GAP, "#f3ead9");

rows.forEach((row, ry) =>
  row.forEach((view, cx) => {
    const ox = GAP + cx * cell(W);
    const oy = GAP + ry * cell(H);
    sheet.rect(ox, oy, W * SCALE, H * SCALE, "#fbf6ee");
    composePet(view, { t: 0, blink: false }).forEach((color, i) => {
      if (color) sheet.rect(ox + (i % W) * SCALE, oy + Math.floor(i / W) * SCALE, SCALE, SCALE, color);
    });
  }),
);

writeFileSync(out, sheet.png());
console.log(`wrote ${out}`);
