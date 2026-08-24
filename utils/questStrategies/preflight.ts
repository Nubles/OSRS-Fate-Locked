import { canonicalAreaName } from '../../data/areaMapPolicy';
import {
  questAccessPolicyStructureErrors,
  type QuestData,
  type QuestLocationRequirement,
  type QuestRequirementOption,
} from '../../data/questData';
import { RUNE_PROOF_CANONICAL_AREA_IDS } from '../../data/runeProofCanonicalAreas';
import type { RuneProofCatalogueEntry } from '../../data/runeProofQuestCatalogue';
import type { UnlockState } from '../../types';
import { currentQuestPoints } from '../goalPlanner';
import { isAreaReachable } from '../reachability';
import { materializeRuneProofAccount } from '../questRoutes/goalPlannerRuneProof';
import { effectiveCombatLevel, effectiveSkillLevel } from '../slayerReach';
import type { ChunkKey } from '../questRoutes/model';
import {
  requirementAll,
  requirementAny,
  type RequirementExpression,
} from './packModel';
import type { RuneProofRequirementSnapshot } from './requirements';

const questDataEvidenceIds = (questId: string): readonly string[] => (
  [`quest-data:${questId}`]
);

const regionRequirement = (
  questId: string,
  regionId: string,
): RequirementExpression => {
  const canonical = canonicalAreaName(regionId);
  return {
    kind: 'REGION_ACCESS',
    id: `region:${canonical}`,
    regionId: canonical,
    evidenceIds: questDataEvidenceIds(questId),
  };
};

const locationRequirement = (
  questId: string,
  location: QuestLocationRequirement,
): RequirementExpression => {
  if (location.chunkOptions.length === 0) {
    throw new Error(`location ${location.id} must have at least one chunk option`);
  }
  return requirementAny(...location.chunkOptions.map(({ cx, cy }) => {
    if (!Number.isInteger(cx) || !Number.isInteger(cy)) {
      throw new Error(`location ${location.id} must use finite integer chunk options`);
    }
    const chunk = `${cx},${cy}` as ChunkKey;
    return {
      kind: 'CHUNK_ACCESS' as const,
      id: `location:${location.id}:${chunk}`,
      chunk,
      plane: 0,
      evidenceIds: questDataEvidenceIds(questId),
    };
  }));
};

const optionRequirement = (
  questId: string,
  option: QuestRequirementOption,
): RequirementExpression => requirementAll(
  ...(option.regions ?? []).map(regionId => regionRequirement(questId, regionId)),
  ...(option.guilds ?? []).map(guildId => ({
    kind: 'CANONICAL_UNLOCK' as const,
    id: `guild:${guildId}`,
    unlockType: 'GUILD' as const,
    unlockId: guildId,
    evidenceIds: questDataEvidenceIds(questId),
  })),
  ...(option.locations ?? []).map(location => locationRequirement(questId, location)),
);

const regionAndLocationExpressions = (
  quest: QuestData,
): readonly RequirementExpression[] => {
  const regions = quest.regions.map(regionId => regionRequirement(quest.id, regionId));
  const locations = (quest.locations ?? []).map(location => (
    locationRequirement(quest.id, location)
  ));
  const requiredGeography = quest.accessPolicy === 'regions'
    ? regions
    : quest.accessPolicy === 'locations'
      ? locations
      : [...regions, ...locations];
  const alternatives = quest.oneOf?.length
    ? [requirementAny(...quest.oneOf.map(option => optionRequirement(quest.id, option)))]
    : [];
  return [...requiredGeography, ...alternatives];
};

const normalizeManualPrompt = (prompt: string): string => (
  prompt.normalize('NFKC').trim().replace(/\s+/gu, ' ')
);

const manualRequirementExpressions = (
  quest: QuestData,
): readonly RequirementExpression[] => {
  const seen = new Set<string>();
  return (quest.manualRequirements ?? []).map(prompt => {
    const normalized = normalizeManualPrompt(prompt);
    if (normalized.length === 0) throw new Error('manual requirement must not be blank');
    if (seen.has(normalized)) {
      throw new Error(`duplicate manual requirement: ${normalized}`);
    }
    seen.add(normalized);
    const confirmationId = [
      'manual',
      encodeURIComponent(quest.id),
      encodeURIComponent(normalized),
    ].join(':');
    return {
      kind: 'MANUAL_CONFIRMATION' as const,
      id: confirmationId,
      confirmationId,
      prompt: normalized,
      evidenceIds: questDataEvidenceIds(quest.id),
    };
  });
};

const unresolvedCatalogueExpression = (
  catalogue: RuneProofCatalogueEntry,
): RequirementExpression => {
  const encodedQuestId = encodeURIComponent(catalogue.questId);
  const evidenceId = `catalogue:${encodedQuestId}:requirement-status`;
  return {
    kind: 'UNRESOLVED_EVIDENCE',
    id: `unresolved:${encodedQuestId}:requirements`,
    evidenceId,
    reason: `RuneProof requirement evidence for ${catalogue.questId} is unresolved.`,
    evidenceIds: [evidenceId],
  };
};

export const requirementExpressionForQuestData = (
  quest: QuestData,
  catalogue: RuneProofCatalogueEntry,
): RequirementExpression => {
  const structureErrors = questAccessPolicyStructureErrors(quest);
  if (structureErrors.length > 0) {
    throw new Error(`invalid access policy for ${quest.id}: ${structureErrors.join('; ')}`);
  }
  return requirementAll(
    ...quest.prereqs.map(questId => ({
      kind: 'QUEST_COMPLETED' as const,
      id: `quest:${questId}`,
      questId,
      evidenceIds: questDataEvidenceIds(quest.id),
    })),
    ...Object.entries(quest.skills).map(([skill, level]) => skill === 'Quest Points'
      ? {
        kind: 'QUEST_POINTS' as const,
        id: `quest-points:${level}`,
        points: level,
        evidenceIds: questDataEvidenceIds(quest.id),
      }
      : {
        kind: 'SKILL_LEVEL' as const,
        id: `skill:${skill}:${level}`,
        skill,
        level,
        evidenceIds: questDataEvidenceIds(quest.id),
      }),
    ...(quest.combatLevel === undefined
      ? []
      : [{
        kind: 'COMBAT_LEVEL' as const,
        id: `combat-level:${quest.combatLevel}`,
        level: quest.combatLevel,
        evidenceIds: questDataEvidenceIds(quest.id),
      }]),
    ...regionAndLocationExpressions(quest),
    ...manualRequirementExpressions(quest),
    ...(catalogue.requirementStatus === 'UNRESOLVED'
      ? [unresolvedCatalogueExpression(catalogue)]
      : []),
  );
};

export const preflightSnapshot = (
  unlocks: UnlockState,
  gameModeId: string | undefined,
): RuneProofRequirementSnapshot => ({
  completedQuestIds: new Set(unlocks.quests),
  questPoints: currentQuestPoints(unlocks),
  levels: Object.fromEntries(
    [...new Set([
      ...Object.keys(unlocks.levels),
      ...Object.keys(unlocks.skills),
    ])]
      .sort()
      .map(skill => [skill, effectiveSkillLevel(unlocks, skill)]),
  ),
  combatLevel: effectiveCombatLevel(unlocks),
  regions: new Set(RUNE_PROOF_CANONICAL_AREA_IDS.filter(area => (
    isAreaReachable(area, unlocks, gameModeId)
  ))),
  chunks: new Set(materializeRuneProofAccount(unlocks, gameModeId).unlockedChunks),
  canonicalUnlocks: {
    equipment: new Set(
      Object.keys(unlocks.equipment).filter(key => unlocks.equipment[key] > 0),
    ),
    mobility: new Set(unlocks.mobility),
    arcana: new Set(unlocks.arcana),
    housing: new Set(unlocks.housing),
    guilds: new Set(unlocks.guilds),
    merchants: new Set(unlocks.merchants),
    minigames: new Set(unlocks.minigames),
    bosses: new Set(unlocks.bosses),
    storage: new Set(unlocks.storage),
    farming: new Set(unlocks.farming),
    slayer: new Set(unlocks.slayerUnlocks),
    banks: new Set(unlocks.banks ?? []),
    diaries: new Set(unlocks.diaries),
    combatAchievements: new Set(unlocks.cas),
    tasks: new Set(unlocks.completedTasks),
    collectionItems: new Set(Object.keys(unlocks.collectionLog)
      .filter(itemId => unlocks.collectionLog[Number(itemId)] > 0)),
  },
  transportIds: new Set(unlocks.mobility),
  availableBoostSourceIds: undefined,
  itemQuantities: undefined,
  itemAliases: undefined,
  confirmedManualIds: new Set(),
  selectedBranchId: undefined,
  branchCheckpointIds: new Set(),
  observedCanonicalCompletion: false,
});
