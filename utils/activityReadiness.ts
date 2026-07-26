import type { ActivityReq } from '../data/activityRequirements';
import type { UnlockState } from '../types';
import { meetsSkillRequirement } from './journalStatus';
import { isAreaReachable } from './reachability';
import { effectiveCombatLevel } from './slayerReach';

export type ActivityBlocker =
  | { kind: 'area'; label: string }
  | { kind: 'quest'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string };

export type ActivityReadiness =
  | { status: 'LOCKED'; blockers: [] }
  | { status: 'NOT_READY'; blockers: ActivityBlocker[] }
  | { status: 'NEEDS_CONFIRMATION'; checks: string[] }
  | { status: 'READY' };

export function evaluateActivityReadiness(
  isOwned: boolean,
  requirement: ActivityReq | undefined,
  unlocks: UnlockState,
  gameModeId?: string,
): ActivityReadiness {
  if (!isOwned) return { status: 'LOCKED', blockers: [] };

  const blockers: ActivityBlocker[] = [];
  for (const area of requirement?.requiredAreas ?? []) {
    if (!isAreaReachable(area, unlocks, gameModeId)) {
      blockers.push({ kind: 'area', label: area });
    }
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
    && effectiveCombatLevel(unlocks) < requirement.combatLevel
  ) {
    blockers.push({
      kind: 'combat',
      label: `Combat level ${requirement.combatLevel}`,
    });
  }
  if (blockers.length > 0) return { status: 'NOT_READY', blockers };

  const checks = [...new Set(requirement?.manualRequirements ?? [])];
  return checks.length > 0
    ? { status: 'NEEDS_CONFIRMATION', checks }
    : { status: 'READY' };
}
