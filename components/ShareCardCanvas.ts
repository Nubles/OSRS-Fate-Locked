/**
 * Draws the Share Run card straight onto a canvas at a fixed 1200 x 675, so a
 * phone and a PC export the same picture (no html2canvas, no page layout).
 * The numbers come from utils/shareCard.ts; this file only paints them.
 */
import { MAP_IMAGE } from '../utils/mapCoords';
import { GRID, cellToChunk, mapWindow, type ShareCardStats } from '../utils/shareCard';
import type { TierMarks } from '../utils/uiStyle';
import { gemColor, gemSrc, roman } from './osrs/OsrsDashGems';

export type ShareCardStyle = 'osrs' | 'tracker';

export const CARD_W = 1200;
export const CARD_H = 675;
export const SITE = 'nubles.github.io/OSRS-Fate-Locked';

export interface ShareCardFonts { plain: string; bold: string; small: string }

const CHUNK_PX = MAP_IMAGE.width / GRID.w;
const MAP = { x: 20, y: 76, w: 716, h: 427 } as const;

const wikiImage = (file: string) => `https://oldschool.runescape.wiki/images/${file}`;

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
/** Loads an image for drawing; resolves null when it can't, so the card still draws. */
const loadImage = (src: string, ms = 8000): Promise<HTMLImageElement | null> => {
  let pending = imageCache.get(src);
  if (!pending) {
    pending = new Promise<HTMLImageElement | null>(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = window.setTimeout(() => resolve(null), ms);
      img.onload = () => { window.clearTimeout(timer); resolve(img); };
      img.onerror = () => { window.clearTimeout(timer); resolve(null); };
      img.src = src;
    }).then(img => {
      if (!img) imageCache.delete(src); // let a Re-draw try again
      return img;
    });
    imageCache.set(src, pending);
  }
  return pending;
};

interface Paint {
  osrs: boolean;
  bg: string; frameDark: string; frameLight: string;
  insetFill: string; insetDark: string; insetLight: string;
  title: string; label: string; value: string; text: string; muted: string;
  barOn: string; barOff: string; owned: string; latest: string; site: string;
  title32: string; body16: string; num: (px: number) => string; small: (px: number) => string;
}

const paintFor = (style: ShareCardStyle, f: ShareCardFonts): Paint => style === 'osrs' ? {
  osrs: true,
  bg: '#3e3529', frameDark: '#1a1712', frameLight: '#5f5444',
  insetFill: 'rgba(0,0,0,0.22)', insetDark: '#24201a', insetLight: '#544a3b',
  title: '#ff981f', label: '#ff981f', value: '#ffff00', text: '#ffffff', muted: '#9f9483',
  barOn: '#00ff00', barOff: '#ff0000', owned: '#ffff00', latest: '#00ffff', site: '#ff981f',
  title32: `32px ${f.bold}`, body16: `16px ${f.plain}`, num: px => `${px}px ${f.bold}`, small: () => `16px ${f.small}`,
} : {
  osrs: false,
  bg: '#0a0c0f', frameDark: '#000000', frameLight: 'rgba(255,255,255,0.08)',
  insetFill: 'rgba(255,255,255,0.025)', insetDark: 'rgba(255,255,255,0.07)', insetLight: 'rgba(255,255,255,0.07)',
  title: '#ffffff', label: '#f59e0b', value: '#ffffff', text: '#d1d5db', muted: '#6b7280',
  barOn: '#10b981', barOff: 'rgba(255,255,255,0.08)', owned: '#34d399', latest: '#fbbf24', site: 'rgba(245,158,11,0.75)',
  title32: '700 28px system-ui, sans-serif', body16: '600 13px system-ui, sans-serif',
  num: px => `700 ${px}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`,
  small: px => `600 ${px}px system-ui, sans-serif`,
};

type Ctx = CanvasRenderingContext2D;

const setSpacing = (ctx: Ctx, px: number) => {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
};

const write = (ctx: Ctx, p: Paint, s: string, x: number, y: number, font: string, color: string,
  align: CanvasTextAlign = 'left', spacing = 0) => {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  setSpacing(ctx, spacing);
  if (p.osrs) { ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1); }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  setSpacing(ctx, 0);
};

/** Shortens `s` with an ellipsis until it fits `max` pixels in `font`. */
const fitText = (ctx: Ctx, s: string, font: string, max: number) => {
  ctx.font = font;
  if (ctx.measureText(s).width <= max) return s;
  let cut = s;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
};

const heading = (ctx: Ctx, p: Paint, s: string, x: number, y: number) => p.osrs
  ? write(ctx, p, s, x, y, `16px ${p.title32.split('px ')[1]}`, p.label)
  : write(ctx, p, s.toUpperCase(), x, y, p.small(11), p.label, 'left', 2);

const inset = (ctx: Ctx, p: Paint, x: number, y: number, w: number, h: number, fill = p.insetFill) => {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (p.osrs) {
    ctx.fillStyle = p.insetDark; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = p.insetLight; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
  } else {
    ctx.strokeStyle = p.insetDark; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
};

const icon = (ctx: Ctx, img: HTMLImageElement | null, cx: number, cy: number, max: number, dim = false) => {
  if (!img || !img.naturalWidth) return false;
  const s = Math.min(max / img.naturalWidth, max / img.naturalHeight, 2);
  const w = Math.round(img.naturalWidth * s);
  const h = Math.round(img.naturalHeight * s);
  ctx.save();
  if (dim) { ctx.globalAlpha = 0.28; ctx.filter = 'grayscale(1)'; }
  ctx.imageSmoothingEnabled = s < 1;
  ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
  ctx.restore();
  return true;
};

/** The map image cropped to `win` and shrunk to w x h in halving steps, which keeps detail. */
const cropMap = (img: HTMLImageElement, win: ReturnType<typeof mapWindow>, w: number, h: number) => {
  const crop = document.createElement('canvas');
  const sw = (win.x1 - win.x0) * CHUNK_PX;
  const sh = (win.y1 - win.y0) * CHUNK_PX;
  let cw = Math.max(w, Math.round(sw)); let ch = Math.max(h, Math.round(sh));
  // Never allocate more than the source needs (the full map is 9216 px wide).
  crop.width = cw; crop.height = ch;
  crop.getContext('2d')?.drawImage(img, win.x0 * CHUNK_PX, win.y0 * CHUNK_PX, sw, sh, 0, 0, cw, ch);
  let src: HTMLCanvasElement = crop;
  while (cw > w * 2 && ch > h * 2) {
    const step = document.createElement('canvas');
    step.width = Math.round(cw / 2); step.height = Math.round(ch / 2);
    const sctx = step.getContext('2d');
    if (!sctx) break;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, step.width, step.height);
    src = step; cw = step.width; ch = step.height;
  }
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  if (octx) { octx.imageSmoothingQuality = 'high'; octx.drawImage(src, 0, 0, w, h); }
  return out;
};

const drawMap = async (ctx: Ctx, p: Paint, d: ShareCardStats, scale: number, zoom: boolean) => {
  const { x: X, y: Y, w: W, h: H } = MAP;
  inset(ctx, p, X - 2, Y - 2, W + 4, H + 4, '#000');
  const win = mapWindow(d.owned, W / H, zoom);
  const cw = W / (win.x1 - win.x0);
  const chh = H / (win.y1 - win.y0);
  const isOwned = (gx: number, gy: number) => {
    if (gx < 0 || gy < 0 || gx >= GRID.w || gy >= GRID.h) return false;
    const { cx, cy } = cellToChunk(gx, gy);
    return d.owned.has(`${cx},${cy}`);
  };
  const cells = (each: (gx: number, gy: number, x: number, y: number) => void) => {
    for (let gx = Math.floor(win.x0) - 1; gx <= Math.ceil(win.x1); gx++) {
      for (let gy = Math.floor(win.y0) - 1; gy <= Math.ceil(win.y1); gy++) {
        each(gx, gy, X + (gx - win.x0) * cw, Y + (gy - win.y0) * chh);
      }
    }
  };

  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
  const img = await loadImage(MAP_IMAGE.src, 20000);
  if (img) {
    const bright = cropMap(img, win, Math.round(W * scale), Math.round(H * scale));
    ctx.save();
    ctx.filter = 'grayscale(0.85) brightness(0.32)';
    ctx.drawImage(bright, X, Y, W, H);
    ctx.restore();
    cells((gx, gy, x, y) => {
      if (!isOwned(gx, gy)) return;
      const rx = x - X; const ry = y - Y;
      ctx.drawImage(bright, rx * scale, ry * scale, cw * scale, chh * scale, x, y, cw, chh);
    });
  } else {
    // No map picture: still show the shape of the run's land.
    ctx.fillStyle = '#111'; ctx.fillRect(X, Y, W, H);
    ctx.fillStyle = p.osrs ? '#6b5b2e' : '#14532d';
    cells((gx, gy, x, y) => { if (isOwned(gx, gy)) ctx.fillRect(x, y, cw, chh); });
  }

  const outline = (inside: (gx: number, gy: number) => boolean, color: string, width: number) => {
    ctx.beginPath();
    cells((gx, gy, x, y) => {
      if (!inside(gx, gy)) return;
      if (!inside(gx, gy - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + cw, y); }
      if (!inside(gx, gy + 1)) { ctx.moveTo(x, y + chh); ctx.lineTo(x + cw, y + chh); }
      if (!inside(gx - 1, gy)) { ctx.moveTo(x, y); ctx.lineTo(x, y + chh); }
      if (!inside(gx + 1, gy)) { ctx.moveTo(x + cw, y); ctx.lineTo(x + cw, y + chh); }
    });
    ctx.lineCap = 'square';
    if (p.osrs) { ctx.strokeStyle = '#000'; ctx.lineWidth = width + 2; ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  outline(isOwned, p.owned, 1.5);
  const latest = new Set((d.latest?.chunks ?? []).map(c => `${c.cx},${c.cy}`));
  if (latest.size) {
    outline((gx, gy) => {
      const { cx, cy } = cellToChunk(gx, gy);
      return latest.has(`${cx},${cy}`);
    }, p.latest, 2);
  }
  ctx.restore();

  // Legend along the map's bottom edge.
  const items: [string, string][] = [[p.owned, d.areas.unit === 'chunks' ? 'Your chunks' : 'Your land']];
  if (d.latest) items.push([p.latest, `Newest: ${d.latest.name}`]);
  ctx.font = p.body16;
  const widths = items.map(([, s]) => ctx.measureText(s).width);
  const legendW = 16 + widths.reduce((sum, w) => sum + w + 38, 0);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(X + 10, Y + H - 34, Math.min(legendW, W - 20), 24);
  let lx = X + 22;
  items.forEach(([color, s], i) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(lx, Y + H - 28, 12, 12);
    write(ctx, p, fitText(ctx, s, p.body16, W - 40 - (lx - X)), lx + 20, Y + H - 17, p.body16, p.text);
    lx += widths[i] + 38;
  });
};

/** Wiki icons for the unlocked content row. */
const CONTENT_ICONS: Record<string, string> = {
  Bosses: 'Combat_icon.png',
  Minigames: 'Minigame_icon.png',
  Merchants: 'Coins_10000.png',
  POH: 'Construction_icon.png',
  'Combat Powers': 'Magic_icon.png',
  Storage: 'Looting_bag.png',
  Banks: 'Bank_icon.png',
  Mobility: 'Transportation_icon.png',
  Guilds: 'Mythical_cape.png',
  Farming: 'Farming_icon.png',
  Slayer: 'Slayer_icon.png',
};

const fmt = (n: number) => n.toLocaleString('en-GB');

/** Splits n boxes into at most two even rows of up to `most` each, so the last row never ends in a gap: 11 -> 6 + 5. */
const evenRows = (n: number, most: number): number => Math.ceil(n / Math.max(1, Math.ceil(n / most)));
/** The x and width of box i when rows of `per` boxes each fill `width`; a shorter last row stretches its boxes to fill it. */
const boxAt = (i: number, n: number, per: number, left: number, width: number, gap: number) => {
  const row = Math.floor(i / per);
  const inRow = Math.min(per, n - row * per);
  const w = (width - (inRow - 1) * gap) / inRow;
  return { x: left + (i - row * per) * (w + gap), w, row };
};

/** Short label for a skill whose icon could not load. */
const abbrev = (skill: string) => skill.slice(0, 3);

export interface DrawOptions {
  style: ShareCardStyle; zoom: boolean; fonts: ShareCardFonts; scale?: number;
  /** Settings > Tier marks: the OSRS card marks tiers the way the OSRS layout does (the tracker card keeps T1..T10). */
  tierMarks?: TierMarks;
}

/** Paints the card; resolves once every picture has loaded or been given up on. */
export async function drawShareCard(canvas: HTMLCanvasElement, d: ShareCardStats, opts: DrawOptions): Promise<void> {
  const scale = opts.scale ?? 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  const p = paintFor(opts.style, opts.fonts);

  const gems = p.osrs && opts.tierMarks === 'gems';
  const [skillImgs, gearImgs, keyImgs, rowImgs, contentImgs, gemImgs] = await Promise.all([
    Promise.all(d.skills.map(s => loadImage(wikiImage(`${s.skill}_icon.png`)))),
    Promise.all(d.gear.map(g => (g.file ? loadImage(wikiImage(g.file)) : Promise.resolve(null)))),
    Promise.all(['Brass_key.png', 'Crystal_key.png', 'Sinister_key.png'].map(f => loadImage(wikiImage(f)))),
    Promise.all(['World_map_icon.png', 'Quest_point_icon.png', 'Achievement_Diaries_icon.png', 'Stats_icon.png', 'Combat_Achievements_icon.png'].map(f => loadImage(wikiImage(f)))),
    Promise.all(d.content.map(c => (CONTENT_ICONS[c.label] ? loadImage(wikiImage(CONTENT_ICONS[c.label])) : Promise.resolve(null)))),
    Promise.all(gems ? Array.from({ length: 10 }, (_, i) => loadImage(gemSrc(i + 1))) : []),
  ]);

  /**
   * A skill or gear tier: the OSRS card draws the Roman numeral in its gem's
   * colour, or the cut gem, and leaves a locked one to its dimmed icon; the
   * tracker card writes T0..T10.
   */
  const tierMark = (tier: number, x: number, y: number, align: 'right' | 'center', font: string, color: string): void => {
    if (!p.osrs) { write(ctx, p, `T${tier}`, x, y, font, color, align); return; }
    if (tier <= 0) return;
    const gem = gems ? gemImgs[Math.min(tier, 10) - 1] : null;
    if (gem && gem.naturalWidth) {
      const gx = align === 'right' ? x - 18 : x - 9;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(gem, gx, y - 14, 18, 16);
      return;
    }
    write(ctx, p, roman(tier), x, y, p.body16, gemColor(tier), align);
  };

  canvas.width = CARD_W * scale;
  canvas.height = CARD_H * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Frame.
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, CARD_W, CARD_H);
  if (p.osrs) {
    ctx.fillStyle = p.frameDark;
    ctx.fillRect(0, 0, CARD_W, 3); ctx.fillRect(0, CARD_H - 3, CARD_W, 3);
    ctx.fillRect(0, 0, 3, CARD_H); ctx.fillRect(CARD_W - 3, 0, 3, CARD_H);
    ctx.fillStyle = p.frameLight; ctx.fillRect(3, 3, CARD_W - 6, 1); ctx.fillRect(3, 3, 1, CARD_H - 6);
  } else {
    const g = ctx.createLinearGradient(0, 0, CARD_W, 0);
    g.addColorStop(0, 'rgba(245,158,11,0)'); g.addColorStop(0.5, 'rgba(245,158,11,0.9)'); g.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CARD_W, 3);
  }

  // Title row: name, mode and day; the game's name on the right.
  const sub = `${d.mode} · Day ${fmt(d.day)} · since ${d.since}`;
  if (p.osrs) {
    const name = fitText(ctx, d.name, p.title32, 420);
    write(ctx, p, name, 24, 46, p.title32, p.title);
    ctx.font = p.title32;
    write(ctx, p, sub, 24 + ctx.measureText(name).width + 16, 44, p.body16, p.text);
    write(ctx, p, 'Fate Locked', CARD_W - 24, 44, p.title32, p.title, 'right');
  } else {
    write(ctx, p, `FATE LOCKED · ${d.mode.toUpperCase()}`, 24, 30, p.small(11), p.label, 'left', 3);
    write(ctx, p, fitText(ctx, d.name, p.title32, 700), 24, 60, p.title32, p.title);
    write(ctx, p, `Day ${fmt(d.day)} · since ${d.since}`, CARD_W - 24, 56, p.num(13), '#9ca3af', 'right');
  }

  await drawMap(ctx, p, d, scale, opts.zoom);

  const RX = 760;
  const RW = CARD_W - RX - 22;
  let y = 76;

  // Completion, with the OSRS green-over-red bar.
  inset(ctx, p, RX, y, RW, 100);
  const pct = `${d.completion}%`;
  const pctFont = p.num(p.osrs ? 48 : 44);
  write(ctx, p, pct, RX + 16, y + 56, pctFont, p.value);
  ctx.font = pctFont;
  write(ctx, p, p.osrs ? 'complete' : 'COMPLETE', RX + 26 + ctx.measureText(pct).width, y + 54,
    p.osrs ? p.body16 : p.small(11), p.osrs ? p.text : '#9ca3af', 'left', p.osrs ? 0 : 2);
  const bar = { x: RX + 16, y: y + 76, w: RW - 32, h: 10 };
  ctx.fillStyle = p.barOff; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = p.barOn; ctx.fillRect(bar.x, bar.y, Math.round(bar.w * Math.min(1, d.completion / 100)), bar.h);
  if (p.osrs) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(bar.x - 0.5, bar.y - 0.5, bar.w + 1, bar.h + 1); }

  // Progress: three over two, the second row stretched to fill.
  y += 112;
  const rows: [string, string][] = [
    [d.areas.unit === 'chunks' ? 'Chunks' : 'Areas', `${fmt(d.areas.unlocked)}/${fmt(d.areas.total)}`],
    ['Quests', `${d.quests.done}/${d.quests.total}`],
    ['Diary tasks', `${d.diary.done}/${d.diary.total}`],
    ['Total level', fmt(d.totalLevel)],
    ['Combat Achievements', `${fmt(d.ca.points)} pts${d.ca.tier ? ` · ${d.ca.tier}` : ''}`],
  ];
  const perProgressRow = evenRows(rows.length, 3);
  rows.forEach(([label, value], i) => {
    const { x, w, row } = boxAt(i, rows.length, perProgressRow, RX, RW, 8);
    const top = y + row * 52;
    inset(ctx, p, x, top, w, 46);
    icon(ctx, rowImgs[i], x + 22, top + 23, 24);
    if (p.osrs) {
      write(ctx, p, label, x + 44, top + 20, p.body16, p.label);
      write(ctx, p, value, x + 44, top + 39, p.num(16), p.value);
    } else {
      write(ctx, p, label.toUpperCase(), x + 44, top + 19, p.small(10), '#9ca3af', 'left', 1.5);
      write(ctx, p, value, x + 44, top + 38, p.num(17), p.value);
    }
  });

  // Keys as inventory stacks, and Fate points.
  y += 112;
  heading(ctx, p, 'Keys', RX, y + 4);
  y += 12;
  const keyCells: [HTMLImageElement | null, string, string][] = [
    [keyImgs[0], fmt(d.keys), 'Keys'], [keyImgs[1], fmt(d.omni), 'Omni'], [keyImgs[2], fmt(d.chaos), 'Chaos'],
    [null, d.fateMax === null ? fmt(d.fate) : `${d.fate}/${d.fateMax}`, 'Fate'],
  ];
  const kw = (RW - 24) / 4;
  keyCells.forEach(([img, count, label], i) => {
    const x = RX + i * (kw + 8);
    inset(ctx, p, x, y, kw, 60);
    if (img && icon(ctx, img, x + kw / 2, y + 26, 32)) {
      write(ctx, p, count, x + 6, y + 16, p.osrs ? p.body16 : p.num(13), p.osrs ? '#ffff00' : '#ffffff');
    } else {
      write(ctx, p, count, x + kw / 2, y + 34, p.num(p.osrs ? 22 : 18), p.osrs ? '#ffffff' : '#fbbf24', 'center');
    }
    write(ctx, p, p.osrs ? label : label.toUpperCase(), x + kw / 2, y + 53,
      p.small(9), p.osrs ? p.label : '#9ca3af', 'center', p.osrs ? 0 : 1.5);
  });

  // Skills, like the OSRS skills tab: icon, level and tier (T0 = locked, dimmed).
  y += 76;
  const tierTotal = (rows: { tier: number }[], max: number) =>
    `${rows.reduce((sum, r) => sum + r.tier, 0)}/${rows.length * max} tiers`;
  heading(ctx, p, 'Skills', RX, y + 4);
  write(ctx, p, tierTotal(d.skills, d.skillTierMax), RX + RW, y + 4, p.osrs ? p.small(16) : p.num(11), p.muted, 'right');
  y += 12;
  const cols = 8;
  const sw = (RW - (cols - 1) * 3) / cols;
  const sh = 42;
  d.skills.forEach((s, i) => {
    const x = RX + (i % cols) * (sw + 3);
    const top = y + Math.floor(i / cols) * (sh + 3);
    inset(ctx, p, x, top, sw, sh);
    const locked = s.tier === 0;
    if (!icon(ctx, skillImgs[i], x + 13, top + sh / 2, 20, locked)) {
      write(ctx, p, abbrev(s.skill), x + 4, top + 25, p.small(10), locked ? p.muted : p.text);
    }
    if (!locked) write(ctx, p, String(s.level), x + sw - 4, top + 18, p.osrs ? p.body16 : p.num(12), p.value, 'right');
    tierMark(s.tier, x + sw - 4, top + 36, 'right', p.osrs ? p.small(16) : p.num(10), locked ? p.muted : p.label);
  });

  // Gear, one slot each with its tier (T0 = locked, dimmed).
  y += 3 * (sh + 3) + 14;
  heading(ctx, p, 'Gear', RX, y + 4);
  write(ctx, p, tierTotal(d.gear, d.gearTierMax), RX + RW, y + 4, p.osrs ? p.small(16) : p.num(11), p.muted, 'right');
  y += 12;
  const gw = (RW - (d.gear.length - 1) * 3) / d.gear.length;
  d.gear.forEach((g, i) => {
    const x = RX + i * (gw + 3);
    inset(ctx, p, x, y, gw, 50);
    icon(ctx, gearImgs[i], x + gw / 2, y + 19, 26, g.tier === 0);
    tierMark(g.tier, x + gw / 2, y + 45, 'center', p.osrs ? p.small(16) : p.num(10), g.tier === 0 ? p.muted : p.label);
  });

  // Unlocked content under the map: one box per table, held/total, in two even rows.
  const cy = MAP.y + MAP.h + 12;
  heading(ctx, p, 'Unlocked content', MAP.x, cy + 4);
  const perRow = evenRows(d.content.length, Math.max(6, Math.ceil(d.content.length / 2)));
  const ch = 40;
  d.content.forEach((c, i) => {
    const { x, w: cw, row } = boxAt(i, d.content.length, perRow, MAP.x, MAP.w, 6);
    const top = cy + 12 + row * (ch + 4);
    inset(ctx, p, x, top, cw, ch);
    // Tracker labels are letter-spaced; a long one gets tighter and smaller rather than cut.
    const label = p.osrs ? c.label : c.label.toUpperCase();
    const fits = ([font, sp]: [string, number]) => { ctx.font = font; return ctx.measureText(label).width + sp * label.length <= cw - 6; };
    const tries: [string, number][] = p.osrs ? [[p.small(16), 0]] : [[p.small(10), 1.5], [p.small(10), 0.5], [p.small(9), 0.5], [p.small(9), 0]];
    const [labelFont, spacing] = tries.find(fits) ?? tries[tries.length - 1];
    write(ctx, p, fitText(ctx, label, labelFont, cw - 6 - spacing * label.length), x + cw / 2, top + 15, labelFont,
      p.osrs ? p.label : '#9ca3af', 'center', spacing);
    const value = `${c.done}/${c.total}`;
    const valueFont = p.osrs ? p.num(16) : p.num(14);
    ctx.font = valueFont;
    const vw = ctx.measureText(value).width;
    const img = contentImgs[i];
    const iconW = img && img.naturalWidth ? 22 : 0;
    const start = x + (cw - vw - iconW) / 2;
    if (iconW) icon(ctx, img, start + 9, top + 29, 16, c.done === 0);
    write(ctx, p, value, start + iconW, top + 35, valueFont, c.done === 0 ? p.muted : p.value);
  });

  // Footer: run ID, the local history check (only when it passed), any restores, and where to find the tracker.
  const fy = CARD_H - 18;
  if (!p.osrs) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, CARD_H - 48, CARD_W, 1); }
  const left = [d.runId ?? 'New run', d.history.ok ? 'History intact (self-reported)' : null, d.restored].filter(Boolean).join('  ·  ');
  write(ctx, p, left, 24, fy, p.osrs ? p.small(16) : p.num(11), p.osrs ? p.muted : '#6b7280');
  write(ctx, p, SITE, CARD_W - 24, fy, p.osrs ? p.small(16) : p.small(11), p.site, 'right', p.osrs ? 0 : 1);
}

/** One sentence describing the card, for screen readers and the picture's alt text. */
export const describeShareCard = (d: ShareCardStats): string =>
  `${d.name}, ${d.mode}, day ${d.day}: ${d.completion}% complete, ${d.areas.unlocked} of ${d.areas.total} ${d.areas.unit}, `
  + `${d.quests.done} quests, ${d.diary.done} diary tasks, total level ${d.totalLevel}.`;
