/**
 * Agility/travel shortcut reachability.
 *
 * Each shortcut (from the picker's challenge tables) has a skill level and the
 * object you interact with; a multi-skill shortcut (a mith grapple) has one
 * table row per skill. A shortcut is usable when you have every level (under
 * the tier cap model), any quest or diary it needs, and the object sits in an unlocked
 * chunk a route reaches.
 */

import { UnlockState } from '../types';
import type { EntityKind, Shortcut } from '../services/ChunkContentService';
import { tierForLevel } from './skillTiers';
import { chunkForPlace, chunkUnlocked, placeOf } from './chunkLocations';
import { canonicalAreaName } from '../data/areaMapPolicy';
import type { AreaRoutes } from './areaRoutes';
import { unfinishedEntryQuests } from './chunkEntry';
import { hasDiaryTier } from './travelDecisions';

export type ShortcutStatus = 'ready' | 'level' | 'quest' | 'diary' | 'area-locked' | 'no-route' | 'no-location';

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
  /** The Achievement Diary tier(s) still to finish, for status 'diary' ("Falador Hard diary"). */
  diary: string | null;
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
 * 22 November 2026, and each shortcut's own page, checked 24 November 2026),
 * keyed by the shortcut's name in the picker's tables. Partial-completion
 * requirements are not listed here; a quest that opens the shortcut's chunk
 * comes from the chunk content as well (ShortcutLoc.entryQuests).
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
  // Ornate railing.
  'Access the Temple on the Salve to Morytania shortcut': ['Priest in Peril'],
  // Rocks (Tirannwn): all three need Regicide.
  'Access the Arandar easy cliffside scramble shortcut': ['Regicide'],
  'Access the Arandar medium cliffside scramble shortcut': ['Regicide'],
  'Access the Arandar advanced cliffside scramble shortcut': ['Regicide'],
  // Bush, Pillar and Rockslide (Vampyrium).
  'Access the Vampyrium forest crawl shortcut': ['The Blood Moon Rises'],
  'Access the Vampyrium pillar jumping shortcut': ['The Blood Moon Rises'],
  'Access the Vampyrium rock slides shortcut': ['The Blood Moon Rises'],
  // Rocks (Darkmeyer), on Castle Drakan's northern walls.
  'Access the Castle Drakan wall rock climb shortcut': ['Sins of the Father'],
  // Cave (Stalker Den).
  'Access the cave to the Stalker Den shortcut': ['Shadows of Custodia'],
  // Crevice (Heroes' Guild); it needs the Falador hard diary too.
  "Access the Heroes' Guild tunnel shortcut": ["Heroes' Quest"],
};

/**
 * Shortcuts that also need an Achievement Diary tier (each shortcut's OSRS
 * Wiki page, checked 24 November 2026), as DIARY_DATA names them. A higher
 * tier of the same diary counts (hasDiaryTier).
 */
export const SHORTCUT_DIARIES: Readonly<Record<string, readonly string[]>> = {
  // Tight-gap (Goblin Village).
  'Access the scale Goblin Village wall shortcut': ['Falador Easy'],
  // Crevice (Deep Wilderness Dungeon).
  'Access the Deep Wilderness Dungeon narrow shortcut': ['Wilderness Medium'],
  // Dark tunnel (Motherlode Mine): the medium reward, which needs the easy tier first.
  'Access the Motherlode Mine eastern wall shortcut': ['Falador Medium'],
  // Crevice (Heroes' Guild).
  "Access the Heroes' Guild tunnel shortcut": ['Falador Hard'],
  // Crevice (Kalphite Lair).
  'Access the Kalphite Lair wall shortcut': ['Desert Elite'],
};

/** The quests and diary tiers a shortcut still needs, its chunk's entry quests included. */
export function shortcutGates(name: string, unlocks: UnlockState, entryQuests: readonly string[] = []): { quests: string[]; diaries: string[] } {
  const done = new Set(unlocks.quests ?? []);
  return {
    quests: [...new Set([...(SHORTCUT_QUESTS[name] ?? []), ...entryQuests])].filter(q => !done.has(q)),
    diaries: (SHORTCUT_DIARIES[name] ?? []).filter(d => !hasDiaryTier(unlocks.diaries ?? [], d)),
  };
}

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

/** No chunk content to hand: shortcuts are placed by their chunk ids and place names alone. */
const NO_CONTENT: ShortcutContent = {
  shortcuts: () => [], entityLocations: () => null, interiorEntranceChunks: () => [], chunkEntryRequirements: () => [],
};

const byChunkCache = new WeakMap<readonly Shortcut[], WeakMap<ShortcutContent, Map<string, Shortcut[]>>>();

/**
 * The shortcuts at each chunk ("cx,cy"), every table row of a shortcut
 * together, placed where the panels place it (shortcutPlaces of its main row).
 * The RuneLite chunk details read it; cached per shortcut list and content.
 */
export function shortcutsByChunk(shortcuts: readonly Shortcut[], content: ShortcutContent = NO_CONTENT): Map<string, Shortcut[]> {
  let perContent = byChunkCache.get(shortcuts);
  const cached = perContent?.get(content);
  if (cached) return cached;
  const groups = new Map<string, Shortcut[]>();
  for (const s of shortcuts) {
    const group = groups.get(s.name);
    if (group) group.push(s);
    else groups.set(s.name, [s]);
  }
  const byChunk = new Map<string, Shortcut[]>();
  for (const group of groups.values()) {
    const main = group.find(s => s.skill === 'Agility') ?? group[0];
    for (const { cx, cy } of shortcutPlaces(main, content)) {
      const key = `${cx},${cy}`;
      byChunk.set(key, [...(byChunk.get(key) ?? []), ...group]);
    }
  }
  if (!perContent) byChunkCache.set(shortcuts, perContent = new WeakMap());
  perContent.set(content, byChunk);
  return byChunk;
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
    const gates = shortcutGates(main.name, unlocks, loc?.entryQuests);
    const quest = gates.quests.length > 0 ? gates.quests.join(' and ') : null;
    const diary = gates.diaries.length > 0 ? `${gates.diaries.join(' and ')} diary` : null;

    let status: ShortcutStatus;
    if (!loc) status = 'no-location';
    else if (missing.length > 0) status = 'level';
    else if (quest) status = 'quest';
    else if (diary) status = 'diary';
    else if (!loc.unlocked) status = 'area-locked';
    else if (loc.stranded) status = 'no-route';
    else status = 'ready';

    return { name: main.name, skill: main.skill, level: main.level, requirements, missing, quest, diary, status, loc };
  });

  rows.sort((a, b) =>
    Number(b.status === 'ready') - Number(a.status === 'ready') ||
    a.level - b.level ||
    a.name.localeCompare(b.name));

  return { rows, ready: rows.filter(r => r.status === 'ready').length, total: rows.length };
}
