import type { LogEntry } from '../../types';
import { REGION_CHUNKS } from '../../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../../data/subAreaChunks';
import { isRegionUnlocked } from '../reachability';
import { CHUNKED_START_KEY } from '../chunkAdjacency';
import { isRollEntry } from '../logEntry';
import { EQUIPMENT_SLOTS, SKILLS_LIST } from '../../data/items';
import { EQUIPMENT_TIER_MAX } from '../../config/rules';

/**
 * Run Film: the run's log played back as map steps. Pure, so the same log
 * always makes the same film. The painter (utils/runFilm/painter.ts) draws a
 * step; the modal turns the steps into frames.
 */

export type FilmTickerKind = 'area' | 'skill' | 'gear' | 'bank' | 'boss' | 'other';

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
  /** Skill tiers (0..10) after this step. */
  skills: Record<string, number>;
  /** Equipment slot tiers (0..9) after this step. */
  gear: Record<string, number>;
  /** Tiers that went up at this step, as "skill:Name" or "gear:Slot", so they can flash. */
  raised: string[];
}

export interface FilmTimeline {
  /** Chunks owned before the first log line (free land, the Chunked start). */
  start: string[];
  /** The run before its first log line: day 1, nothing counted, the starting tiers. */
  opening: FilmStep;
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
  /** The run's skill tiers now; the film ends on them. */
  finalSkills?: Readonly<Record<string, number>>;
  /** The run's equipment tiers now. */
  finalGear?: Readonly<Record<string, number>>;
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
    case 'Equipment': return 'gear';
    case 'Banks': return 'bank';
    case 'Bosses': return 'boss';
    default: return 'other';
  }
};

const tickerText = (e: LogEntry): string => {
  const raw = e.message || String(e.meta?.item ?? '');
  return raw.replace(/^Unlocked\s+/, '').trim();
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** Tier numerals, as the tracker's tier marks draw them. */
export const romanTier = (t: number): string => ROMAN[Math.min(Math.max(Math.round(t), 1), ROMAN.length) - 1];

/** Hitpoints is free in every run (all its tiers), so the film never counts it. */
const FREE_SKILL = 'Hitpoints';
const SKILL_TIER_MAX = 10;

const tierRecord = (names: readonly string[], from: Readonly<Record<string, number>> | undefined, max: number): Record<string, number> =>
  Object.fromEntries(names.map(n => [n, Math.min(max, Math.max(0, Math.floor(Number(from?.[n]) || 0)))]));

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

  // Tiers: the run's tiers now, less every tier the log shows it buying, is
  // where it started. Hitpoints starts (and stays) where it is now.
  // Without the run's tiers now, everything starts at 0 and only the log counts.
  const finalSkills = opts.finalSkills ? tierRecord(SKILLS_LIST, opts.finalSkills, SKILL_TIER_MAX) : null;
  const finalGear = opts.finalGear ? tierRecord(EQUIPMENT_SLOTS, opts.finalGear, EQUIPMENT_TIER_MAX) : null;
  const bought = { skills: {} as Record<string, number>, gear: {} as Record<string, number> };
  for (const e of log) {
    if (e.type !== 'UNLOCK' || typeof e.meta?.item !== 'string') continue;
    const item = e.meta.item;
    if (e.meta.category === 'Skills' && SKILLS_LIST.includes(item) && item !== FREE_SKILL) bought.skills[item] = (bought.skills[item] ?? 0) + 1;
    if (e.meta.category === 'Equipment' && EQUIPMENT_SLOTS.includes(item)) bought.gear[item] = (bought.gear[item] ?? 0) + 1;
  }
  const skills: Record<string, number> = Object.fromEntries(SKILLS_LIST.map(n => [n, Math.max(0, (finalSkills?.[n] ?? 0) - (bought.skills[n] ?? 0))]));
  const gear: Record<string, number> = Object.fromEntries(EQUIPMENT_SLOTS.map(n => [n, Math.max(0, (finalGear?.[n] ?? 0) - (bought.gear[n] ?? 0))]));
  let raised: string[] = [];
  const opening: FilmStep = { day: 1, unlocks: 0, rolls: 0, keysWon: 0, added: [], ticker: [], skills: { ...skills }, gear: { ...gear }, raised: [] };

  const pushStep = (day: number) => {
    let added: string[] = [];
    if (landChanged) {
      const next = ownedNow();
      added = [...next].filter(k => !owned.has(k));
      owned = next;
      landChanged = false;
    }
    steps.push({ day, unlocks, rolls, keysWon, added, ticker: ticker.slice(0, TICKER_LINES), skills: { ...skills }, gear: { ...gear }, raised });
    raised = [];
  };

  log.forEach((e, i) => {
    if (isRollEntry(e)) rolls += 1;
    if (e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_OMNI' || e.type === 'PITY') keysWon += 1;
    const category = e.meta?.category;
    if (e.type === 'UNLOCK') {
      unlocks += 1;
      const item = typeof e.meta?.item === 'string' ? e.meta.item : '';
      let text = tickerText(e);
      if (category === 'Skills' && item in skills && item !== FREE_SKILL && skills[item] < SKILL_TIER_MAX) {
        skills[item] += 1;
        raised.push(`skill:${item}`);
        text = `${item} ${romanTier(skills[item])}`;
      }
      if (category === 'Equipment' && item in gear && gear[item] < EQUIPMENT_TIER_MAX) {
        gear[item] += 1;
        raised.push(`gear:${item}`);
        text = `${item} ${romanTier(gear[item])}`;
      }
      ticker.unshift({ text, kind: tickerKind(category) });
      if (ticker.length > TICKER_LINES) ticker.length = TICKER_LINES;
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
  let tiersChanged = false;
  for (const [list, now, kind] of [[skills, finalSkills, 'skill'], [gear, finalGear, 'gear']] as const) {
    if (!now) continue;
    for (const [name, tier] of Object.entries(now)) {
      if (list[name] === tier) continue;
      if (tier > list[name]) raised.push(`${kind}:${name}`);
      list[name] = tier;
      tiersChanged = true;
    }
  }
  if (landChanged || tiersChanged) {
    const day = steps.length ? steps[steps.length - 1].day : 1;
    pushStep(day);
  }
  return {
    start: [...start],
    opening,
    steps,
    days: steps.length ? steps[steps.length - 1].day : 1,
    offMap: [...offMap],
  };
};
