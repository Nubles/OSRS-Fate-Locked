// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilmPainter } from './painter';

/**
 * A 2D context that holds real pixels but draws nothing but whole copies: a
 * source canvas's pixels when the sizes match, else its first pixel all over.
 * `filter` exists only when the browser has it (not in Safari).
 */
class FakeCtx {
  pixels: Uint8ClampedArray;
  reads = 0;
  filters: string[] = [];
  fillStyle = '';
  imageSmoothingQuality = 'low';
  constructor(readonly canvas: HTMLCanvasElement) {
    this.pixels = new Uint8ClampedArray(Math.max(1, canvas.width * canvas.height) * 4);
  }
  drawImage(src: HTMLCanvasElement) {
    this.filters.push((this as { filter?: string }).filter ?? '(none)');
    const from = ctxOf.get(src)?.pixels;
    if (!from) return;
    const n = this.canvas.width * this.canvas.height * 4;
    if (from.length === n) { this.pixels = from.slice(); return; }
    this.pixels = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i += 4) this.pixels.set(from.subarray(0, 4), i);
  }
  fillRect() { /* the fog tint: not under test */ }
  getImageData(_x: number, _y: number, width: number, height: number) {
    this.reads++;
    return { data: this.pixels.slice(), width, height } as unknown as ImageData;
  }
  putImageData(img: ImageData) { this.pixels = new Uint8ClampedArray(img.data); }
}
class FakeFilterCtx extends FakeCtx { filter = 'none'; }

const ctxOf = new WeakMap<HTMLCanvasElement, FakeCtx>();
const useContexts = (Ctx: typeof FakeCtx) => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let c = ctxOf.get(this);
    // A canvas resized after its context was made (the film canvas) gets fresh pixels.
    if (!c || c.pixels.length !== Math.max(1, this.width * this.height) * 4) { c = new Ctx(this); ctxOf.set(this, c); }
    return c as unknown as CanvasRenderingContext2D;
  } as never);
};
const picture = (w: number, h: number, rgba: number[]) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d') as unknown as FakeCtx;
  for (let i = 0; i < ctx.pixels.length; i += rgba.length) ctx.pixels.set(rgba.slice(0, ctx.pixels.length - i), i);
  return c;
};
const fonts = { regular: 'a', bold: 'b' };

afterEach(() => vi.restoreAllMocks());

describe('FilmPainter fog and grey skill icons', () => {
  it('without a canvas filter (Safari) the fog is dark grey and locked skill icons are grey', () => {
    useContexts(FakeCtx);
    const map = picture(4, 4, [60, 120, 40, 255]); // grass
    // A 2 x 1 icon: one red pixel, one transparent.
    const icon = picture(2, 1, [255, 0, 0, 255, 0, 0, 255, 0]);
    const painter = new FilmPainter(document.createElement('canvas'), map, 'wide', fonts, { skills: { Attack: icon } });
    const p = painter as unknown as { fog: HTMLCanvasElement; greySkills: Map<string, HTMLCanvasElement> };
    const fog = ctxOf.get(p.fog)!;
    expect(fog.reads).toBe(1);
    // grayscale(1) brightness(0.32) of (60,120,40): (0.2126*60 + 0.7152*120 + 0.0722*40) * 0.32 = 32.4
    expect([...fog.pixels.subarray(0, 4)]).toEqual([32, 32, 32, 255]);
    const grey = ctxOf.get(p.greySkills.get('Attack')!)!;
    // grayscale(1) brightness(0.5): red 255 -> 27; the transparent pixel stays transparent.
    expect([...grey.pixels]).toEqual([27, 27, 27, 255, 9, 9, 9, 0]);
    expect('filter' in fog).toBe(false);
  });

  it('where the canvas has a filter, it is used as before and no pixels are read', () => {
    useContexts(FakeFilterCtx);
    const map = picture(4, 4, [60, 120, 40, 255]);
    const icon = picture(2, 1, [255, 0, 0, 255, 0, 0, 255, 0]);
    const painter = new FilmPainter(document.createElement('canvas'), map, 'wide', fonts, { skills: { Attack: icon } });
    const p = painter as unknown as { fog: HTMLCanvasElement; greySkills: Map<string, HTMLCanvasElement> };
    const fog = ctxOf.get(p.fog)!;
    expect(fog.filters).toEqual(['grayscale(1) brightness(0.32)']);
    expect(fog.reads).toBe(0);
    const grey = ctxOf.get(p.greySkills.get('Attack')!)!;
    expect(grey.filters).toEqual(['grayscale(1) brightness(0.5)']);
    expect(grey.reads).toBe(0);
  });
});
