// Tiny pixel-drawing helpers for the art mock-up scripts.
import { H, W } from "../src/pet/sprite";

export type Grid = (string | null)[];
export const OUTLINE = "#4a3432";

export class Layer {
  px: Grid = new Array(W * H).fill(null);
  set(x: number, y: number, c: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) this.px[y * W + x] = c;
  }
  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < W && y < H ? this.px[y * W + x] : null;
  }
  clear(x: number, y: number) {
    if (x >= 0 && y >= 0 && x < W && y < H) this.px[y * W + x] = null;
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string | ((x: number, y: number) => string)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, typeof c === "string" ? c : c(x, y));
  }
  /** Trapezoid pot body: rows from y0..y1, half-width interpolated. */
  taper(cx: number, y0: number, y1: number, w0: number, w1: number, c: (x: number, y: number, l: number, r: number) => string) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      const half = (w0 + (w1 - w0) * t) / 2;
      const l = Math.round(cx - half);
      const r = Math.round(cx + half) - 1;
      for (let x = l; x <= r; x++) this.set(x, y, c(x, y, l, r));
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  /** Character-grid art; "." is transparent. */
  stamp(art: readonly string[], x: number, y: number, pal: Record<string, string>) {
    art.forEach((row, dy) => [...row].forEach((ch, dx) => ch !== "." && this.set(x + dx, y + dy, pal[ch] ?? ch)));
  }
  /** 1px outline around everything drawn so far. */
  outlined(color = OUTLINE): Layer {
    const out = new Layer();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = this.get(x, y);
        if (c) out.set(x, y, c);
        else if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy))) out.set(x, y, color);
      }
    return out;
  }
}

export function compose(...layers: Layer[]): Grid {
  const g: Grid = new Array(W * H).fill(null);
  for (const l of layers) l.px.forEach((c, i) => c && (g[i] = c));
  return g;
}
