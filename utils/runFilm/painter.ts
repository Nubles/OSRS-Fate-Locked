import type { FilmStep, FilmSummary, FilmTickerKind } from './timeline';
import type { FilmCaptionFrame } from './director';
import { romanTier } from './timeline';
import { EQUIPMENT_SLOTS, SKILLS_LIST } from '../../data/items';

/**
 * Draws one Run Film frame on a canvas: the world map under fog, owned chunks
 * in colour with an orange edge, newly opened chunks flashing gold, and beside
 * (wide) or under (tall) the map the run's counters, its skill tiers as an
 * OSRS skills tab, its equipment tiers as worn-equipment slots, and the
 * latest unlocks. Tiers flash gold as they go up. Browser only.
 */

export type FilmShape = 'wide' | 'tall';
/** What the skills tab shows: tier numerals (I..X), OSRS levels, or both. */
export type FilmSkillView = 'tiers' | 'levels' | 'both';

export interface FilmPaintOptions {
  skillView?: FilmSkillView;
  /** 1 makes 1280 × 720 (wide) or 720 × 1280 (tall); 1.5 makes 1080p. */
  scale?: number;
}

interface Box { x: number; y: number; w: number; h: number }

export interface FilmLayout {
  width: number;
  height: number;
  map: Box;
  panel: Box;
  /** The counters row, the skills grid (3 × 8, OSRS skills-tab order), the equipment slots and the ticker. */
  stats: Box;
  skills: Box;
  gear: Box & { tile: number; style: 'rows' | 'cross' };
  ticker: Box;
}

/** The map image covers chunks 15..62 east and 32..65 north (utils/mapCoords.ts). */
export const MAP_CHUNKS = { minX: 15, maxY: 65, cols: 48, rows: 34 } as const;

export const filmLayout = (shape: FilmShape): FilmLayout => {
  if (shape === 'tall') {
    const width = 720, height = 1280;
    // 14 px a chunk: whole pixels, so chunk edges line up with the map picture.
    const s = 14, mw = s * MAP_CHUNKS.cols, mh = s * MAP_CHUNKS.rows;
    const map = { x: (width - mw) / 2, y: 150, w: mw, h: mh };
    const panel = { x: 24, y: map.y + mh + 28, w: width - 48, h: height - (map.y + mh + 28) - 24 };
    const stats = { x: panel.x, y: panel.y, w: panel.w, h: 64 };
    const skills = { x: panel.x, y: stats.y + stats.h + 14, w: 456, h: 8 * 37 - 3 };
    const tile = 52;
    const gearW = 3 * tile + 2 * 10;
    const gear = { x: panel.x + panel.w - gearW - 8, y: skills.y, w: gearW, h: 5 * tile + 4 * 10, tile, style: 'cross' as const };
    const tickerY = Math.max(skills.y + skills.h, gear.y + gear.h) + 18;
    return { width, height, map, panel, stats, skills, gear, ticker: { x: panel.x, y: tickerY, w: panel.w, h: panel.y + panel.h - tickerY } };
  }
  const width = 1280, height = 720;
  const s = 20, mh = s * MAP_CHUNKS.rows, mw = s * MAP_CHUNKS.cols;
  const map = { x: 20, y: 20, w: mw, h: mh };
  const panel = { x: map.x + mw + 24, y: 24, w: width - (map.x + mw + 24) - 20, h: height - 48 };
  const stats = { x: panel.x, y: panel.y + 84, w: panel.w, h: 48 };
  const skills = { x: panel.x, y: stats.y + stats.h + 10, w: panel.w, h: 8 * 28 - 2 };
  const tile = 36;
  const gear = { x: panel.x, y: skills.y + skills.h + 12, w: panel.w, h: 2 * tile + 6, tile, style: 'rows' as const };
  const tickerY = gear.y + gear.h + 14;
  return { width, height, map, panel, stats, skills, gear, ticker: { x: panel.x, y: tickerY, w: panel.w, h: panel.y + panel.h - tickerY } };
};

/** Where each equipment slot sits: the worn-equipment cross (tall) or two rows (wide), in tiles. */
const CROSS: Record<string, [number, number]> = {
  Head: [1, 0], Cape: [0, 1], Neck: [1, 1], Ammo: [2, 1], Weapon: [0, 2], Body: [1, 2], Shield: [2, 2],
  Legs: [1, 3], Gloves: [0, 4], Boots: [1, 4], Ring: [2, 4],
};
export const gearTileRect = (slot: string, gear: FilmLayout['gear']): Box => {
  const i = EQUIPMENT_SLOTS.indexOf(slot);
  if (gear.style === 'cross') {
    const [c, r] = CROSS[slot] ?? [0, 0];
    const gap = (gear.w - 3 * gear.tile) / 2;
    return { x: gear.x + c * (gear.tile + gap), y: gear.y + r * (gear.tile + gap), w: gear.tile, h: gear.tile };
  }
  const perRow = 6, gap = (gear.w - perRow * gear.tile) / (perRow - 1);
  const r = Math.floor(i / perRow), c = i % perRow;
  // The second row (5 slots) is centred under the first.
  const offset = r === 1 ? (gear.tile + gap) / 2 : 0;
  return { x: gear.x + offset + c * (gear.tile + gap), y: gear.y + r * (gear.tile + 6), w: gear.tile, h: gear.tile };
};
export const skillCellRect = (skill: string, skills: Box): Box => {
  const i = SKILLS_LIST.indexOf(skill);
  const gap = 2, rowH = (skills.h + gap) / 8, colW = (skills.w + gap) / 3;
  return { x: skills.x + (i % 3) * colW, y: skills.y + Math.floor(i / 3) * rowH, w: colW - gap, h: rowH - gap };
};

/** A chunk's rectangle inside the map box. */
export const chunkRect = (key: string, map: Box): Box => {
  const [cx, cy] = key.split(',').map(Number);
  const s = map.w / MAP_CHUNKS.cols;
  return { x: map.x + (cx - MAP_CHUNKS.minX) * s, y: map.y + (MAP_CHUNKS.maxY - cy) * s, w: s, h: s };
};

/** What a frame shows besides the run: a caption card and the end card. */
export interface FilmFrameExtras {
  caption?: FilmCaptionFrame | null;
  endCard?: { summary: FilmSummary; age: number; showLevels: boolean; site: string } | null;
}
/** Frames the end card takes to fade in. */
export const END_CARD_FADE = 12;

const C = {
  page: '#191512', frame: '#000000', fogTint: 'rgba(31,26,20,0.38)',
  orange: '#ff981f', yellow: '#ffff00', tan: '#c8b897', dim: '#8a7c66', shadow: '#000000',
  cell: '#3e3529', cellLocked: '#2a241c', cellEdge: '#14100b', cellLight: '#5a4d3c',
};
const TICKER_COLOUR: Record<FilmTickerKind, string> = {
  area: '#ffff00', skill: '#0dc10d', gear: '#ff981f', bank: '#ffffff', boss: '#ff3030', other: '#c8b897',
};
/** Tier I..X as the OSRS layout's gems colour them (components/osrs/OsrsDashGems.ts). */
const GEM_COLOUR = ['#d9cfc0', '#6fbf6a', '#f08a5a', '#8aa4ff', '#2fbf5a', '#ff7878', '#dcecff', '#d886f5', '#a8a8a8', '#f5a623'];
const gemColour = (t: number) => GEM_COLOUR[Math.min(Math.max(t, 1), GEM_COLOUR.length) - 1];

/** OSRS sprites for the skills tab and the equipment slots. Any can be missing; the frame still draws. */
export interface FilmSprites {
  skills?: Partial<Record<string, CanvasImageSource>>;
  slots?: Partial<Record<string, CanvasImageSource>>;
  tile?: CanvasImageSource;
  /** Tier I..X small corner gems (11 × 12), index 0 = tier I. */
  gems?: readonly (CanvasImageSource | undefined)[];
}
/** How many frames a newly opened chunk glows for. */
export const GLOW_FRAMES = 18;

export interface FilmFonts { regular: string; bold: string }

/** Film sizes: 720p, or 1080p for creators. */
export const FILM_SCALES = [1, 1.5] as const;

export class FilmPainter {
  readonly layout: FilmLayout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly colour: HTMLCanvasElement;
  private readonly fog: HTMLCanvasElement;
  /** Skill icons in grey, for skills the run hasn't opened. */
  private readonly greySkills = new Map<string, HTMLCanvasElement>();
  private readonly scale: number;
  private readonly skillView: FilmSkillView;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    mapImage: CanvasImageSource,
    readonly shape: FilmShape,
    private readonly fonts: FilmFonts,
    private readonly sprites: FilmSprites = {},
    options: FilmPaintOptions = {},
  ) {
    this.layout = filmLayout(shape);
    this.scale = Math.max(0.25, options.scale ?? 1);
    this.skillView = options.skillView ?? 'tiers';
    // Everything is laid out at 720p and drawn scaled, so 1080p is the same film, sharper.
    canvas.width = Math.round(this.layout.width * this.scale);
    canvas.height = Math.round(this.layout.height * this.scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot draw on a canvas.');
    this.ctx = ctx;
    const w = Math.round(this.layout.map.w * this.scale), h = Math.round(this.layout.map.h * this.scale);
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
    for (const [skill, icon] of Object.entries(sprites.skills ?? {})) {
      if (!icon) continue;
      const iw = Number((icon as HTMLImageElement).width) || 25, ih = Number((icon as HTMLImageElement).height) || 25;
      const g = document.createElement('canvas');
      g.width = iw; g.height = ih;
      const gc = g.getContext('2d');
      if (!gc) continue;
      gc.filter = 'grayscale(1) brightness(0.5)';
      gc.drawImage(icon, 0, 0);
      this.greySkills.set(skill, g);
    }
  }

  /** A sprite at its own size (scaled by `scale`), centred in a box, pixel-crisp. */
  private sprite(img: CanvasImageSource, cx: number, cy: number, scale = 1) {
    const w = (Number((img as HTMLImageElement).width) || 25) * scale, h = (Number((img as HTMLImageElement).height) || 25) * scale;
    this.ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), Math.round(w), Math.round(h));
  }

  private glowBox(r: Box, left: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(255,220,60,0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = `rgba(255,220,60,${(0.6 * left / GLOW_FRAMES).toFixed(3)})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  private bevel(r: Box, fill: string) {
    const ctx = this.ctx;
    ctx.fillStyle = fill;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = C.cellEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(r.x + 1.5, r.y + r.h - 1.5); ctx.lineTo(r.x + 1.5, r.y + 1.5); ctx.lineTo(r.x + r.w - 1.5, r.y + 1.5);
    ctx.stroke();
  }

  private drawSkills(step: FilmStep | undefined, glow: ReadonlyMap<string, number>) {
    const { ctx, layout } = this;
    const tall = this.shape === 'tall';
    const size = tall ? 24 : 18;
    const font = `${size}px ${this.fonts.bold}`;
    const view = this.skillView;
    ctx.imageSmoothingEnabled = false;
    for (const skill of SKILLS_LIST) {
      const r = skillCellRect(skill, layout.skills);
      const tier = step?.skills?.[skill] ?? 0;
      const level = step?.levels?.[skill] ?? (skill === 'Hitpoints' ? 10 : 1);
      this.bevel(r, tier ? C.cell : C.cellLocked);
      const icon = tier ? this.sprites.skills?.[skill] : (this.greySkills.get(skill) ?? this.sprites.skills?.[skill]);
      const iconX = r.x + (tall ? 22 : 16);
      if (icon) this.sprite(icon, iconX, r.y + r.h / 2, tall ? 1.2 : 0.9);
      const textX = r.x + r.w - (tall ? 10 : 6);
      const textY = r.y + (r.h - size) / 2 - 1;
      const barX = r.x + (tall ? 42 : 32);
      if (view === 'tiers') {
        // Tier as a numeral in its gem's colour, and a bar of ten.
        if (tier) this.text(romanTier(tier), textX, textY, font, gemColour(tier), 'right');
        else this.text('–', textX, textY, font, C.dim, 'right');
        const barW = r.w - (tall ? 42 : 32) - (tall ? 64 : 40), barY = r.y + r.h / 2 - 2;
        if (barW > 24) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(barX, barY, barW, 4);
          if (tier) { ctx.fillStyle = gemColour(tier); ctx.fillRect(barX, barY, barW * tier / 10, 4); }
        }
      } else {
        // The level in yellow, as the OSRS skills tab shows it; dim while the skill is locked.
        this.text(String(level), textX, textY, font, tier ? C.yellow : C.dim, 'right');
        if (view === 'both') {
          const small = tall ? 20 : 14;
          if (tier) this.text(romanTier(tier), barX - (tall ? 2 : 3), r.y + (r.h - small) / 2 - 1, `${small}px ${this.fonts.bold}`, gemColour(tier));
          // A thin bar of ten along the cell's foot.
          const footW = r.w - (barX - r.x) - 4, footY = r.y + r.h - (tall ? 6 : 4);
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(barX - (tall ? 2 : 3), footY, footW, tall ? 3 : 2);
          if (tier) { ctx.fillStyle = gemColour(tier); ctx.fillRect(barX - (tall ? 2 : 3), footY, footW * tier / 10, tall ? 3 : 2); }
        }
      }
      const left = glow.get(`skill:${skill}`);
      if (left) this.glowBox(r, left);
    }
    ctx.imageSmoothingEnabled = true;
  }

  private drawGear(step: FilmStep | undefined, glow: ReadonlyMap<string, number>) {
    const { ctx, layout } = this;
    const tall = this.shape === 'tall';
    const { tile, slots, gems } = this.sprites;
    ctx.imageSmoothingEnabled = false;
    for (const slot of EQUIPMENT_SLOTS) {
      const r = gearTileRect(slot, layout.gear);
      const tier = step?.gear?.[slot] ?? 0;
      if (tile) ctx.drawImage(tile, r.x, r.y, r.w, r.h);
      else this.bevel(r, C.cell);
      const scale = r.w / 36;
      // As the tracker's OSRS equipment doll draws it: the slot's silhouette,
      // dim while locked, with the tier's gem in the corner once open.
      if (slots?.[slot]) {
        ctx.globalAlpha = tier ? 1 : 0.35;
        this.sprite(slots[slot]!, r.x + r.w / 2, r.y + r.h / 2, scale);
        ctx.globalAlpha = 1;
      }
      if (tier) {
        ctx.strokeStyle = gemColour(tier);
        ctx.lineWidth = tall ? 2 : 1.5;
        ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        const gem = gems?.[Math.min(tier, 10) - 1];
        if (gem) this.sprite(gem, r.x + 4 + 6 * scale, r.y + 4 + 6 * scale, Math.max(1, Math.round(scale * 1.4)));
      }
      if (tier) this.text(romanTier(tier), r.x + r.w - 3, r.y + r.h - (tall ? 22 : 16), `${tall ? 18 : 14}px ${this.fonts.bold}`, gemColour(tier), 'right');
      const left = glow.get(`gear:${slot}`);
      if (left) this.glowBox(r, left);
    }
    ctx.imageSmoothingEnabled = true;
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
  paint(owned: ReadonlySet<string>, glow: ReadonlyMap<string, number>, step: FilmStep | undefined, title: string, extras: FilmFrameExtras = {}) {
    const { ctx, layout } = this;
    const { map, panel } = layout;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = C.page;
    ctx.fillRect(0, 0, layout.width, layout.height);

    // Everything on the map, caption cards included, stays inside its box.
    ctx.save();
    ctx.beginPath();
    ctx.rect(map.x, map.y, map.w, map.h);
    ctx.clip();
    ctx.drawImage(this.fog, map.x, map.y, map.w, map.h);
    const s = map.w / MAP_CHUNKS.cols;

    // Owned land in colour.
    ctx.save();
    ctx.beginPath();
    for (const k of owned) { const r = chunkRect(k, map); ctx.rect(r.x, r.y, r.w, r.h); }
    ctx.clip();
    ctx.drawImage(this.colour, map.x, map.y, map.w, map.h);
    ctx.restore();

    // New land glows gold, fading out.
    if ([...glow.keys()].some(k => !k.includes(':'))) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,220,60,0.9)';
      ctx.shadowBlur = s;
      for (const [k, left] of glow) {
        if (k.includes(':')) continue; // a skill or gear tier
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
    for (const k of owned) {
      const [cx, cy] = k.split(',').map(Number);
      const r = chunkRect(k, map);
      if (!owned.has(`${cx},${cy + 1}`)) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + s, r.y); }
      if (!owned.has(`${cx},${cy - 1}`)) { ctx.moveTo(r.x, r.y + s); ctx.lineTo(r.x + s, r.y + s); }
      if (!owned.has(`${cx - 1},${cy}`)) { ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + s); }
      if (!owned.has(`${cx + 1},${cy}`)) { ctx.moveTo(r.x + s, r.y); ctx.lineTo(r.x + s, r.y + s); }
    }
    ctx.stroke();
    if (extras.caption) this.drawCaption(extras.caption);
    ctx.restore();
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
      this.text(`Day ${step?.day ?? 1}`, panel.x, panel.y + 30, `${big}px ${bold}`, C.yellow);
    }
    // Counters in one row: three, or four with the total level.
    const { stats, ticker } = layout;
    const rows: [string, number][] = [['Unlocks', step?.unlocks ?? 0], ['Key rolls', step?.rolls ?? 0], ['Keys won', step?.keysWon ?? 0]];
    if (this.skillView !== 'tiers') rows.push(['Total level', step?.totalLevel ?? 0]);
    const label = tall ? 24 : 16, value = tall ? 28 : 22;
    const colW = stats.w / rows.length;
    rows.forEach(([k, v], i) => {
      this.text(k, stats.x + i * colW, stats.y, `${label}px ${regular}`, C.tan);
      this.text(v.toLocaleString('en-GB'), stats.x + i * colW, stats.y + label + 4, `${value}px ${bold}`, C.yellow);
    });

    this.drawSkills(step, glow);
    this.drawGear(step, glow);

    this.text('Latest', ticker.x, ticker.y, `${small}px ${bold}`, C.orange);
    const lineH = small + 8;
    const room = Math.max(0, Math.floor((ticker.h - lineH) / lineH));
    (step?.ticker ?? []).slice(0, room).forEach((line, i) => {
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 0.85 - i * 0.08);
      this.text(this.fit(line.text, ticker.w, `${small}px ${regular}`), ticker.x, ticker.y + lineH * (i + 1), `${small}px ${regular}`, TICKER_COLOUR[line.kind]);
    });
    ctx.globalAlpha = 1;
    if (extras.endCard) this.drawEndCard(extras.endCard, title);
  }

  /** An OSRS-style stone panel: dark fill, black edge, a light inner bevel. */
  private stone(r: Box) {
    const ctx = this.ctx;
    ctx.fillStyle = '#2e271f';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.strokeStyle = C.cellLight;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 3.5, r.y + 3.5, r.w - 7, r.h - 7);
  }

  /** A caption card over the foot of the map: slides up and fades in, holds, fades out. */
  private drawCaption(c: FilmCaptionFrame) {
    const { ctx, layout } = this;
    const { map } = layout;
    const tall = this.shape === 'tall';
    const fadeIn = Math.min(1, c.age / 8), fadeOut = Math.min(1, (c.length - c.age) / 10);
    const a = Math.max(0, Math.min(fadeIn, fadeOut));
    if (a <= 0) return;
    const w = Math.min(map.w - 40, tall ? 520 : 560), h = tall ? 84 : 80;
    const r = { x: map.x + (map.w - w) / 2, y: map.y + map.h - h - 18 + Math.round((1 - fadeIn) * 14), w, h };
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12;
    this.stone(r);
    ctx.shadowBlur = 0;
    // A gold rule under the title, as OSRS's quest scroll has.
    ctx.fillStyle = 'rgba(255,152,31,0.55)';
    ctx.fillRect(r.x + 40, r.y + (tall ? 46 : 44), r.w - 80, 1);
    const titleFont = `${tall ? 30 : 28}px ${this.fonts.bold}`, textFont = `${tall ? 22 : 20}px ${this.fonts.regular}`;
    const colour = c.moment.kind === 'luck' ? C.yellow : C.orange;
    this.text(this.fit(c.moment.title, r.w - 32, titleFont), r.x + r.w / 2, r.y + 10, titleFont, colour, 'center');
    this.text(this.fit(c.moment.text, r.w - 32, textFont), r.x + r.w / 2, r.y + (tall ? 52 : 50), textFont, C.tan, 'center');
    ctx.restore();
  }

  /** The last few seconds: the run summed up on a stone panel over the finished map. */
  private drawEndCard(card: NonNullable<FilmFrameExtras['endCard']>, title: string) {
    const { ctx, layout } = this;
    const tall = this.shape === 'tall';
    const a = Math.min(1, card.age / END_CARD_FADE);
    const { summary: sm } = card;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,8,6,0.72)';
    ctx.fillRect(0, 0, layout.width, layout.height);
    const w = tall ? 620 : 760, h = tall ? 860 : 540;
    const r = { x: (layout.width - w) / 2, y: (layout.height - h) / 2 + Math.round((1 - a) * 16), w, h };
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 24;
    this.stone(r);
    ctx.shadowBlur = 0;
    const { bold, regular } = this.fonts;
    const cx = r.x + w / 2;
    let y = r.y + 28;
    this.text(this.fit(title, w - 60, `${tall ? 30 : 28}px ${bold}`), cx, y, `${tall ? 30 : 28}px ${bold}`, C.orange, 'center');
    y += tall ? 48 : 42;
    const days = sm.toDay - sm.fromDay + 1;
    const headline = sm.wholeRun || sm.fromDay === 1
      ? `${days} ${days === 1 ? 'day' : 'days'} of fate`
      : `Days ${sm.fromDay} to ${sm.toDay}`;
    this.text(headline, cx, y, `${tall ? 56 : 52}px ${bold}`, C.yellow, 'center');
    y += tall ? 84 : 76;
    ctx.fillStyle = 'rgba(255,152,31,0.5)';
    ctx.fillRect(r.x + 40, y - 14, w - 80, 1);

    const pct = (n: number) => `${n < 0.1 && n > 0 ? (n * 100).toFixed(1) : Math.round(n * 100)}%`;
    const tiles: [string, string, string?][] = [
      ['Unlocks', sm.unlocks.toLocaleString('en-GB')],
      ['Map open', pct(sm.mapShare)],
      ['Key rolls', sm.rolls.toLocaleString('en-GB')],
      ['Keys won', sm.keysWon.toLocaleString('en-GB')],
    ];
    if (card.showLevels) tiles.push(['Total level', sm.totalLevel.toLocaleString('en-GB')]);
    if (sm.luckiest) tiles.push(['Luckiest roll', `${sm.luckiest.chance < 10 ? sm.luckiest.chance.toFixed(1).replace(/\.0$/, '') : Math.round(sm.luckiest.chance)}%`, sm.luckiest.source]);
    if (sm.longestDry > 0) tiles.push(['Longest dry run', `${sm.longestDry.toLocaleString('en-GB')} rolls`]);
    const cols = 2, colW = (w - 80) / cols, rowH = tall ? 118 : 84;
    tiles.forEach(([label, value, note], i) => {
      // A lone last tile sits in the middle.
      const alone = i === tiles.length - 1 && i % cols === 0;
      const tx = alone ? cx : r.x + 40 + (i % cols) * colW + colW / 2, ty = y + Math.floor(i / cols) * rowH;
      this.text(label, tx, ty, `${tall ? 22 : 18}px ${regular}`, C.tan, 'center');
      this.text(value, tx, ty + (tall ? 28 : 22), `${tall ? 40 : 32}px ${bold}`, C.yellow, 'center');
      if (note) this.text(this.fit(note, colW - 16, `${tall ? 18 : 14}px ${regular}`), tx, ty + (tall ? 74 : 58), `${tall ? 18 : 14}px ${regular}`, C.dim, 'center');
    });
    const footY = r.y + h - (tall ? 76 : 64);
    this.text('Made with Fate Locked', cx, footY, `${tall ? 24 : 20}px ${bold}`, C.orange, 'center');
    this.text(card.site, cx, footY + (tall ? 32 : 26), `${tall ? 20 : 16}px ${regular}`, C.tan, 'center');
    ctx.restore();
  }
}
