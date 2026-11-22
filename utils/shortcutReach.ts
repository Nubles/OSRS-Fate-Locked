/**
 * Agility/travel shortcut reachability.
 *
 * Each shortcut (from the picker's challenge tables) has a skill level and the
 * object you interact with; a multi-skill shortcut (a mith grapple) has one
 * table row per skill. A shortcut is usable when you have every level (under
 * the tier cap model), any quest it needs, and the object sits in an unlocked chunk.
 */

import { UnlockState } from '../types';
import { Shortcut } from '../services/ChunkContentService';
import { tierForLevel } from './skillTiers';

export type ShortcutStatus = 'ready' | 'level' | 'quest' | 'area-locked' | 'no-location';

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
  loc: { cx: number; cy: number; unlocked: boolean } | null;
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
export type LocateFn = (s: Shortcut) => { cx: number; cy: number; unlocked: boolean } | null;

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
    const unfinished = (SHORTCUT_QUESTS[main.name] ?? []).filter(q => !done.has(q));
    const quest = unfinished.length > 0 ? unfinished.join(' and ') : null;
    const loc = locate(main);

    let status: ShortcutStatus;
    if (!loc) status = 'no-location';
    else if (missing.length > 0) status = 'level';
    else if (quest) status = 'quest';
    else if (!loc.unlocked) status = 'area-locked';
    else status = 'ready';

    return { name: main.name, skill: main.skill, level: main.level, requirements, missing, quest, status, loc };
  });

  rows.sort((a, b) =>
    Number(b.status === 'ready') - Number(a.status === 'ready') ||
    a.level - b.level ||
    a.name.localeCompare(b.name));

  return { rows, ready: rows.filter(r => r.status === 'ready').length, total: rows.length };
}
