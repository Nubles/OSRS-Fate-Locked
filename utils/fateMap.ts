/**
 * How a Chunked run's map shows fate's hand (components/FateLandLayer.tsx and
 * the Chunks Key reveal, components/FateDrawsMap.tsx): fog over land the run
 * neither holds nor has on its frontier, Fate's Thread, fate's marks, and the
 * window and hops of the "Fate draws the map" spin. Pure, so vitest pins it;
 * looks only, it never changes what fate draws.
 */
import type { FateMark, FateSite } from '../types';
import { MAP_BOUNDS, CHUNK_TILES } from './mapCoords';
import {
  FATE_MARK_BLESSED_FATE, FATE_MARK_CHAOS_CHANCE, FATE_MARK_CLOUDED_ROLLS, FATE_MARK_CURSED_ODDS, FATE_MARK_CURSED_ROLLS,
  FATE_MARK_FORTUNATE_ODDS, FATE_MARK_FORTUNATE_ROLLS, FATE_MARK_WITHERED_FATE, FATE_SEAL_BOON_FACTOR,
  FATE_WAYSTONE_DRAWS,
} from '../config/economy';

/** Map-image pixels per chunk on the 9216x6528 world map. */
export const CHUNK_PX = 192;
const MIN_CX = MAP_BOUNDS.tileMinX / CHUNK_TILES; // 15
const MAX_CX = MAP_BOUNDS.tileMaxX / CHUNK_TILES - 1; // 62
const MIN_CY = MAP_BOUNDS.tileMinY / CHUNK_TILES; // 32
const MAX_CY = MAP_BOUNDS.tileMaxY / CHUNK_TILES - 1; // 65

const parse = (key: string): [number, number] => {
  const [cx, cy] = key.split(',').map(Number);
  return [cx, cy];
};

/** A chunk's box on the world map image: ((cx-15)*192, (65-cy)*192), 192 square. */
export const chunkBox = (key: string): { x: number; y: number } => {
  const [cx, cy] = parse(key);
  return { x: (cx - MIN_CX) * CHUNK_PX, y: (MAX_CY - cy) * CHUNK_PX };
};

export type FogState = 'held' | 'frontier' | 'fog';

/** Held land shows as drawn, the frontier dimmed, everything else under fog. */
export const fogState = (key: string, held: ReadonlySet<string>, frontier: ReadonlySet<string>): FogState =>
  held.has(key) ? 'held' : frontier.has(key) ? 'frontier' : 'fog';

/**
 * One even-odd SVG path covering the whole map image except the given chunks:
 * the fog, with a hole for every chunk the run holds or has on its frontier.
 */
export const fogPath = (clear: Iterable<string>, width: number, height: number): string => {
  let d = `M0 0H${width}V${height}H0Z`;
  for (const key of new Set(clear)) {
    const { x, y } = chunkBox(key);
    d += `M${x} ${y}h${CHUNK_PX}v${CHUNK_PX}h${-CHUNK_PX}Z`;
  }
  return d;
};

/**
 * The outline of a set of chunks: each edge not shared with another chunk of
 * the set, as [x1, y1, x2, y2] in map-image pixels.
 */
export const outlineEdges = (keys: ReadonlySet<string>): Array<[number, number, number, number]> => {
  const edges: Array<[number, number, number, number]> = [];
  for (const key of keys) {
    const [cx, cy] = parse(key);
    const { x, y } = chunkBox(key);
    const r = x + CHUNK_PX, b = y + CHUNK_PX;
    if (!keys.has(`${cx},${cy + 1}`)) edges.push([x, y, r, y]);
    if (!keys.has(`${cx},${cy - 1}`)) edges.push([x, b, r, b]);
    if (!keys.has(`${cx - 1},${cy}`)) edges.push([x, y, x, b]);
    if (!keys.has(`${cx + 1},${cy}`)) edges.push([r, y, r, b]);
  }
  return edges;
};

/**
 * Where Fate's Thread starts on the map: the held chunk nearest the thread
 * (straight-line distance; ties go to the first key in sort order, so the line
 * doesn't jump between renders).
 */
export const threadStart = (held: Iterable<string>, thread: string): string | undefined => {
  const [tx, ty] = parse(thread);
  let best: string | undefined;
  let bestD = Infinity;
  for (const key of [...held].sort()) {
    const [cx, cy] = parse(key);
    const d = (cx - tx) ** 2 + (cy - ty) ** 2;
    if (d < bestD) { bestD = d; best = key; }
  }
  return best;
};

/** Fate's omens on the map, in the tracker's OSRS colours: green boons, red banes. */
export const OMEN_BOON = '#0dc10d';
export const OMEN_BANE = '#ff3030';
export const MARK_NAME: Record<FateMark, string> = {
  BLESSED: 'Blessed', GILDED: 'Gilded', FORTUNATE: 'Fortunate', CHAOTIC: 'Chaotic',
  CURSED: 'Cursed', WITHERED: 'Withered', CLOUDED: 'Clouded', TANGLED: 'Tangled',
};
const BANE: ReadonlySet<FateMark> = new Set(['CURSED', 'WITHERED', 'CLOUDED', 'TANGLED']);
export const isBaneMark = (mark: FateMark): boolean => BANE.has(mark);

/** What an omen does, as the log and fate's spin say it. */
export const FATE_MARK_EFFECTS: Record<FateMark, string> = {
  BLESSED: `+${FATE_MARK_BLESSED_FATE} Fate, up to the pity line.`,
  GILDED: 'A free Key roll, waiting on the Keys screen.',
  FORTUNATE: `Your next ${FATE_MARK_FORTUNATE_ROLLS} Key rolls are ${FATE_MARK_FORTUNATE_ODDS}% better.`,
  CHAOTIC: `A ${FATE_MARK_CHAOS_CHANCE * 100}% chance of a Chaos Key.`,
  CURSED: `Your next ${FATE_MARK_CURSED_ROLLS} Key rolls are ${FATE_MARK_CURSED_ODDS}% worse, but each fail among them gives double Fate.`,
  WITHERED: `You lose ${FATE_MARK_WITHERED_FATE} Fate.`,
  CLOUDED: `Your next ${FATE_MARK_CLOUDED_ROLLS} Key rolls give no Fate if they fail.`,
  TANGLED: "Fate's Thread doesn't pull your next chunk.",
};

export const omenColor = (mark: FateMark): string => (BANE.has(mark) ? OMEN_BANE : OMEN_BOON);

/** What a boon does when it breaks a region's seal, at FATE_SEAL_BOON_FACTOR times its strength. */
export const SEAL_BOON_EFFECTS: Partial<Record<FateMark, string>> = {
  BLESSED: `+${FATE_MARK_BLESSED_FATE * FATE_SEAL_BOON_FACTOR} Fate, up to the pity line.`,
  GILDED: `${FATE_SEAL_BOON_FACTOR} free Key rolls, waiting on the Keys screen.`,
  FORTUNATE: `Your next ${FATE_MARK_FORTUNATE_ROLLS * FATE_SEAL_BOON_FACTOR} Key rolls are ${FATE_MARK_FORTUNATE_ODDS}% better.`,
  CHAOTIC: `A ${FATE_MARK_CHAOS_CHANCE * 100 * FATE_SEAL_BOON_FACTOR}% chance of a Chaos Key.`,
};

// ── Fated sites and region seals ──────────────────────────────────────────

export const SITE_NAME: Record<FateSite, string> = { SHRINE: 'Shrine', HOARD: 'Hoard', RIFT: 'Rift', WAYSTONE: 'Waystone' };
/** What a site does, as the log, the map and fate's spin say it. */
export const SITE_EFFECTS: Record<FateSite, string> = {
  SHRINE: "A free ritual, like reaching Fate's Thread.",
  HOARD: 'Fate gives you a Chaos Key.',
  RIFT: 'Fate draws a second chunk straight away.',
  WAYSTONE: `Your next ${FATE_WAYSTONE_DRAWS} Chunks draws all lean toward Fate's Thread.`,
};
export const siteLine = (site: FateSite): string => `Fated site: ${SITE_NAME[site]}. ${SITE_EFFECTS[site]}`;
export const sealLine = (region: string): string => `The seal of ${region} breaks.`;

/** The gold of Fate's Thread. */
export const THREAD_GOLD = '#ffc828';

/** The map's words for Fate's Thread, its leaning frontier and a marked chunk. */
export const threadLines = (place: string): [string, string] =>
  [`Fate's Thread: ${place}.`, 'One Chunks Key draw in six goes to the frontier chunks nearest it.'];
export const threadLine = (place: string): string => threadLines(place).join(' ');
export const THREAD_LEANING_LINE = "Nearest Fate's Thread: 1 in 6 Chunks draws go to these";
export const markLine = (mark: FateMark): string => `Fate's omen: ${MARK_NAME[mark]}, a ${BANE.has(mark) ? 'bane' : 'boon'}`;

// ── The "Fate draws the map" spin ─────────────────────────────────────────

export const SPIN_COLS = 7;
export const SPIN_ROWS = 5;

export interface SpinCell {
  key: string;
  col: number;
  row: number;
  /** What the run had before the draw: held, frontier, or fog. */
  state: FogState;
  drawn: boolean;
  /** Joins the frontier with the draw (it shows as the colour fills in). */
  newFrontier: boolean;
}

export interface SpinWindow {
  /** Westmost chunk column and northmost chunk row shown. */
  cx0: number;
  cyTop: number;
  cols: number;
  rows: number;
  cells: SpinCell[];
  /** The drawn chunk's cell. */
  drawn: { col: number; row: number };
}

/**
 * The patch of world map the spin shows: centred on the drawn chunk, clamped
 * so it never runs off the map image. `heldBefore` and `frontierBefore` are
 * the run's land and frontier before the draw; `frontierAfter` the frontier
 * once the drawn chunk is held.
 */
export const spinWindow = (
  drawnKey: string,
  heldBefore: ReadonlySet<string>,
  frontierBefore: ReadonlySet<string>,
  frontierAfter: ReadonlySet<string> = new Set(),
  cols = SPIN_COLS,
  rows = SPIN_ROWS,
): SpinWindow => {
  const [cx, cy] = parse(drawnKey);
  const cx0 = Math.max(MIN_CX, Math.min(MAX_CX - cols + 1, cx - Math.floor(cols / 2)));
  const cyTop = Math.min(MAX_CY, Math.max(MIN_CY + rows - 1, cy + Math.floor(rows / 2)));
  const cells: SpinCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${cx0 + col},${cyTop - row}`;
      const state = key === drawnKey ? 'frontier' : fogState(key, heldBefore, frontierBefore);
      cells.push({
        key, col, row, state, drawn: key === drawnKey,
        newFrontier: state === 'fog' && frontierAfter.has(key),
      });
    }
  }
  return { cx0, cyTop, cols, rows, cells, drawn: { col: cx - cx0, row: cyTop - cy } };
};

/**
 * The cells the highlight hops across: the frontier before the draw that the
 * window shows, the drawn chunk always among them. It ends on the drawn chunk
 * and never sits on one cell twice running. `rand` is visual jitter only
 * (Math.random is fine): the draw itself was made before the spin starts.
 */
export const spinHops = (
  frontier: readonly string[],
  drawnKey: string,
  hops: number,
  rand: () => number,
): string[] => {
  const pool = [...new Set([...frontier, drawnKey])];
  if (pool.length === 1) return [drawnKey];
  const path: string[] = [];
  for (let i = 0; i < hops - 1; i++) {
    // The hop before the landing stays off the drawn chunk, so the landing is a move.
    const avoid = new Set([path[path.length - 1], ...(i === hops - 2 ? [drawnKey] : [])]);
    const choices = pool.filter(key => !avoid.has(key));
    const options = choices.length > 0 ? choices : pool;
    path.push(options[Math.min(options.length - 1, Math.floor(rand() * options.length))]);
  }
  path.push(drawnKey);
  return path;
};

/**
 * When each hop starts, in ms from the start of the spin: quick at first and
 * slowing down, like a wheel, with the last hop landing at `total`.
 */
export const spinHopTimes = (hops: number, total: number): number[] => {
  if (hops <= 1) return [0];
  const gaps = Array.from({ length: hops - 1 }, (_, i) => 1 + 3 * ((i + 1) / (hops - 1)) ** 2);
  const scale = total / gaps.reduce((a, b) => a + b, 0);
  const times = [0];
  for (const gap of gaps) times.push(times[times.length - 1] + gap * scale);
  return times.map(t => Math.round(t));
};
