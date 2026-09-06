import type { ActivityReq } from '../data/activityRequirements';
import type { UnlockState } from '../types';
import { meetsSkillRequirement } from './journalStatus';
import { isAreaReachable } from './reachability';
import { evaluatePredicate } from './requirementPredicates';
import { actualCombatLevel } from './slayerReach';
import { actualSkillLevel } from './skillLevels';
import { SKILLS_LIST } from '../data/items';
import { canonicalQuestUnlocks } from '../data/questCatalog';

export type ActivityBlocker =
  | { kind: 'area'; label: string }
  | { kind: 'quest'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string }
  | { kind: 'total'; label: string };

export type ActivityReadiness =
  | { status: 'LOCKED'; blockers: [] }
  | { status: 'NOT_READY'; blockers: ActivityBlocker[] }
  | { status: 'NEEDS_CONFIRMATION'; checks: string[] }
  | { status: 'UNKNOWN'; checks: string[] }
  | { status: 'READY' };

export function evaluateActivityReadiness(
  isOwned: boolean,
  requirement: ActivityReq | undefined,
  unlocks: UnlockState,
  gameModeId?: string,
): ActivityReadiness {
  unlocks = canonicalQuestUnlocks(unlocks);
  if (!isOwned) return { status: 'LOCKED', blockers: [] };

  if (!requirement) return { status: 'UNKNOWN', checks: ['Access requirements have not been reviewed'] };
  const blockers: ActivityBlocker[] = [];
  const requiredAreas = requirement?.requiredAreas ?? [];
  if (
    requiredAreas.length > 0
    && !requiredAreas.some(area => isAreaReachable(area, unlocks, gameModeId))
  ) {
    blockers.push({ kind: 'area', label: requiredAreas.join(' or ') });
  }
  for (const quest of requirement?.quests ?? []) {
    if (!unlocks.quests.includes(quest)) {
      blockers.push({ kind: 'quest', label: quest });
    }
  }
  for (const [skill, level] of Object.entries(requirement?.skills ?? {})) {
    if (!meetsSkillRequirement(unlocks, skill, level)) {
      blockers.push({ kind: 'skill', label: `${skill} ${level}` });
    }
  }
  if (
    requirement?.combatLevel !== undefined
    && actualCombatLevel(unlocks) < requirement.combatLevel
  ) {
    blockers.push({
      kind: 'combat',
      label: `Combat level ${requirement.combatLevel}`,
    });
  }
  if (requirement?.totalLevel !== undefined) {
    const totalLevel = SKILLS_LIST.reduce(
      (sum, skill) => sum + actualSkillLevel(unlocks, skill),
      0,
    );
    if (totalLevel < requirement.totalLevel) {
      blockers.push({
        kind: 'total',
        label: `Total level ${requirement.totalLevel}`,
      });
    }
  }
  if (blockers.length > 0) return { status: 'NOT_READY', blockers };

  const evaluated = evaluatePredicate({ kind: 'all', of: requirement?.predicates ?? (requirement?.note && !requirement.noteIsInformational ? [{ kind: 'unknown', key: 'unclassified-note', label: requirement.note }] : []) }, { unlocks, gameModeId });
  if (evaluated.status === 'LOCKED') return { status: 'NOT_READY', blockers: evaluated.checks.map(label => ({ kind: 'quest', label })) };
  if (evaluated.status === 'UNKNOWN') return { status: 'UNKNOWN', checks: evaluated.checks };
  const checks = [...new Set([...(requirement?.manualRequirements ?? []), ...evaluated.checks])];
  return checks.length > 0
    ? { status: 'NEEDS_CONFIRMATION', checks }
    : { status: 'READY' };
}
