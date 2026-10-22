/**
 * The pixel work behind "Fate draws the map" (components/FateDrawsMap.tsx):
 * the fog and the dimmed frontier of the mockup (maps2.py), the drawn chunk
 * as an ink-on-parchment sketch like a map clue, and the dissolve that inks
 * it in and then colours it. Plain RGBA arrays, so vitest can pin them. Looks
 * only: Math.random here is visual jitter, never an outcome.
 */

/** Parchment and ink, from the clue scroll's palette. */
const PAPER: readonly [number, number, number] = [226, 205, 156];
const INK: readonly [number, number, number] = [58, 40, 22];
/** The fog's brown-black. */
const FOG: readonly [number, number, number] = [31, 26, 20];

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Land under fog: grey, a third as bright, washed toward brown-black. */
export const fogPixels = (src: Uint8ClampedArray): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const g = luma(src[i], src[i + 1], src[i + 2]) * 0.3;
    out[i] = g * 0.65 + FOG[0] * 0.35;
    out[i + 1] = g * 0.65 + FOG[1] * 0.35;
    out[i + 2] = g * 0.65 + FOG[2] * 0.35;
    out[i + 3] = 255;
  }
  return out;
};

/** The frontier: in colour, a little over half as bright. */
export const dimPixels = (src: Uint8ClampedArray, k = 0.55): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    out[i] = src[i] * k;
    out[i + 1] = src[i + 1] * k;
    out[i + 2] = src[i + 2] * k;
    out[i + 3] = 255;
  }
  return out;
};

/**
 * The map drawn in ink on parchment: the edges of the map (a Sobel filter on
 * its brightness) inked dark, its darker ground lightly shaded, on paper with
 * a little grain. The edge strength is scaled to the picture's own sharpest
 * edges, so a soft low-res map still sketches with clear lines. `grain`
 * returns 0..1 per pixel (Math.random is fine).
 */
export const sketchPixels = (src: Uint8ClampedArray, w: number, h: number, grain: () => number = () => 0.5): Uint8ClampedArray => {
  const lum = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) lum[p] = luma(src[p * 4], src[p * 4 + 1], src[p * 4 + 2]) / 255;
  const at = (x: number, y: number) => lum[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const edge = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      edge[y * w + x] = Math.hypot(gx, gy);
    }
  }
  // The 92nd percentile edge inks at full strength.
  const sorted = Float32Array.from(edge).sort();
  const strong = Math.max(0.08, sorted[Math.floor(sorted.length * 0.92)] ?? 0.08);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const ink = Math.min(1, (edge[p] / strong) ** 1.3 * 0.85);
    const shade = Math.max(0, 0.55 - lum[p]) * 0.6;
    const a = Math.min(1, Math.max(ink, shade));
    const paper = 1 + (grain() - 0.5) * 0.06;
    for (let c = 0; c < 3; c++) out[p * 4 + c] = (PAPER[c] * paper) * (1 - a) + INK[c] * a;
    out[p * 4 + 3] = 255;
  }
  return out;
};

/**
 * When each pixel of a w x h cell gives way in a dissolve, 0..1: blotchy
 * (a coarse random grid, smoothly interpolated) and spreading from the middle
 * out, like ink soaking into paper.
 */
export const inkNoise = (w: number, h: number, rand: () => number = Math.random): Float32Array => {
  const G = 6;
  const grid = Array.from({ length: (G + 1) * (G + 1) }, () => rand());
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = (x / Math.max(1, w - 1)) * G, gy = (y / Math.max(1, h - 1)) * G;
      const ix = Math.min(G - 1, Math.floor(gx)), iy = Math.min(G - 1, Math.floor(gy));
      const fx = gx - ix, fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const n = (grid[iy * (G + 1) + ix] * (1 - sx) + grid[iy * (G + 1) + ix + 1] * sx) * (1 - sy)
        + (grid[(iy + 1) * (G + 1) + ix] * (1 - sx) + grid[(iy + 1) * (G + 1) + ix + 1] * sx) * sy;
      const d = Math.hypot(x / w - 0.5, y / h - 0.5) / Math.SQRT1_2;
      out[y * w + x] = Math.min(1, Math.max(0, n * 0.55 + d * 0.45));
    }
  }
  return out;
};

/**
 * `from` giving way to `to` at `progress` (0..1), pixel by pixel in the order
 * `noise` sets, each with a soft edge. Writes into `out` and returns it.
 */
export const dissolvePixels = (
  from: Uint8ClampedArray, to: Uint8ClampedArray, noise: Float32Array, progress: number,
  out: Uint8ClampedArray = new Uint8ClampedArray(from.length),
): Uint8ClampedArray => {
  const soft = 0.12;
  const p = progress * (1 + soft);
  for (let i = 0; i < noise.length; i++) {
    const t = Math.min(1, Math.max(0, (p - noise[i]) / soft));
    const o = i * 4;
    out[o] = from[o] + (to[o] - from[o]) * t;
    out[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * t;
    out[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * t;
    out[o + 3] = 255;
  }
  return out;
};
