/**
 * Slayer task reachability.
 *
 * Given each Slayer master's assignable-monster table (from the chunk picker)
 * and your current state, work out which tasks you could actually be assigned
 * and complete: Slayer level, quest unlocks, combat level, and whether the
 * monster lives in a chunk you've unlocked.
 */

import { UnlockState } from '../types';
import { SlayerMasters } from '../services/ChunkContentService';
import { SLAYER_MASTER_REQUIREMENTS, type SlayerMasterRequirementOption } from '../data/slayerMasterRequirements';
import { isAreaReachable } from './reachability';
import { slayerRequirementPredicate } from '../data/slayerRequirementPredicates';
import { canonicalQuestUnlocks } from '../data/questCatalog';

export type SlayerStatus =
  | 'needs-confirmation'
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
  const L = (k: string, d = 1) => actualSkillLevel({ levels }, k, d);
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

const masterBlocker = (
  master: string,
  unlocks: UnlockState,
  gameModeId: string | undefined,
  questSet: Set<string>,
  combat: number,
): SlayerMasterBlocker | undefined => {
  const requirements = Object.hasOwn(SLAYER_MASTER_REQUIREMENTS, master) ? SLAYER_MASTER_REQUIREMENTS[master] : undefined;
  if (!requirements) return { status: 'unknown', label: `Master: access requirements for ${master} have not been reviewed` };

  const missingArea = requirements.areas?.find(area => !isAreaReachable(area, unlocks, gameModeId));
  if (missingArea) return { status: 'area-locked', label: `Master: ${missingArea}` };

  const missingQuest = requirements.quests?.find(quest => !questSet.has(quest));
  if (missingQuest) return { status: 'quest-locked', label: `Master: ${missingQuest}` };

  const optionSkillsMet = (option: SlayerMasterRequirementOption): boolean =>
    Object.entries(option.skills ?? {}).every(([skill, level]) =>
      actualSkillLevel(unlocks, skill) >= level);
  const optionMet = (option: SlayerMasterRequirementOption): boolean =>
    optionSkillsMet(option) && (option.combatLevel == null || combat >= option.combatLevel);

  if (requirements.oneOf?.length && !requirements.oneOf.some(option => optionMet(option) && !option.requiresSlayerCape)) {
    if (requirements.oneOf.some(option => optionMet(option) && option.requiresSlayerCape)) {
      return { status: 'needs-confirmation', label: 'Master: confirm the Slayer cape bypass is available and legal for this assignment' };
    }
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
  unlocks = canonicalQuestUnlocks(unlocks);
  const slayerLevel = actualSkillLevel(unlocks, 'Slayer');
  const slayerUnlocked = (unlocks.skills?.['Slayer'] ?? 0) > 0;
  const combat = actualCombatLevel(unlocks);
  const questSet = new Set(unlocks.quests ?? []);

  const reqMet = (req?: string[]): boolean => {
    if (!req || req.length === 0) return true;
    return req.every(r => {
      const predicate = slayerRequirementPredicate(r);
      return predicate.kind !== 'quest' || questSet.has(predicate.id);
    });
  };

  const out: SlayerMasterReach[] = [];
  for (const [master, tasks] of Object.entries(masters)) {
    if (!tasks || typeof tasks !== 'object' || Array.isArray(tasks)) {
      out.push({ master, rows: [], ready: 0, total: 0, masterBlocker: { status: 'unknown', label: 'Master: invalid assignment table' } });
      continue;
    }
    const masterGate = masterBlocker(master, unlocks, gameModeId, questSet, combat);
    const rows: SlayerTaskRow[] = [];
    for (const [monster, info] of Object.entries(tasks)) {
      const loc = locate(monster);
      if (!info || typeof info !== 'object' || Array.isArray(info)) {
        rows.push({ monster, weight: 0, status: 'unknown', loc });
        continue;
      }
      let status: SlayerStatus;
      if (masterGate) status = masterGate.status;
      else if ((info.slayer != null && (!Number.isInteger(info.slayer) || info.slayer < 1 || info.slayer > 99))
        || (info.combat != null && (!Number.isInteger(info.combat) || info.combat < 1 || info.combat > 126))
        || (info.req != null && (!Array.isArray(info.req) || info.req.some(r => typeof r !== 'string')))) status = 'unknown';
      else if (info.slayer != null && slayerLevel < info.slayer) status = 'slayer-locked';
      else if (info.req?.some(r => slayerRequirementPredicate(r).kind === 'unknown')) status = 'unknown';
      else if (!reqMet(info.req)) status = 'quest-locked';
      else if (info.combat != null && combat < info.combat) status = 'combat-locked';
      else if (!loc) status = 'no-location';
      else if (!loc.unlocked) status = 'area-locked';
      else if (info.req?.some(r => slayerRequirementPredicate(r).kind === 'manual')) status = 'needs-confirmation';
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
