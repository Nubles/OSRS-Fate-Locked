/**
 * Achievements & milestones engine.
 *
 * A pure, side-effect-free catalogue of run milestones plus an evaluator that
 * scores each one against the current `unlocks` snapshot. The UI (modal +
 * celebratory reveal) is a thin layer over `evaluateAchievements`.
 *
 * Each achievement exposes a `progress(unlocks) -> { current, target }` so the
 * same definition drives both the earned/locked state AND a progress bar for
 * the ones still in flight.
 */

import { UnlockState } from '../types';
import {
  SKILLS_LIST, REGIONS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX,
} from '../constants';
import { completionPercent } from './completion';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { CA_DATA } from '../data/caData';
import { visibleAreaUnlocks } from '../data/areaMapPolicy';

export type AchievementCategory =
  | 'Quests' | 'Skills' | 'Regions' | 'Equipment'
  | 'Diaries' | 'Combat' | 'Activities' | 'Collection' | 'Mastery';

export type AchievementIcon =
  | 'quest' | 'skill' | 'region' | 'equipment' | 'diary'
  | 'combat' | 'boss' | 'minigame' | 'collection' | 'trophy'
  | 'crown' | 'star' | 'map' | 'sparkles' | 'flame';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIcon;
  /** Current/target progress for this snapshot. Earned when current >= target. */
  progress: (u: UnlockState) => { current: number; target: number };
}

export interface EvaluatedAchievement extends Achievement {
  current: number;
  target: number;
  earned: boolean;
  /** 0..100 capped. */
  pct: number;
}

// ── Totals (derived once from the data sets) ───────────────────────────────
const TOTAL_QUESTS = Object.keys(QUEST_DATA).length;
const TOTAL_DIARIES = Object.keys(DIARY_DATA).length;
const TOTAL_CA = Object.keys(CA_DATA).length;
const TOTAL_SKILLS = SKILLS_LIST.length;
const TOTAL_REGIONS = REGIONS_LIST.length;
const TOTAL_EQUIP_SLOTS = EQUIPMENT_SLOTS.length;

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

// ── Metric helpers ─────────────────────────────────────────────────────────
const questsDone = (u: UnlockState) => u.quests.length;
const questPoints = (u: UnlockState) =>
  u.quests.reduce((acc, qid) => acc + (QUEST_DATA[qid]?.points ?? 0), 0);
const skillsStarted = (u: UnlockState) =>
  Object.values(u.skills).filter((t) => t > 0).length;
const skillTiers = (u: UnlockState) => sum(Object.values(u.skills));
const skillsAt99 = (u: UnlockState) =>
  Object.values(u.levels).filter((l) => l >= 99).length;
const equipUnlocked = (u: UnlockState) =>
  EQUIPMENT_SLOTS.filter((s) => (u.equipment[s] || 0) > 0).length;
const equipMaxed = (u: UnlockState) =>
  EQUIPMENT_SLOTS.filter((s) => (u.equipment[s] || 0) >= EQUIPMENT_TIER_MAX).length;
const collectionItems = (u: UnlockState) =>
  Object.values(u.collectionLog || {}).filter((c) => c > 0).length;

/** Overall completion % — the single shared metric (utils/completion), re-exported. */
export { completionPercent };

// ── Tiered-achievement builder ─────────────────────────────────────────────
function tiers(
  baseId: string,
  category: AchievementCategory,
  defaultIcon: AchievementIcon,
  metric: (u: UnlockState) => number,
  steps: Array<{ title: string; description: string; target: number; icon?: AchievementIcon }>,
): Achievement[] {
  return steps.map((s) => ({
    id: `${baseId}-${s.target}`,
    title: s.title,
    description: s.description,
    category,
    icon: s.icon ?? defaultIcon,
    progress: (u: UnlockState) => ({ current: metric(u), target: s.target }),
  }));
}

// ── The catalogue ──────────────────────────────────────────────────────────
export const ACHIEVEMENTS: Achievement[] = [
  // Quests
  ...tiers('quests', 'Quests', 'quest', questsDone, [
    { title: 'First Steps', description: 'Complete your first quest', target: 1 },
    { title: 'Adventurer', description: 'Complete 10 quests', target: 10 },
    { title: 'Seasoned Hero', description: 'Complete 25 quests', target: 25 },
    { title: 'Veteran', description: 'Complete 50 quests', target: 50 },
    { title: 'Quest Cape', description: 'Complete every quest', target: TOTAL_QUESTS, icon: 'crown' },
  ]),
  ...tiers('qp', 'Quests', 'star', questPoints, [
    { title: 'Point Collector', description: 'Earn 50 Quest Points', target: 50 },
    { title: 'Point Hoarder', description: 'Earn 150 Quest Points', target: 150 },
  ]),

  // Skills
  ...tiers('skills-start', 'Skills', 'skill', skillsStarted, [
    { title: 'Apprentice', description: 'Unlock your first skill', target: 1 },
    { title: 'Polymath', description: 'Unlock every skill', target: TOTAL_SKILLS },
  ]),
  ...tiers('skill-tiers', 'Skills', 'flame', skillTiers, [
    { title: 'Tier Climber', description: 'Reach 50 total skill tiers', target: 50 },
  ]),
  ...tiers('skills-99', 'Skills', 'crown', skillsAt99, [
    { title: 'Ninety-Nine', description: 'Reach level 99 in any skill', target: 1 },
    { title: 'Maxed', description: 'Reach level 99 in every skill', target: TOTAL_SKILLS, icon: 'trophy' },
  ]),

  // Regions
  ...tiers('regions', 'Regions', 'region', (u) => visibleAreaUnlocks(u.regions).length, [
    { title: 'Explorer', description: 'Unlock your first region', target: 1 },
    { title: 'Globetrotter', description: 'Unlock 5 regions', target: 5 },
    { title: 'World Tour', description: 'Unlock every region', target: TOTAL_REGIONS, icon: 'map' },
  ]),

  // Equipment
  ...tiers('equip-unlock', 'Equipment', 'equipment', equipUnlocked, [
    { title: 'Geared Up', description: 'Unlock your first equipment slot', target: 1 },
    { title: 'Fully Equipped', description: 'Unlock every equipment slot', target: TOTAL_EQUIP_SLOTS },
  ]),
  ...tiers('equip-max', 'Equipment', 'equipment', equipMaxed, [
    { title: 'Best in Slot', description: `Max a slot to Tier ${EQUIPMENT_TIER_MAX}`, target: 1, icon: 'star' },
    { title: 'Maxed Gear', description: 'Max every equipment slot', target: TOTAL_EQUIP_SLOTS, icon: 'trophy' },
  ]),

  // Diaries
  ...tiers('diaries', 'Diaries', 'diary', (u) => u.diaries.length, [
    { title: 'Diary Keeper', description: 'Complete your first diary tier', target: 1 },
    { title: 'Diary Master', description: 'Complete every diary tier', target: TOTAL_DIARIES, icon: 'crown' },
  ]),

  // Combat Achievements
  ...tiers('ca', 'Combat', 'combat', (u) => u.cas.length, [
    { title: 'Combat Novice', description: 'Complete your first CA tier', target: 1 },
    { title: 'Combat Master', description: 'Complete every CA tier', target: TOTAL_CA, icon: 'trophy' },
  ]),

  // Activities
  ...tiers('bosses', 'Activities', 'boss', (u) => u.bosses.length, [
    { title: 'Boss Hunter', description: 'Unlock your first boss', target: 1 },
    { title: 'Boss Slayer', description: 'Unlock 10 bosses', target: 10 },
  ]),
  ...tiers('minigames', 'Activities', 'minigame', (u) => u.minigames.length, [
    { title: 'Minigamer', description: 'Unlock your first minigame', target: 1 },
  ]),

  // Collection log
  ...tiers('collection', 'Collection', 'collection', collectionItems, [
    { title: 'Collector', description: 'Log your first collection item', target: 1 },
    { title: 'Hoarder', description: 'Log 25 collection items', target: 25 },
  ]),

  // Mastery (overall completion)
  ...tiers('mastery', 'Mastery', 'sparkles', completionPercent, [
    { title: 'Halfway There', description: 'Reach 50% overall completion', target: 50 },
    { title: 'Almost There', description: 'Reach 90% overall completion', target: 90 },
    { title: 'Fate Conqueror', description: 'Reach 100% overall completion', target: 100, icon: 'trophy' },
  ]),
];

/** Score every achievement against the snapshot. Pure — safe in useMemo. */
export function evaluateAchievements(u: UnlockState): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map((a) => {
    const { current, target } = a.progress(u);
    const earned = current >= target;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { ...a, current, target, earned, pct };
  });
}

/** Set of earned achievement ids — used by the "newly earned" detector. */
export function earnedIds(u: UnlockState): Set<string> {
  const set = new Set<string>();
  for (const a of ACHIEVEMENTS) {
    const { current, target } = a.progress(u);
    if (current >= target) set.add(a.id);
  }
  return set;
}
