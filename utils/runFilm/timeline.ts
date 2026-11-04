import type { LogEntry } from '../../types';
import { REGION_CHUNKS } from '../../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../../data/subAreaChunks';
import { isRegionUnlocked } from '../reachability';
import { CHUNKED_START_KEY } from '../chunkAdjacency';
import { isRollEntry } from '../logEntry';

/**
 * Run Film: the run's log played back as map steps. Pure, so the same log
 * always makes the same film. The painter (utils/runFilm/painter.ts) draws a
 * step; the modal turns the steps into frames.
 */

export type FilmTickerKind = 'area' | 'skill' | 'bank' | 'boss' | 'other';

export interface FilmTickerLine {
  text: string;
  kind: FilmTickerKind;
}

export interface FilmStep {
  /** Day of the run, counting the first log line's day as day 1. */
  day: number;
  unlocks: number;
  rolls: number;
  keysWon: number;
  /** Chunks ("cx,cy") that open at this step. */
  added: string[];
  /** The newest unlock first, at most TICKER_LINES. */
  ticker: FilmTickerLine[];
}

export interface FilmTimeline {
  /** Chunks owned before the first log line (free land, the Chunked start). */
  start: string[];
  steps: FilmStep[];
  days: number;
  /** Areas the run unlocked that have no square on the world map (underground ones). */
  offMap: string[];
}

export interface FilmTimelineOptions {
  chunked: boolean;
  /** The run's Areas now. Anything the log missed opens at the last step, so the film ends on the live map. */
  finalRegions: readonly string[];
  /** The run's chunks now (Chunked). */
  finalChunks: readonly string[];
  /** Most steps a film gets; longer logs put several lines in a step. */
  maxSteps?: number;
}

export const TICKER_LINES = 12;
export const DEFAULT_MAX_STEPS = 420;
const DAY_MS = 86_400_000;

const chunkKeyOf = (c: { cx: number; cy: number }): string => `${c.cx},${c.cy}`;
const CHUNK_KEY = /^\d+,\d+$/;

/** Chunk → its named sub-area, as the world map paints them. */
const SUB_AREA_OF: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [sub, chunks] of Object.entries(SUB_AREA_CHUNKS)) for (const c of chunks) m[chunkKeyOf(c)] = sub;
  return m;
})();

/**
 * The chunks an area-based run (Vanilla and the other non-Chunked modes) owns
 * with these Areas: the same rule the OSRS layout's world map uses to cut its
 * fog (a chunk follows its sub-area when it has one, else its continent).
 */
export const ownedChunksForAreas = (regions: readonly string[]): Set<string> => {
  const list = [...regions];
  const owned = new Set<string>();
  for (const [region, chunks] of Object.entries(REGION_CHUNKS)) {
    const continentOpen = isRegionUnlocked(region, list);
    for (const c of chunks) {
      const key = chunkKeyOf(c);
      if (owned.has(key)) continue;
      const sub = SUB_AREA_OF[key];
      if (sub ? isRegionUnlocked(sub, list) : continentOpen) owned.add(key);
    }
  }
  return owned;
};

const tickerKind = (category: unknown): FilmTickerKind => {
  switch (category) {
    case 'Regions': case 'Chunks': return 'area';
    case 'Skills': return 'skill';
    case 'Banks': return 'bank';
    case 'Bosses': return 'boss';
    default: return 'other';
  }
};

const tickerText = (e: LogEntry): string => {
  const raw = e.message || String(e.meta?.item ?? '');
  return raw.replace(/^Unlocked\s+/, '').trim();
};

const regionsWithArea = new Set(Object.keys(SUB_AREA_CHUNKS));
const hasMapSquare = (area: string): boolean =>
  regionsWithArea.has(area) || Object.prototype.hasOwnProperty.call(REGION_CHUNKS, area);

export const buildFilmTimeline = (history: readonly LogEntry[], opts: FilmTimelineOptions): FilmTimeline => {
  const log = [...history].filter(e => Number.isFinite(e.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  const maxSteps = Math.max(1, opts.maxSteps ?? DEFAULT_MAX_STEPS);
  const perStep = Math.max(1, Math.ceil(log.length / maxSteps));
  const t0 = log[0]?.timestamp ?? 0;
  const dayOf = (ts: number) => Math.floor((ts - t0) / DAY_MS) + 1;

  const regions: string[] = [];
  const chunks = new Set<string>();
  const ownedNow = (): Set<string> => {
    if (!opts.chunked) return ownedChunksForAreas(regions);
    return new Set([CHUNKED_START_KEY, ...chunks]);
  };
  const start = ownedNow();
  let owned = new Set(start);
  const offMap = new Set<string>();
  const ticker: FilmTickerLine[] = [];
  const steps: FilmStep[] = [];
  let unlocks = 0, rolls = 0, keysWon = 0, landChanged = false;

  const pushStep = (day: number) => {
    let added: string[] = [];
    if (landChanged) {
      const next = ownedNow();
      added = [...next].filter(k => !owned.has(k));
      owned = next;
      landChanged = false;
    }
    steps.push({ day, unlocks, rolls, keysWon, added, ticker: ticker.slice(0, TICKER_LINES) });
  };

  log.forEach((e, i) => {
    if (isRollEntry(e)) rolls += 1;
    if (e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_OMNI' || e.type === 'PITY') keysWon += 1;
    const category = e.meta?.category;
    if (e.type === 'UNLOCK') {
      unlocks += 1;
      ticker.unshift({ text: tickerText(e), kind: tickerKind(category) });
      if (ticker.length > TICKER_LINES) ticker.length = TICKER_LINES;
      const item = typeof e.meta?.item === 'string' ? e.meta.item : '';
      if (category === 'Regions' && item && !regions.includes(item)) {
        regions.push(item);
        landChanged = true;
        if (!hasMapSquare(item)) offMap.add(item);
      }
      if (category === 'Chunks' && CHUNK_KEY.test(item)) { chunks.add(item); landChanged = true; }
    }
    // The Cartographer charts a chunk without an UNLOCK line.
    const charted = e.meta?.chunk;
    if (typeof charted === 'string' && CHUNK_KEY.test(charted)) { chunks.add(charted); landChanged = true; }
    if ((i + 1) % perStep === 0 || i === log.length - 1) pushStep(dayOf(e.timestamp));
  });

  // End on the live map: anything the log no longer shows (an old, trimmed or
  // imported history) opens at the last step.
  for (const r of opts.finalRegions) if (!regions.includes(r)) { regions.push(r); landChanged = true; }
  for (const c of opts.finalChunks) if (!chunks.has(c)) { chunks.add(c); landChanged = true; }
  if (landChanged) {
    const day = steps.length ? steps[steps.length - 1].day : 1;
    pushStep(day);
  }
  return {
    start: [...start],
    steps,
    days: steps.length ? steps[steps.length - 1].day : 1,
    offMap: [...offMap],
  };
};
