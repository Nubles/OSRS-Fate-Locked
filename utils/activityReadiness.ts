import type { ActivityReq } from '../data/activityRequirements';
import type { UnlockState } from '../types';
import { evaluateDiaryTaskEligibility, meetsSkillRequirement, withSkillGateQuests } from './journalStatus';
import type { AreaRoutes } from './areaRoutes';
import { isAreaReachable } from './reachability';
import { chunkPlaceLabel, ownsAnyChunk } from './activityAccess';
import { actualCombatLevel, effectiveSkillLevel } from './slayerReach';
import { QUEST_DATA } from '../data/questData';
import { pendingQuestProgress } from '../data/questProgress';

export type ActivityBlocker =
  | { kind: 'area'; label: string }
  | { kind: 'quest'; label: string }
  | { kind: 'skill'; label: string }
  | { kind: 'combat'; label: string }
  | { kind: 'total'; label: string }
  | { kind: 'questPoints'; label: string };

export type ActivityReadiness =
  | { status: 'LOCKED'; blockers: [] }
  | { status: 'NOT_READY'; blockers: ActivityBlocker[] }
  | { status: 'NEEDS_CONFIRMATION'; checks: string[] }
  | { status: 'READY' };

export const WARRIORS_GUILD_ENTRY_LABEL = '99 Attack or Strength, or 130 combined';

/** The Warriors' Guild door: 99 Attack or Strength, or 130 combined. Tier-capped,
 *  like the diary's "Enter the Warriors' Guild" task. */
export const meetsWarriorsGuildEntry = (unlocks: UnlockState): boolean =>
  meetsSkillRequirement(unlocks, 'Attack', 99) || meetsSkillRequirement(unlocks, 'Strength', 99)
  || effectiveSkillLevel(unlocks, 'Attack') + effectiveSkillLevel(unlocks, 'Strength') >= 130;

export function evaluateActivityReadiness(
  isOwned: boolean,
  requirement: ActivityReq | undefined,
  unlocks: UnlockState,
  gameModeId?: string,
  areaRoutes?: AreaRoutes | null,
): ActivityReadiness {
  if (!isOwned) return { status: 'LOCKED', blockers: [] };

  const blockers: ActivityBlocker[] = [];
  if (requirement?.questPoints !== undefined) {
    const points = [...new Set(unlocks.quests)].reduce((sum, id) => sum + (QUEST_DATA[id]?.kind === 'quest' ? QUEST_DATA[id].points : 0), 0);
    if (points < requirement.questPoints) blockers.push({ kind: 'questPoints', label: `${requirement.questPoints} Quest Points` });
  }
  if (requirement?.warriorsGuildEntry && !meetsWarriorsGuildEntry(unlocks)) {
    blockers.push({ kind: 'skill', label: WARRIORS_GUILD_ENTRY_LABEL });
  }
  const requiredAreas = requirement?.requiredAreas ?? [];
  // Chunked: the exact entrance chunk must be owned, not any chunk of the area.
  const requiredChunks = gameModeId === 'chunked' ? requirement?.requiredChunks ?? [] : [];
  if (requiredChunks.length > 0) {
    if (!ownsAnyChunk(requiredChunks, unlocks)) {
      blockers.push({ kind: 'area', label: requiredChunks.map(chunkPlaceLabel).join(' or ') });
    }
  } else if (requiredAreas.length > 0) {
    const owned = requiredAreas.filter(area => isAreaReachable(area, unlocks, gameModeId));
    if (owned.length === 0) {
      blockers.push({ kind: 'area', label: requiredAreas.join(' or ') });
    } else if (
      areaRoutes && gameModeId !== 'chunked'
      // The Journal's own check (caTaskAccess bossAreaBlocker): an owned area
      // no route reaches, or an island with no way onto it, doesn't count.
      && !evaluateDiaryTaskEligibility({ id: 'activity-area', anyOfRegions: [...requiredAreas] }, unlocks, gameModeId, areaRoutes).confirmable
    ) {
      blockers.push({ kind: 'area', label: `a route to ${owned.join(' or ')}` });
    }
  }
  // Includes the unlocking quest of a gated skill, such as Druidic Ritual.
  for (const quest of withSkillGateQuests(requirement?.quests, requirement?.skills)) {
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
    const totalLevel = Object.values(unlocks.levels ?? {}).reduce(
      (sum, level) => sum + level,
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

  const checks = [...new Set([...(requirement?.manualRequirements ?? []), ...pendingQuestProgress(requirement?.questProgress, unlocks.quests)])];
  if (requirement?.oneOf?.length) {
    const routes = requirement.oneOf.map(route => ({
      machineMet: Object.entries(route.skills ?? {}).every(([skill, level]) => meetsSkillRequirement(unlocks, skill, level)) && (route.diaries ?? []).every(diary => unlocks.diaries.includes(diary)),
      checks: route.manualRequirements ?? [],
    }));
    const ready = routes.find(route => route.machineMet && route.checks.length === 0);
    const confirmable = routes.find(route => route.machineMet);
    if (!ready && confirmable) checks.push(...confirmable.checks);
    else if (!ready) return { status: 'NOT_READY', blockers: [{ kind: 'quest', label: requirement.oneOf.map(route => [...(route.diaries ?? []), ...Object.entries(route.skills ?? {}).map(([skill, level]) => skill + ' ' + level), ...(route.manualRequirements ?? [])].join(' + ')).join(' or ') }] };
  }
  if (!requirement || requirement.unverified) checks.push('Access requirements have not been fully verified');
  return checks.length > 0
    ? { status: 'NEEDS_CONFIRMATION', checks }
    : { status: 'READY' };
}
