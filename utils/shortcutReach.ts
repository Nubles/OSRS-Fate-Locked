/**
 * Agility/travel shortcut reachability.
 *
 * Each shortcut (from the picker's challenge tables) has a skill level and the
 * object you interact with. A shortcut is usable when you have the level (under
 * the tier cap model) and the object sits in an unlocked chunk.
 */

import { UnlockState } from '../types';
import { Shortcut } from '../services/ChunkContentService';
import { tierForLevel } from './skillTiers';

export type ShortcutStatus = 'ready' | 'level' | 'area-locked' | 'no-location';

export interface ShortcutRow {
  name: string;
  skill: string;
  level: number;
  status: ShortcutStatus;
  loc: { cx: number; cy: number; unlocked: boolean } | null;
}

export interface ShortcutReach {
  rows: ShortcutRow[];
  ready: number;
  total: number;
}

/** Resolve a shortcut to a representative chunk via its trigger object(s). */
export type LocateFn = (s: Shortcut) => { cx: number; cy: number; unlocked: boolean } | null;

export function shortcutReachability(shortcuts: Shortcut[], unlocks: UnlockState, locate: LocateFn): ShortcutReach {
  const rows: ShortcutRow[] = shortcuts.map(s => {
    const tier = unlocks.skills?.[s.skill] ?? 0;
    const lvl = unlocks.levels?.[s.skill] ?? 1;
    const levelMet = tier >= tierForLevel(s.level) && lvl >= s.level;
    const loc = locate(s);

    let status: ShortcutStatus;
    if (!loc) status = 'no-location';
    else if (!levelMet) status = 'level';
    else if (!loc.unlocked) status = 'area-locked';
    else status = 'ready';

    return { name: s.name, skill: s.skill, level: s.level, status, loc };
  });

  rows.sort((a, b) =>
    Number(b.status === 'ready') - Number(a.status === 'ready') ||
    a.level - b.level ||
    a.name.localeCompare(b.name));

  return { rows, ready: rows.filter(r => r.status === 'ready').length, total: rows.length };
}
