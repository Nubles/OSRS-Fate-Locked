/**
 * Grey pictures on a canvas in every browser.
 *
 * The Run Film and the share card grey out locked land and locked icons with
 * the canvas `filter` property. Safari's canvas has no `filter` (only behind a
 * developer setting), so there the same picture is worked out from the pixels
 * instead: the CSS maths for `grayscale(g) brightness(b)`, alpha left alone.
 * Where `filter` works, it is still used, so those browsers draw exactly what
 * they drew before.
 */

/** Luminance weights the CSS `grayscale()` filter uses. */
const LR = 0.2126, LG = 0.7152, LB = 0.0722;

/**
 * CSS `grayscale(grayscale) brightness(brightness)` applied in place to RGBA
 * pixels (as `getImageData` returns them). Alpha is untouched; colours clamp to
 * 0..255 the way a Uint8ClampedArray does.
 */
export function greyPixels(data: Uint8ClampedArray, grayscale: number, brightness: number): void {
  const k = 1 - Math.min(1, Math.max(0, grayscale));
  const b = Math.max(0, brightness);
  // The Filter Effects grayscale matrix, each row scaled by the brightness.
  const rr = (LR + (1 - LR) * k) * b, rg = (LG - LG * k) * b, rb = (LB - LB * k) * b;
  const gr = (LR - LR * k) * b, gg = (LG + (1 - LG) * k) * b, gb = rb;
  const br = gr, bg = rg, bb = (LB + (1 - LB) * k) * b;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i], g = data[i + 1], bl = data[i + 2];
    data[i] = rr * r + rg * g + rb * bl;
    data[i + 1] = gr * r + gg * g + gb * bl;
    data[i + 2] = br * r + bg * g + bb * bl;
  }
}

/**
 * True when this 2D context has a working `filter`. Ask a context nothing has
 * set `filter` on yet: setting it where it isn't supported only adds a plain
 * property that reads back, which would make this say yes.
 */
export const hasCanvasFilter = (ctx: object | null | undefined): boolean => !!ctx && 'filter' in ctx;

/** A fresh context's answer to {@link hasCanvasFilter}, asked once. */
let probed: boolean | undefined;
export const browserHasCanvasFilter = (): boolean => {
  if (probed === undefined) {
    try {
      probed = typeof document !== 'undefined' && hasCanvasFilter(document.createElement('canvas').getContext('2d'));
    } catch {
      probed = false;
    }
  }
  return probed;
};

type GreyTarget = Pick<CanvasRenderingContext2D, 'drawImage' | 'getImageData' | 'putImageData'> & {
  canvas: { width: number; height: number };
  filter?: string;
};

/**
 * Draws `source` at (0, 0) on `ctx` in grey: with `ctx.filter` where the
 * browser has it, else from the pixels. Meant for a fresh context that holds
 * only this picture. If the pixels can't be read, the picture stays in colour
 * (what those browsers showed before) rather than failing.
 */
export function drawGrey(
  ctx: GreyTarget,
  source: CanvasImageSource,
  grayscale: number,
  brightness: number,
  filterOk = hasCanvasFilter(ctx),
): void {
  if (filterOk) {
    ctx.filter = `grayscale(${grayscale}) brightness(${brightness})`;
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';
    return;
  }
  ctx.drawImage(source, 0, 0);
  const { width, height } = ctx.canvas;
  if (!width || !height) return;
  try {
    const px = ctx.getImageData(0, 0, width, height);
    greyPixels(px.data, grayscale, brightness);
    ctx.putImageData(px, 0, 0);
  } catch {
    // A canvas the page may not read (or no memory for it): leave it in colour.
  }
}

/**
 * A grey copy of a picture at its own size, worked out from the pixels. For
 * browsers without `filter`; `null` when no canvas can be made.
 */
export function greyCopy(
  source: HTMLImageElement | HTMLCanvasElement,
  grayscale: number,
  brightness: number,
): HTMLCanvasElement | null {
  const w = (source as HTMLImageElement).naturalWidth || source.width;
  const h = (source as HTMLImageElement).naturalHeight || source.height;
  if (!w || !h) return null;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  drawGrey(ctx, source, grayscale, brightness, false);
  return out;
}
