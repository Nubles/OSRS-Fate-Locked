/**
 * Slayer task reachability.
 *
 * Given each Slayer master's assignable-monster table (from the chunk picker)
 * and your current state, work out which tasks you could actually be assigned
 * and complete: Slayer level, quest unlocks, combat level, and whether the
 * monster lives in a chunk you've unlocked.
 */

import { QUEST_DATA } from '../data/questData';
import { UnlockState } from '../types';
import { SlayerMasters } from '../services/ChunkContentService';
import { SLAYER_MASTER_REQUIREMENTS, type SlayerMasterRequirementOption } from '../data/slayerMasterRequirements';
import { isAreaReachable } from './reachability';

export type SlayerStatus =
  | 'unknown'
  | 'ready'         // assignable and reachable right now
  | 'slayer-locked' // Slayer skill/level too low
  | 'quest-locked'  // a quest unlock is missing
  | 'combat-locked' // combat level below the master's assignment floor
  | 'area-locked'   // requirements met, but no unlocked chunk has it
  | 'no-location';  // not found in the chunk dataset

export type SlayerMasterBlocker = {
  status: Exclude<SlayerStatus, 'ready' | 'no-location'>;
  label: string;
};

export interface SlayerTaskRow {
  monster: string;
  slayer?: number;
  combat?: number;
  req?: string[];
  weight: number;
  status: SlayerStatus;
  loc: { cx: number; cy: number; unlocked: boolean } | null;
  masterBlocker?: SlayerMasterBlocker;
}

export interface SlayerMasterReach {
  master: string;
  rows: SlayerTaskRow[];
  ready: number;
  total: number;
  masterBlocker?: SlayerMasterBlocker;
}

export interface SlayerReach {
  combatLevel: number;
  slayerLevel: number;
  slayerUnlocked: boolean;
  masters: SlayerMasterReach[];
}

/** Resolve a task name to a representative chunk (best-effort, may be null). */
export type LocateFn = (taskName: string) => { cx: number; cy: number; unlocked: boolean } | null;

/** Compatibility export for callers evaluating method permission. */
export { usableMethodLevel as effectiveSkillLevel } from './skillLevels';
import { actualSkillLevel } from './skillLevels';
export const combatLevel = (levels: Record<string, number>): number => {
  const L = (k: string, d = 1) => Math.max(levels[k] ?? d, d);
  const base = 0.25 * (L('Defence') + L('Hitpoints', 10) + Math.floor(L('Prayer') / 2));
  const melee = 0.325 * (L('Attack') + L('Strength'));
  const range = 0.325 * Math.floor((3 * L('Ranged')) / 2);
  const mage = 0.325 * Math.floor((3 * L('Magic')) / 2);
  return Math.floor(base + Math.max(melee, range, mage));
};

/**
 * The account's real OSRS combat level.
 *
 * Skill tiers restrict which methods/content the run may use; they do not
 * reduce levels already earned on the account. Combat-level gates therefore
 * use the tracked raw levels rather than method-tier-capped skill levels.
 */
export const actualCombatLevel = (
  unlocks: Pick<UnlockState, 'levels'>,
): number => combatLevel(unlocks.levels ?? {});
/** A req string like "Priest in Peril Complete the quest" → quest name. */
const questFromReq = (req: string): string | null => {
  const m = req.match(/^(.*?) Complete the quest$/);
  return m && QUEST_DATA[m[1].trim()] ? m[1].trim() : null;
};

const masterBlocker = (
  master: string,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  questSet: Set<string>,
  combat: number,
): SlayerMasterBlocker | undefined => {
  const requirements = SLAYER_MASTER_REQUIREMENTS[master];
  if (!requirements) return undefined;

  const missingArea = requirements.areas?.find(area => !isAreaReachable(area, unlocks, gameModeId));
  if (missingArea) return { status: 'area-locked', label: `Master: ${missingArea}` };

  const missingQuest = requirements.quests?.find(quest => !questSet.has(quest));
  if (missingQuest) return { status: 'quest-locked', label: `Master: ${missingQuest}` };

  const optionSkillsMet = (option: SlayerMasterRequirementOption): boolean =>
    Object.entries(option.skills ?? {}).every(([skill, level]) =>
      actualSkillLevel(unlocks, skill) >= level);
  const optionMet = (option: SlayerMasterRequirementOption): boolean =>
    optionSkillsMet(option) && (option.combatLevel == null || combat >= option.combatLevel);

  if (requirements.oneOf?.length && !requirements.oneOf.some(optionMet)) {
    const status = requirements.oneOf.some(optionSkillsMet) ? 'combat-locked' : 'slayer-locked';
    return {
      status,
      label: `Master: ${requirements.oneOf.map(option => option.label).join(' or ')}`,
    };
  }

  return undefined;
};

export function slayerReachability(
  masters: SlayerMasters,
  unlocks: UnlockState,
  locate: LocateFn,
  gameModeId?: string,
): SlayerReach {
  const slayerLevel = actualSkillLevel(unlocks, 'Slayer');
  const slayerUnlocked = (unlocks.skills?.['Slayer'] ?? 0) > 0;
  const combat = actualCombatLevel(unlocks);
  const questSet = new Set(unlocks.quests ?? []);

  const reqMet = (req?: string[]): boolean => {
    if (!req || req.length === 0) return true;
    return req.every(r => {
      const q = questFromReq(r);
      // Non-quest requirements (rare) aren't gated — treat as met.
      return q == null || questSet.has(q);
    });
  };

  const out: SlayerMasterReach[] = [];
  for (const [master, tasks] of Object.entries(masters)) {
    const masterGate = masterBlocker(master, unlocks, gameModeId, questSet, combat);
    const rows: SlayerTaskRow[] = [];
    for (const [monster, info] of Object.entries(tasks)) {
      const loc = locate(monster);
      let status: SlayerStatus;
      if (masterGate) status = masterGate.status;
      else if (!slayerUnlocked || (info.slayer != null && slayerLevel < info.slayer)) status = 'slayer-locked';
      else if (info.req?.some(r => questFromReq(r) === null)) status = 'unknown';
      else if (!reqMet(info.req)) status = 'quest-locked';
      else if (info.combat != null && combat < info.combat) status = 'combat-locked';
      else if (!loc) status = 'no-location';
      else if (!loc.unlocked) status = 'area-locked';
      else status = 'ready';

      rows.push({
        monster, slayer: info.slayer, combat: info.combat, req: info.req, weight: info.weight, status, loc,
        ...(masterGate ? { masterBlocker: masterGate } : {}),
      });
    }
    rows.sort((a, b) =>
      Number(b.status === 'ready') - Number(a.status === 'ready') ||
      (a.slayer ?? 0) - (b.slayer ?? 0) ||
      a.monster.localeCompare(b.monster));
    out.push({
      master,
      rows,
      ready: rows.filter(r => r.status === 'ready').length,
      total: rows.length,
      ...(masterGate ? { masterBlocker: masterGate } : {}),
    });
  }

  return { combatLevel: combat, slayerLevel, slayerUnlocked, masters: out };
}
