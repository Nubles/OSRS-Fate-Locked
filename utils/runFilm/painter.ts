import type { FilmStep, FilmTickerKind } from './timeline';

/**
 * Draws one Run Film frame on a canvas: the world map under fog, owned chunks
 * in colour with an orange edge, newly opened chunks flashing gold, and the
 * run's counters beside (wide) or under (tall) the map. Browser only.
 */

export type FilmShape = 'wide' | 'tall';

interface Box { x: number; y: number; w: number; h: number }

export interface FilmLayout {
  width: number;
  height: number;
  map: Box;
  panel: Box;
}

/** The map image covers chunks 15..62 east and 32..65 north (utils/mapCoords.ts). */
export const MAP_CHUNKS = { minX: 15, maxY: 65, cols: 48, rows: 34 } as const;

export const filmLayout = (shape: FilmShape): FilmLayout => {
  if (shape === 'tall') {
    const width = 720, height = 1280;
    // 14 px a chunk: whole pixels, so chunk edges line up with the map picture.
    const s = 14, mw = s * MAP_CHUNKS.cols, mh = s * MAP_CHUNKS.rows;
    const map = { x: (width - mw) / 2, y: 150, w: mw, h: mh };
    return { width, height, map, panel: { x: 24, y: map.y + mh + 28, w: width - 48, h: height - (map.y + mh + 28) - 24 } };
  }
  const width = 1280, height = 720;
  const s = 20, mh = s * MAP_CHUNKS.rows, mw = s * MAP_CHUNKS.cols;
  const map = { x: 20, y: 20, w: mw, h: mh };
  return { width, height, map, panel: { x: map.x + mw + 24, y: 24, w: width - (map.x + mw + 24) - 20, h: height - 48 } };
};

/** A chunk's rectangle inside the map box. */
export const chunkRect = (key: string, map: Box): Box => {
  const [cx, cy] = key.split(',').map(Number);
  const s = map.w / MAP_CHUNKS.cols;
  return { x: map.x + (cx - MAP_CHUNKS.minX) * s, y: map.y + (MAP_CHUNKS.maxY - cy) * s, w: s, h: s };
};

const C = {
  page: '#191512', frame: '#000000', fogTint: 'rgba(31,26,20,0.38)',
  orange: '#ff981f', yellow: '#ffff00', tan: '#c8b897', dim: '#8a7c66', shadow: '#000000',
};
const TICKER_COLOUR: Record<FilmTickerKind, string> = {
  area: '#ffff00', skill: '#0dc10d', bank: '#ffffff', boss: '#ff3030', other: '#c8b897',
};
/** How many frames a newly opened chunk glows for. */
export const GLOW_FRAMES = 18;

export interface FilmFonts { regular: string; bold: string }

export class FilmPainter {
  readonly layout: FilmLayout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly colour: HTMLCanvasElement;
  private readonly fog: HTMLCanvasElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    mapImage: CanvasImageSource,
    readonly shape: FilmShape,
    private readonly fonts: FilmFonts,
  ) {
    this.layout = filmLayout(shape);
    canvas.width = this.layout.width;
    canvas.height = this.layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw on a canvas.');
    this.ctx = ctx;
    const { w, h } = this.layout.map;
    this.colour = document.createElement('canvas');
    this.colour.width = w; this.colour.height = h;
    const cc = this.colour.getContext('2d')!;
    cc.imageSmoothingQuality = 'high';
    cc.drawImage(mapImage, 0, 0, w, h);
    this.fog = document.createElement('canvas');
    this.fog.width = w; this.fog.height = h;
    const fc = this.fog.getContext('2d')!;
    fc.filter = 'grayscale(1) brightness(0.32)';
    fc.drawImage(this.colour, 0, 0);
    fc.filter = 'none';
    fc.fillStyle = C.fogTint;
    fc.fillRect(0, 0, w, h);
  }

  private text(s: string, x: number, y: number, font: string, colour: string, align: CanvasTextAlign = 'left') {
    const ctx = this.ctx;
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.shadow;
    ctx.fillText(s, x + 2, y + 2);
    ctx.fillStyle = colour;
    ctx.fillText(s, x, y);
  }

  private fit(s: string, maxWidth: number, font: string): string {
    this.ctx.font = font;
    if (this.ctx.measureText(s).width <= maxWidth) return s;
    let t = s;
    while (t.length > 1 && this.ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
  }

  /** Draws a frame: `owned` is every chunk open now, `glow` maps a chunk to its frames of glow left. */
  paint(owned: ReadonlySet<string>, glow: ReadonlyMap<string, number>, step: FilmStep | undefined, title: string) {
    const { ctx, layout } = this;
    const { map, panel } = layout;
    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.drawImage(this.fog, map.x, map.y);

    // Owned land in colour.
    ctx.save();
    ctx.beginPath();
    for (const k of owned) { const r = chunkRect(k, map); ctx.rect(r.x, r.y, r.w, r.h); }
    ctx.clip();
    ctx.drawImage(this.colour, map.x, map.y);
    ctx.restore();

    // New land glows gold, fading out.
    if (glow.size) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,60,0.9)';
      ctx.shadowBlur = map.w / MAP_CHUNKS.cols;
      for (const [k, left] of glow) {
        const r = chunkRect(k, map);
        ctx.fillStyle = `rgba(255,220,60,${(0.75 * left / GLOW_FRAMES).toFixed(3)})`;
        ctx.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      }
      ctx.restore();
    }

    // Orange edge round owned land.
    ctx.strokeStyle = C.orange;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const s = map.w / MAP_CHUNKS.cols;
    for (const k of owned) {
      const [cx, cy] = k.split(',').map(Number);
      const r = chunkRect(k, map);
      if (!owned.has(`${cx},${cy + 1}`)) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + s, r.y); }
      if (!owned.has(`${cx},${cy - 1}`)) { ctx.moveTo(r.x, r.y + s); ctx.lineTo(r.x + s, r.y + s); }
      if (!owned.has(`${cx - 1},${cy}`)) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + s); }
      if (!owned.has(`${cx + 1},${cy}`)) { ctx.moveTo(r.x + s, r.y); ctx.lineTo(r.x + s, r.y + s); }
    }
    ctx.stroke();
    ctx.strokeStyle = C.frame;
    ctx.lineWidth = 3;
    ctx.strokeRect(map.x - 1.5, map.y - 1.5, map.w + 3, map.h + 3);

    const tall = this.shape === 'tall';
    const { regular, bold } = this.fonts;
    const big = tall ? 64 : 48, mid = tall ? 28 : 22, small = tall ? 24 : 18;
    if (tall) {
      this.text(this.fit(title, layout.width - 48, `${mid}px ${bold}`), 24, 36, `${mid}px ${bold}`, C.orange);
      this.text(`Day ${step?.day ?? 1}`, 24, 70, `${big}px ${bold}`, C.yellow);
    } else {
      this.text(this.fit(title, panel.w, `${mid}px ${bold}`), panel.x, panel.y, `${mid}px ${bold}`, C.orange);
      this.text(`Day ${step?.day ?? 1}`, panel.x, panel.y + 32, `${big}px ${bold}`, C.yellow);
    }
    const rows: [string, number][] = [['Unlocks', step?.unlocks ?? 0], ['Key rolls', step?.rolls ?? 0], ['Keys won', step?.keysWon ?? 0]];
    const statsY = tall ? panel.y : panel.y + 104;
    const rowH = small + 10;
    if (tall) {
      const colW = panel.w / 3;
      rows.forEach(([k, v], i) => {
        this.text(k, panel.x + i * colW, statsY, `${small}px ${regular}`, C.tan);
        this.text(v.toLocaleString('en-GB'), panel.x + i * colW, statsY + rowH, `${mid}px ${bold}`, C.yellow);
      });
    } else {
      rows.forEach(([k, v], i) => {
        this.text(k, panel.x, statsY + i * rowH, `${small}px ${regular}`, C.tan);
        this.text(v.toLocaleString('en-GB'), panel.x + panel.w, statsY + i * rowH, `${small}px ${bold}`, C.yellow, 'right');
      });
    }
    const tickerY = tall ? statsY + rowH * 2 + 30 : statsY + rowH * 3 + 24;
    this.text('Latest', panel.x, tickerY, `${small}px ${bold}`, C.orange);
    const lineH = small + 8;
    const room = Math.max(0, Math.floor((panel.y + panel.h - (tickerY + lineH)) / lineH));
    (step?.ticker ?? []).slice(0, room).forEach((line, i) => {
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 0.85 - i * 0.05);
      this.text(this.fit(line.text, panel.w, `${small}px ${regular}`), panel.x, tickerY + lineH * (i + 1), `${small}px ${regular}`, TICKER_COLOUR[line.kind]);
    });
    ctx.globalAlpha = 1;
  }
}
