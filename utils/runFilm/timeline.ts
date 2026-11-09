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
  /** Skill levels (1..99) after this step, as the run logged them. */
  levels: Record<string, number>;
  totalLevel: number;
}

export interface FilmTimeline {
  /** Chunks owned before the first log line (free land, the Chunked start). */
  start: string[];
  /** The run as the film opens: before its first log line (day 1, nothing counted), or as it stood when the chosen first day began. */
  opening: FilmStep;
  steps: FilmStep[];
  /** The day the film ends on. */
  days: number;
  /** Whether the log or the run shows any skill levels, so the film can show them. */
  hasLevels: boolean;
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
  /** The run's skill levels now; the film ends on them. */
  finalLevels?: Readonly<Record<string, number>>;
  /** Most steps a film gets; longer logs put several lines in a step. */
  maxSteps?: number;
  /**
   * Film only these days of the run (day 1 is the first log line's day).
   * Everything before the first day is already in place when the film opens;
   * nothing after the last day is shown.
   */
  fromDay?: number;
  toDay?: number;
}

export interface FilmDay {
  day: number;
  /** When the run's first log line on that day was written. */
  firstAt: number;
  /** Log lines on that day. */
  lines: number;
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

const MAX_LEVEL = 99;
/** The lowest level a skill can be: 10 for Hitpoints, 1 for the rest. */
const minLevel = (skill: string): number => (skill === FREE_SKILL ? 10 : 1);
/** A skill level a log line records (a level-up's roll, a capped level, a synced level), or null. */
const loggedLevel = (e: LogEntry): { skill: string; level: number } | null => {
  const skill = e.meta?.skill, level = Number(e.meta?.level);
  if (typeof skill !== 'string' || !SKILLS_LIST.includes(skill) || !Number.isFinite(level)) return null;
  return { skill, level: Math.min(MAX_LEVEL, Math.max(minLevel(skill), Math.floor(level))) };
};
const sumLevels = (levels: Readonly<Record<string, number>>): number => Object.values(levels).reduce((a, b) => a + b, 0);

const sortedLog = (history: readonly LogEntry[]): LogEntry[] =>
  [...history].filter(e => Number.isFinite(e.timestamp)).sort((a, b) => a.timestamp - b.timestamp);

/** The days of the run that have log lines, for picking where a film starts and ends. */
export const filmDays = (history: readonly LogEntry[]): FilmDay[] => {
  const log = sortedLog(history);
  const t0 = log[0]?.timestamp ?? 0;
  const days: FilmDay[] = [];
  for (const e of log) {
    const day = Math.floor((e.timestamp - t0) / DAY_MS) + 1;
    const last = days[days.length - 1];
    if (last?.day === day) last.lines += 1;
    else days.push({ day, firstAt: e.timestamp, lines: 1 });
  }
  return days;
};

/**
 * How a film's frames map to its steps: `lead` frames on the opening, then
 * the steps spread over `stepFrames` (a slow film holds each step for several
 * frames, a fast one has fewer, fuller steps), then `hold` frames on the last.
 */
export const filmFramePlan = (steps: number, stepFrames: number, lead: number, hold: number) => {
  const span = Math.max(1, stepFrames, steps);
  return {
    total: lead + span + hold,
    /** The step a frame shows, or -1 for the opening. */
    stepAt: (i: number): number => {
      if (!steps || i < lead) return -1;
      return Math.min(steps - 1, Math.floor(((i - lead) * steps) / span));
    },
  };
};

const regionsWithArea = new Set(Object.keys(SUB_AREA_CHUNKS));
const hasMapSquare = (area: string): boolean =>
  regionsWithArea.has(area) || Object.prototype.hasOwnProperty.call(REGION_CHUNKS, area);

export const buildFilmTimeline = (history: readonly LogEntry[], opts: FilmTimelineOptions): FilmTimeline => {
  const log = sortedLog(history);
  const t0 = log[0]?.timestamp ?? 0;
  const dayOf = (ts: number) => Math.floor((ts - t0) / DAY_MS) + 1;
  const lastDay = log.length ? dayOf(log[log.length - 1].timestamp) : 1;
  const fromDay = Math.max(1, Math.floor(opts.fromDay ?? 1));
  const toDay = Math.max(fromDay, Math.floor(opts.toDay ?? lastDay));
  // The film's own lines; the ones before it only set the scene.
  const before = log.filter(e => dayOf(e.timestamp) < fromDay).length;
  const shown = log.filter(e => { const d = dayOf(e.timestamp); return d >= fromDay && d <= toDay; }).length;
  const reachesEnd = toDay >= lastDay;
  const maxSteps = Math.max(1, opts.maxSteps ?? DEFAULT_MAX_STEPS);
  const perStep = Math.max(1, Math.ceil(shown / maxSteps));

  const regions: string[] = [];
  const chunks = new Set<string>();
  const ownedNow = (): Set<string> => {
    if (!opts.chunked) return ownedChunksForAreas(regions);
    return new Set([CHUNKED_START_KEY, ...chunks]);
  };
  let start = ownedNow();
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

  // Levels: each skill starts one below the first level the log records for
  // it (the log records every level-up's roll), or where it is now when the
  // log never mentions it.
  const finalLevels: Record<string, number> = Object.fromEntries(SKILLS_LIST.map(n => {
    const v = Number(opts.finalLevels?.[n]);
    return [n, Number.isFinite(v) ? Math.min(MAX_LEVEL, Math.max(minLevel(n), Math.floor(v))) : minLevel(n)];
  }));
  const levels: Record<string, number> = { ...finalLevels };
  const seenLevel = new Set<string>();
  for (const e of log) {
    const lv = loggedLevel(e);
    if (!lv || seenLevel.has(lv.skill)) continue;
    seenLevel.add(lv.skill);
    levels[lv.skill] = Math.max(minLevel(lv.skill), lv.level - 1);
  }
  const hasLevels = seenLevel.size > 0 || SKILLS_LIST.some(n => finalLevels[n] > minLevel(n));

  const snapshot = (day: number, added: string[]): FilmStep => ({
    day, unlocks, rolls, keysWon, added, ticker: ticker.slice(0, TICKER_LINES),
    skills: { ...skills }, gear: { ...gear }, raised, levels: { ...levels }, totalLevel: sumLevels(levels),
  });
  let opening: FilmStep = snapshot(1, []);

  const pushStep = (day: number) => {
    let added: string[] = [];
    if (landChanged) {
      const next = ownedNow();
      added = [...next].filter(k => !owned.has(k));
      owned = next;
      landChanged = false;
    }
    steps.push(snapshot(day, added));
    raised = [];
  };

  let inFilm = 0;
  log.forEach((e, i) => {
    const day = dayOf(e.timestamp);
    if (day > toDay) return;
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
    const lv = loggedLevel(e);
    if (lv && lv.level > levels[lv.skill]) levels[lv.skill] = lv.level;

    if (i + 1 === before) {
      // The last line before the film: the film opens on the run as it stood.
      start = ownedNow();
      owned = new Set(start);
      landChanged = false;
      raised = [];
      offMap.clear();
      opening = snapshot(fromDay, []);
      return;
    }
    if (i < before) return;
    inFilm += 1;
    if (inFilm % perStep === 0 || inFilm === shown) pushStep(day);
  });

  // End on the live map: anything the log no longer shows (an old, trimmed or
  // imported history) opens at the last step. A film that stops before the
  // run's last day ends where the log is on that day instead.
  let tiersChanged = false;
  if (reachesEnd) {
    for (const r of opts.finalRegions) if (!regions.includes(r)) { regions.push(r); landChanged = true; }
    for (const c of opts.finalChunks) if (!chunks.has(c)) { chunks.add(c); landChanged = true; }
    for (const [list, now, kind] of [[skills, finalSkills, 'skill'], [gear, finalGear, 'gear']] as const) {
      if (!now) continue;
      for (const [name, tier] of Object.entries(now)) {
        if (list[name] === tier) continue;
        if (tier > list[name]) raised.push(`${kind}:${name}`);
        list[name] = tier;
        tiersChanged = true;
      }
    }
    if (opts.finalLevels) {
      for (const n of SKILLS_LIST) {
        if (finalLevels[n] > levels[n]) { levels[n] = finalLevels[n]; tiersChanged = true; }
      }
    }
  }
  if (landChanged || tiersChanged) {
    const day = steps.length ? steps[steps.length - 1].day : opening.day;
    pushStep(day);
  }
  return {
    start: [...start],
    opening,
    steps,
    days: steps.length ? steps[steps.length - 1].day : opening.day,
    hasLevels,
    offMap: [...offMap],
  };
};
