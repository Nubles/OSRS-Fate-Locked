// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { drawGrey, greyCopy, greyPixels, hasCanvasFilter } from './canvasGrey';
import painterSource from './runFilm/painter.ts?raw';
import cardSource from '../components/ShareCardCanvas.ts?raw';

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);

/** A 2D context with no `filter` (Safari): pictures are uniform or copied pixel for pixel. */
class NoFilterCtx {
  pixels: Uint8ClampedArray;
  reads = 0;
  drawn: string[] = [];
  constructor(readonly canvas: { width: number; height: number }) {
    this.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }
  drawImage(src: { pixels?: Uint8ClampedArray }) {
    this.drawn.push(String((this as { filter?: string }).filter ?? '(no filter)'));
    if (src.pixels) this.pixels = src.pixels.slice();
  }
  getImageData(_x: number, _y: number, width: number, height: number) {
    this.reads++;
    return { data: this.pixels.slice(), width, height } as unknown as ImageData;
  }
  putImageData(img: ImageData) { this.pixels = new Uint8ClampedArray(img.data); }
}
class FilterCtx extends NoFilterCtx { filter = 'none'; }
class TaintedCtx extends NoFilterCtx {
  getImageData(): ImageData { throw new DOMException('The canvas has been tainted', 'SecurityError'); }
}

describe('greyPixels (CSS grayscale() then brightness())', () => {
  it('turns pure colours into their luminance grey, times the brightness', () => {
    const d = px(255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255);
    greyPixels(d, 1, 1);
    // 0.2126, 0.7152, 0.0722 of 255
    expect([...d]).toEqual([54, 54, 54, 255, 182, 182, 182, 255, 18, 18, 18, 255]);
    const e = px(255, 0, 0, 255, 0, 255, 0, 255);
    greyPixels(e, 1, 0.5);
    expect([...e]).toEqual([27, 27, 27, 255, 91, 91, 91, 255]);
  });

  it('keeps a mid grey grey and only darkens it', () => {
    const d = px(128, 128, 128, 255);
    greyPixels(d, 1, 0.32);
    expect([...d]).toEqual([41, 41, 41, 255]);
    const e = px(128, 128, 128, 200);
    greyPixels(e, 0.85, 1);
    expect([...e]).toEqual([128, 128, 128, 200]);
  });

  it('leaves alpha alone, so a transparent pixel stays transparent', () => {
    const d = px(10, 200, 30, 0, 255, 255, 255, 77);
    greyPixels(d, 1, 0.4);
    expect(d[3]).toBe(0);
    expect(d[7]).toBe(77);
    expect([d[4], d[5], d[6]]).toEqual([102, 102, 102]);
  });

  it('a partial grayscale keeps some colour, as the CSS matrix does', () => {
    const d = px(60, 120, 40, 255);
    greyPixels(d, 0.85, 0.32);
    // R = (0.2126 + 0.7874*0.15)*60 + (0.7152 - 0.7152*0.15)*120 + (0.0722 - 0.0722*0.15)*40, times 0.32
    const k = 0.15;
    const r = ((0.2126 + 0.7874 * k) * 60 + (0.7152 - 0.7152 * k) * 120 + (0.0722 - 0.0722 * k) * 40) * 0.32;
    const g = ((0.2126 - 0.2126 * k) * 60 + (0.7152 + 0.2848 * k) * 120 + (0.0722 - 0.0722 * k) * 40) * 0.32;
    const b = ((0.2126 - 0.2126 * k) * 60 + (0.7152 - 0.7152 * k) * 120 + (0.0722 + 0.9278 * k) * 40) * 0.32;
    expect([...d]).toEqual([Math.round(r), Math.round(g), Math.round(b), 255]);
    expect(d[1]).toBeGreaterThan(d[0]);
  });
});

describe('drawGrey picks the path by what the browser has', () => {
  const colour = { pixels: px(255, 0, 0, 255, 0, 0, 255, 0) };

  it('uses ctx.filter where the context has it, and never reads the pixels', () => {
    const ctx = new FilterCtx({ width: 2, height: 1 });
    expect(hasCanvasFilter(ctx)).toBe(true);
    drawGrey(ctx as unknown as CanvasRenderingContext2D, colour as unknown as CanvasImageSource, 1, 0.32);
    expect(ctx.drawn).toEqual(['grayscale(1) brightness(0.32)']);
    expect(ctx.filter).toBe('none');
    expect(ctx.reads).toBe(0);
  });

  it('works the grey out from the pixels where the context has no filter (Safari)', () => {
    const ctx = new NoFilterCtx({ width: 2, height: 1 });
    expect(hasCanvasFilter(ctx)).toBe(false);
    drawGrey(ctx as unknown as CanvasRenderingContext2D, colour as unknown as CanvasImageSource, 1, 0.5);
    expect(ctx.reads).toBe(1);
    expect([...ctx.pixels]).toEqual([27, 27, 27, 255, 9, 9, 9, 0]);
    // Nothing was assigned to a filter the context does not have.
    expect('filter' in ctx).toBe(false);
  });

  it('leaves the picture in colour when the canvas cannot be read', () => {
    const ctx = new TaintedCtx({ width: 2, height: 1 });
    expect(() => drawGrey(ctx as unknown as CanvasRenderingContext2D, colour as unknown as CanvasImageSource, 1, 0.5)).not.toThrow();
    expect([...ctx.pixels]).toEqual([...colour.pixels]);
  });

  it('a filter property set on a context without one would fool a later check, so ask first', () => {
    const ctx = new NoFilterCtx({ width: 1, height: 1 }) as NoFilterCtx & { filter?: string };
    expect(hasCanvasFilter(ctx)).toBe(false);
    ctx.filter = 'grayscale(1)';
    expect(hasCanvasFilter(ctx)).toBe(true);
  });
});

describe('greyCopy and the one-off browser probe', () => {
  it('greyCopy makes a grey copy at the picture\'s own size from its pixels', async () => {
    const made: NoFilterCtx[] = [];
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      const c = new NoFilterCtx(this); made.push(c); return c as unknown as CanvasRenderingContext2D;
    } as never);
    const src = { naturalWidth: 2, naturalHeight: 1, width: 2, height: 1, pixels: px(0, 255, 0, 255, 128, 128, 128, 10) };
    const out = greyCopy(src as unknown as HTMLImageElement, 1, 1)!;
    expect([out.width, out.height]).toEqual([2, 1]);
    expect([...made[0].pixels]).toEqual([182, 182, 182, 255, 128, 128, 128, 10]);
    spy.mockRestore();
  });

  it('browserHasCanvasFilter asks a fresh context once', async () => {
    vi.resetModules();
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => new NoFilterCtx({ width: 1, height: 1 })) as never);
    const mod = await import('./canvasGrey');
    expect(mod.browserHasCanvasFilter()).toBe(false);
    expect(mod.browserHasCanvasFilter()).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('the film and the share card never set a canvas filter without asking first', () => {
    const painter = painterSource;
    expect(painter).not.toMatch(/\.filter\s*=/);
    const card = cardSource.split('\n');
    const sets = card.map((l, i) => [l, i] as const).filter(([l]) => /ctx\.filter\s*=\s*'(?!none)/.test(l));
    expect(sets.length).toBe(2);
    for (const [line, i] of sets) {
      expect(`${card[i - 1]}\n${line}`).toMatch(/browserHasCanvasFilter\(\)/);
    }
  });
});
