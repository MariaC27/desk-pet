// Generates the menu-bar template icon and the 1024px app icon source.
// Usage: npm run icons   (then `tauri icon` turns icon-source.png into all sizes)
import { writeFileSync } from "node:fs";
import { H, W, composePet } from "../src/pet/sprite";
import { Raster } from "./png";

// Menu-bar icon: black silhouette (macOS tints template images for light/dark).
const TRAY = [
  "................",
  "...##......##...",
  "..####....####..",
  "..#####..#####..",
  "...####..####...",
  "....###..###....",
  "......####......",
  ".......##.......",
  ".......##.......",
  "..############..",
  "..############..",
  "...##########...",
  "...##########...",
  "....########....",
  "....########....",
  "................",
];
const TRAY_SCALE = 2;
const tray = new Raster(16 * TRAY_SCALE, 16 * TRAY_SCALE);
TRAY.forEach((row, y) =>
  [...row].forEach((ch, x) => {
    if (ch === "#") tray.rect(x * TRAY_SCALE, y * TRAY_SCALE, TRAY_SCALE, TRAY_SCALE, "#000000");
  }),
);
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
composePet({ count: 30, mood: "happy", offline: false, hasMessage: false }, { t: 0, blink: false }).forEach(
  (color, i) => {
    if (color) icon.rect(ox + (i % W) * SCALE, oy + Math.floor(i / W) * SCALE, SCALE, SCALE, color);
  },
);
writeFileSync("icon-source.png", icon.png());
console.log("wrote src-tauri/icons/tray.png and icon-source.png");
