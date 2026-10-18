import { describe, expect, it } from 'vitest';
import { dimPixels, dissolvePixels, fogPixels, inkNoise, sketchPixels } from './fateSketch';

/** A w x h RGBA picture from a function of (x, y). */
const picture = (w: number, h: number, f: (x: number, y: number) => [number, number, number]) => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = f(x, y);
    out.set([r, g, b, 255], (y * w + x) * 4);
  }
  return out;
};

describe('the fate map pixels', () => {
  it('fogs land grey and dark, toward brown-black', () => {
    const [r, g, b, a] = fogPixels(new Uint8ClampedArray([0, 200, 0, 255]));
    // Grey: the channels differ only by the brown wash, never by the land's own green.
    expect(Math.abs(r - g)).toBeLessThanOrEqual(3);
    expect(g).toBeLessThan(60);
    expect(r).toBeGreaterThanOrEqual(b);
    expect(a).toBe(255);
  });

  it('dims the frontier and keeps its colour', () => {
    expect([...dimPixels(new Uint8ClampedArray([200, 100, 50, 255]))]).toEqual([110, 55, 28, 255]);
  });

  it('inks the edges of the map dark on light parchment', () => {
    // A sharp light/dark edge down the middle of a 16 x 8 picture.
    const w = 16, h = 8;
    const out = sketchPixels(picture(w, h, x => (x < 8 ? [230, 230, 230] : [200, 200, 200])), w, h);
    const lum = (x: number, y: number) => out[(y * w + x) * 4];
    expect(lum(7, 4)).toBeLessThan(120); // the edge is inked
    expect(lum(2, 4)).toBeGreaterThan(200); // plain ground stays paper
    expect(out[(4 * w + 2) * 4]).toBeGreaterThan(out[(4 * w + 2) * 4 + 2]); // parchment is warm
  });

  it('spreads ink from the middle of the cell out', () => {
    const n = inkNoise(32, 32, () => 0.5);
    expect(n[16 * 32 + 16]).toBeLessThan(n[0]);
    for (const v of n) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('dissolves from one picture to the other over its progress', () => {
    const from = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]);
    const to = new Uint8ClampedArray([200, 200, 200, 255, 200, 200, 200, 255]);
    const noise = new Float32Array([0.1, 0.9]);
    expect([...dissolvePixels(from, to, noise, 0)]).toEqual([...from]);
    const mid = dissolvePixels(from, to, noise, 0.5);
    expect(mid[0]).toBe(200);
    expect(mid[4]).toBe(0);
    expect([...dissolvePixels(from, to, noise, 1)]).toEqual([...to]);
  });
});
