/**
 * Agility/travel shortcut reachability.
 *
 * Each shortcut (from the picker's challenge tables) has a skill level and the
 * object you interact with; a multi-skill shortcut (a mith grapple) has one
 * table row per skill. A shortcut is usable when you have every level (under
 * the tier cap model), any quest it needs, and the object sits in an unlocked
 * chunk a route reaches.
 */

import { UnlockState } from '../types';
import type { EntityKind, Shortcut } from '../services/ChunkContentService';
import { tierForLevel } from './skillTiers';
import { chunkForPlace, chunkUnlocked, placeOf } from './chunkLocations';
import { canonicalAreaName } from '../data/areaMapPolicy';
import type { AreaRoutes } from './areaRoutes';
import { unfinishedEntryQuests } from './chunkEntry';

export type ShortcutStatus = 'ready' | 'level' | 'quest' | 'area-locked' | 'no-route' | 'no-location';

export interface ShortcutNeed {
  skill: string;
  level: number;
}

export interface ShortcutRow {
  name: string;
  /** The shortcut's main skill (Agility when it has one) and its level. */
  skill: string;
  level: number;
  /** Every skill level the shortcut needs (a mith grapple needs Agility, Ranged and Strength). */
  requirements: ShortcutNeed[];
  /** The levels still missing, for status 'level'. */
  missing: ShortcutNeed[];
  /** The quest(s) still to finish, joined with "and", for status 'quest'. */
  quest: string | null;
  status: ShortcutStatus;
  loc: ShortcutLoc | null;
}

/** Where a shortcut is judged: a chunk, whether the run owns it, and whether a route reaches it. */
export interface ShortcutLoc {
  cx: number;
  cy: number;
  unlocked: boolean;
  /** Owned, but no route from the run's start reaches it (utils/areaRoutes.ts). */
  stranded?: boolean;
  /** Quests the chunk's entry needs that the run hasn't finished (chunk content questSections). */
  entryQuests?: string[];
}

export interface ShortcutReach {
  rows: ShortcutRow[];
  ready: number;
  total: number;
}

/**
 * Shortcuts that also need a finished quest (OSRS Wiki "Shortcuts", checked
 * 22 November 2026), keyed by the shortcut's name in the picker's tables.
 * Partial-completion and diary requirements are not listed here.
 */
export const SHORTCUT_QUESTS: Readonly<Record<string, readonly string[]>> = {
  'Access the Corsair Cove Dungeon shortcut': ['Dragon Slayer I'],
  'Access the rocks in the Corsair Cove Resource Area shortcut': ['Dragon Slayer I'],
  'Access the rock climb in the Temple of the Eye shortcut': ['Temple of the Eye'],
  'Access the Al Kharid Palace southern window shortcut': ['Prince Ali Rescue'],
  "Access the eastern Gu'Tanoth shortcut": ['Watchtower'],
  'Access the Troll Stronghold wall-climb shortcut': ["My Arm's Big Adventure"],
  'Access the island crossing near Zul-Andra shortcut': ['Regicide'],
  'Access the Shilo Village rocks shortcut': ['Shilo Village'],
  'Access the Kharazi Jungle vine climb shortcut': ["Legends' Quest"],
  'Access the Viyeldi caves shortcut': ["Legends' Quest"],
  'Access the Shaman Caves crevice shortcut': ["Legends' Quest"],
  'Access the Varrock Palace Garden trellis shortcut': ['Garden of Tranquillity'],
  'Access the (mith grapple) scale the Observatory cliff shortcut': ['Observatory Quest'],
  'Access the Darkmeyer north-eastern wall shortcut': ['Sins of the Father'],
  'Access the Gnome Stronghold shortcut': ['The Grand Tree', 'Tree Gnome Village'],
};

/** Resolve a shortcut to a representative chunk via its trigger object(s). */
export type LocateFn = (s: Shortcut) => ShortcutLoc | null;

type Coord = { cx: number; cy: number };

/** What the shortcut helpers read from the chunk content (chunkContentService). */
export interface ShortcutContent {
  shortcuts(): Shortcut[];
  entityLocations(name: string, kinds?: EntityKind[]): { locations: readonly Coord[] } | null;
  interiorEntranceChunks(keyOrName: string): Coord[];
  chunkEntryRequirements(cx: number, cy: number): string[];
}

/** A chunk id as the tables write it: cx * 256 + cy, sometimes with a "-N" suffix. */
const CHUNK_ID = /^(\d+)(?:-\d+)?$/;

/**
 * Every chunk a shortcut may be at: where its object is, or else each entry of
 * its chunk list, read as a chunk id, then as an interior (the chunks it is
 * entered from), then as a place name. Entries none of these know (the
 * picker's "[+]" markers) are skipped.
 */
export function shortcutPlaces(s: Shortcut, content: ShortcutContent): Coord[] {
  for (const obj of s.objects) {
    const hit = content.entityLocations(obj, ['object']);
    if (hit && hit.locations.length) return hit.locations.map(({ cx, cy }) => ({ cx, cy }));
  }
  const places: Coord[] = [];
  const seen = new Set<string>();
  for (const entry of s.chunks) {
    const id = CHUNK_ID.exec(entry);
    let found: Coord[] = id ? [{ cx: Math.floor(Number(id[1]) / 256), cy: Number(id[1]) % 256 }] : content.interiorEntranceChunks(entry);
    if (!found.length) {
      const place = chunkForPlace(entry);
      found = place ? [place] : [];
    }
    for (const coord of found) {
      const key = `${coord.cx},${coord.cy}`;
      if (!seen.has(key)) { seen.add(key); places.push(coord); }
    }
  }
  return places;
}

/**
 * An owned chunk no route reaches: in Chunked the chunk itself, elsewhere its
 * area, as the Quest Log and Diary Journal judge it. False without routes
 * (still loading), so owning the place is enough until they arrive.
 */
const strandedAt = (cx: number, cy: number, gameModeId: string | undefined, routes: AreaRoutes | null | undefined): boolean => {
  if (!routes) return false;
  if (gameModeId === 'chunked') return routes.strandedChunks.has(`${cx},${cy}`);
  const place = placeOf(cx, cy);
  const area = place.subArea ?? place.region;
  return !!area && routes.strandedAreas.has(canonicalAreaName(area));
};

/**
 * The panels' locate: of a shortcut's places, the best for the run (owned,
 * then with no unfinished entry quest, then reached by a route), else the first. Both Agility Shortcuts panels
 * judge with it. `routes` comes from useAreaRoutes; null while it loads.
 */
export function shortcutLocator(
  content: ShortcutContent,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  routes: AreaRoutes | null | undefined,
): LocateFn {
  const rank = (loc: ShortcutLoc) => (loc.unlocked ? 4 : 0) + (loc.entryQuests?.length ? 0 : 2) + (loc.stranded ? 0 : 1);
  return (s) => {
    let best: ShortcutLoc | null = null;
    for (const { cx, cy } of shortcutPlaces(s, content)) {
      const unlocked = chunkUnlocked(cx, cy, unlocks, gameModeId);
      const loc: ShortcutLoc = {
        cx, cy, unlocked,
        stranded: unlocked && strandedAt(cx, cy, gameModeId, routes),
        entryQuests: unfinishedEntryQuests(content.chunkEntryRequirements(cx, cy), unlocks),
      };
      if (!best || rank(loc) > rank(best)) best = loc;
    }
    return best;
  };
}

/** Every shortcut of the chunk content, judged for this run. */
export function runShortcutReach(
  content: ShortcutContent,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  routes: AreaRoutes | null | undefined,
): ShortcutReach {
  return shortcutReachability(content.shortcuts(), unlocks, shortcutLocator(content, unlocks, gameModeId, routes));
}

export function shortcutReachability(shortcuts: Shortcut[], unlocks: UnlockState, locate: LocateFn): ShortcutReach {
  // The tables list a multi-skill shortcut once per skill: judge it once, on all of them.
  const groups = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const group = groups.get(s.name);
    if (group) group.push(s);
    else groups.set(s.name, [s]);
  }
  const done = new Set(unlocks.quests ?? []);
  const rows: ShortcutRow[] = [...groups.values()].map(group => {
    const main = group.find(s => s.skill === 'Agility') ?? group[0];
    const requirements = group.map(s => ({ skill: s.skill, level: s.level }));
    const missing = requirements.filter(({ skill, level }) => {
      const tier = unlocks.skills?.[skill] ?? 0;
      const lvl = unlocks.levels?.[skill] ?? 1;
      return !(tier >= tierForLevel(level) && lvl >= level);
    });
    const loc = locate(main);
    // The shortcut's own quests, then any its chunk's entry needs.
    const unfinished = [...new Set([...(SHORTCUT_QUESTS[main.name] ?? []), ...(loc?.entryQuests ?? [])])].filter(q => !done.has(q));
    const quest = unfinished.length > 0 ? unfinished.join(' and ') : null;

    let status: ShortcutStatus;
    if (!loc) status = 'no-location';
    else if (missing.length > 0) status = 'level';
    else if (quest) status = 'quest';
    else if (!loc.unlocked) status = 'area-locked';
    else if (loc.stranded) status = 'no-route';
    else status = 'ready';

    return { name: main.name, skill: main.skill, level: main.level, requirements, missing, quest, status, loc };
  });

  rows.sort((a, b) =>
    Number(b.status === 'ready') - Number(a.status === 'ready') ||
    a.level - b.level ||
    a.name.localeCompare(b.name));

  return { rows, ready: rows.filter(r => r.status === 'ready').length, total: rows.length };
}
