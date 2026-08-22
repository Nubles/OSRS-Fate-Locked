import {
  canonicalItemKey,
  chunkKey,
  type ChunkKey,
  type QuestItemRequirement,
} from '../questRoutes/model';
import {
  f2pQuestMembershipFor,
  type F2PQuestMembership,
} from '../../data/f2pQuestMembership';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import type {
  QuestActionCoachMetadata,
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  WalkthroughItemRef,
} from '../questWalkthroughs/model';

export type QuestStrategyAction = QuestWalkthroughActionDefinition & {
  readonly coach: QuestActionCoachMetadata;
};

export interface QuestStrategyContext {
  readonly membership: F2PQuestMembership;
  readonly rootRequirements: readonly QuestItemRequirement[];
}

export interface QuestStrategyDefinition {
  readonly questId: string;
  readonly kind: F2PQuestMembership['kind'];
  readonly rolloutWave: F2PQuestMembership['wave'];
  readonly progressionPriority: number;
  readonly revision: string;
  readonly source: QuestWalkthroughDefinition['source'];
  readonly sourceLines: QuestWalkthroughDefinition['sourceLines'];
  readonly actions: readonly (QuestStrategyAction & {
    readonly mapChunks: readonly ChunkKey[];
  })[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonBlank = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isCanonicalItemKey = (value: unknown): value is string => (
  isNonBlank(value) && value === canonicalItemKey(value)
);

const isChunkKey = (value: unknown): value is ChunkKey => {
  if (!isNonBlank(value)) return false;
  const match = /^(-?\d+),(-?\d+)$/.exec(value);
  return match !== null && chunkKey(Number(match[1]), Number(match[2])) === value;
};

const isItemRef = (value: unknown): value is WalkthroughItemRef['item'] => {
  if (!isRecord(value)) return false;
  return isNonBlank(value.name)
    && isCanonicalItemKey(value.key)
    && value.key === canonicalItemKey(value.name);
};

const isWalkthroughItemRef = (value: unknown): value is WalkthroughItemRef => {
  if (!isRecord(value) || !isItemRef(value.item)) return false;
  return value.item.key === canonicalItemKey(value.item.name)
    && typeof value.quantity === 'number'
    && Number.isFinite(value.quantity)
    && value.quantity > 0
    && (value.supplyPolicy === 'PLAYER_OBTAINED' || value.supplyPolicy === 'QUEST_PROVIDED');
};

const isQuestItemRequirement = (value: unknown): value is QuestItemRequirement => {
  if (!isRecord(value) || !isItemRef(value.item)) return false;
  if (
    typeof value.quantity !== 'number'
    || !Number.isFinite(value.quantity)
    || value.quantity <= 0
    || (value.supplyPolicy !== 'PLAYER_OBTAINED' && value.supplyPolicy !== 'QUEST_PROVIDED')
  ) return false;
  if (value.alternatives !== undefined && (!Array.isArray(value.alternatives) || !value.alternatives.every(isItemRef))) {
    return false;
  }
  return value.note === undefined || isNonBlank(value.note);
};

const hasReviewedLocationEvidence = (action: QuestWalkthroughActionDefinition): boolean => {
  const location = action.location;
  return isRecord(location)
    && location.kind === 'REVIEWED_ALIAS'
    && isNonBlank(location.alias)
    && Array.isArray(location.chunks)
    && location.chunks.length > 0
    && location.chunks.every(isNonBlank)
    && isNonBlank(location.reviewer)
    && isNonBlank(location.reviewedAt)
    && isNonBlank(location.evidence)
    && isNonBlank(location.rationale);
};

const staticMapChunksFor = (
  action: QuestWalkthroughActionDefinition,
): readonly ChunkKey[] | null => {
  const location = action.location;
  if (location.kind === 'REVIEWED_ALIAS') {
    if (!hasReviewedLocationEvidence(action)) return null;
  } else if (location.kind !== 'EXPLICIT_CHUNKS') {
    return null;
  }

  const chunks = location.chunks;
  if (!Array.isArray(chunks) || chunks.length === 0 || !chunks.every(isChunkKey)) return null;
  if (new Set(chunks).size !== chunks.length) return null;
  return Object.freeze([...chunks]);
};

const hasValidPreferredMethod = (
  action: QuestWalkthroughActionDefinition,
  fulfils: readonly WalkthroughItemRef[],
): boolean => {
  const preferredMethod = action.coach?.preferredMethod;
  if (preferredMethod === undefined) return true;
  if (!isRecord(preferredMethod)) return false;

  switch (preferredMethod.kind) {
    case 'DIRECT_SOURCE':
      return isCanonicalItemKey(preferredMethod.itemKey)
        && isNonBlank(preferredMethod.sourceLabel)
        && fulfils.some(entry => entry.item.key === preferredMethod.itemKey)
        && action.confidence === 'REVIEWED'
        && hasReviewedLocationEvidence(action);
    case 'TRANSFORMATION':
      return isNonBlank(preferredMethod.recipeId);
    default:
      return false;
  }
};

const hasValidCoachMetadata = (action: QuestWalkthroughActionDefinition): action is QuestStrategyAction => {
  const coach = action.coach;
  if (
    !isRecord(coach)
    || !Array.isArray(action.items)
    || !action.items.every(isWalkthroughItemRef)
    || !Array.isArray(coach.consumes)
    || !coach.consumes.every(isWalkthroughItemRef)
    || !Array.isArray(coach.fulfils)
    || !coach.fulfils.every(isWalkthroughItemRef)
  ) return false;
  if (
    coach.fallbackPolicy !== 'BLOCK_THEN_ALTERNATIVES'
    && coach.fallbackPolicy !== 'INTERCHANGEABLE'
    && coach.fallbackPolicy !== 'NONE'
  ) return false;

  const knownItemKeys = new Set([
    ...action.items.map(entry => entry.item.key),
    ...coach.fulfils.map(entry => entry.item.key),
  ]);

  if (!isRecord(coach.completion)) return false;
  switch (coach.completion.kind) {
    case 'MANUAL':
      break;
    case 'ITEM_CONFIRMED':
      if (!isCanonicalItemKey(coach.completion.itemKey) || !knownItemKeys.has(coach.completion.itemKey)) return false;
      break;
    case 'QUEST_COMPLETED':
      if (!isNonBlank(coach.completion.questId)) return false;
      break;
    default:
      return false;
  }

  return hasValidPreferredMethod(action, coach.fulfils);
};

const isMatchingMembership = (
  value: unknown,
  questId: string,
): value is F2PQuestMembership => (
  isRecord(value)
  && value.questId === questId
  && isNonBlank(value.slug)
  && (value.kind === 'quest' || value.kind === 'miniquest')
  && (value.wave === 1 || value.wave === 2 || value.wave === 3 || value.wave === 4 || value.wave === 5)
  && typeof value.progressionPriority === 'number'
  && Number.isInteger(value.progressionPriority)
  && value.progressionPriority > 0
  && isNonBlank(value.wikiTitle)
  && value.evidenceQuestId === questId
);

const addItemQuantity = (
  quantities: Map<string, number>,
  item: WalkthroughItemRef,
): void => {
  quantities.set(item.item.key, (quantities.get(item.item.key) ?? 0) + item.quantity);
};

const hasValidItemFlow = (
  actions: readonly QuestStrategyAction[],
  rootRequirements: readonly QuestItemRequirement[],
): boolean => {
  if (!Array.isArray(rootRequirements) || !rootRequirements.every(isQuestItemRequirement)) return false;

  const available = new Map<string, number>();
  rootRequirements.forEach(requirement => addItemQuantity(available, requirement));

  for (const action of actions) {
    const consumed = new Map<string, number>();
    action.coach.consumes.forEach((item) => {
      consumed.set(item.item.key, (consumed.get(item.item.key) ?? 0) + item.quantity);
    });

    for (const [itemKey, quantity] of consumed) {
      if ((available.get(itemKey) ?? 0) < quantity) return false;
    }
    for (const [itemKey, quantity] of consumed) {
      available.set(itemKey, (available.get(itemKey) ?? 0) - quantity);
    }
    action.coach.fulfils.forEach(item => addItemQuantity(available, item));
  }

  return true;
};

const legacyStrategyContextFor = (
  walkthrough: QuestWalkthroughDefinition,
): QuestStrategyContext | null => {
  const membership = f2pQuestMembershipFor(walkthrough.questId);
  const rootRequirements = reviewedQuestRequirements(walkthrough.questId);
  if (!membership || !rootRequirements) {
    return null;
  }
  return { membership, rootRequirements: rootRequirements.items };
};

/**
 * Legacy read-only compatibility for the existing exact-release walkthrough loader.
 * New preview selection must pass an explicit context through the preview boundary.
 */
export function questStrategyFromWalkthrough(
  walkthrough: QuestWalkthroughDefinition,
): QuestStrategyDefinition | null;
export function questStrategyFromWalkthrough(
  walkthrough: QuestWalkthroughDefinition,
  context: QuestStrategyContext,
): QuestStrategyDefinition | null;
export function questStrategyFromWalkthrough(
  walkthrough: QuestWalkthroughDefinition,
  context?: QuestStrategyContext,
): QuestStrategyDefinition | null {
  const resolvedContext = context ?? (arguments.length === 1 ? legacyStrategyContextFor(walkthrough) : null);
  if (
    !isRecord(resolvedContext)
    || !isMatchingMembership(resolvedContext.membership, walkthrough.questId)
    || !Array.isArray(resolvedContext.rootRequirements)
  ) return null;

  const actions = walkthrough.actions;
  if (actions.length === 0) return null;

  const actionIds = new Set<string>();
  const strategyActions: (QuestStrategyAction & { readonly mapChunks: readonly ChunkKey[] })[] = [];
  let previousSourceOrder = 0;
  for (const action of actions) {
    if (
      !isNonBlank(action.id)
      || !Number.isInteger(action.sourceOrder)
      || action.sourceOrder <= previousSourceOrder
      || !Array.isArray(action.dependsOn)
      || !hasValidCoachMetadata(action)
    ) return null;
    if (actionIds.has(action.id)) return null;
    const mapChunks = staticMapChunksFor(action);
    if (!mapChunks) return null;
    actionIds.add(action.id);
    previousSourceOrder = action.sourceOrder;
    strategyActions.push(Object.freeze({ ...action, mapChunks }));
  }

  const actionById = new Map(actions.map(action => [action.id, action]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (action: QuestStrategyAction): boolean => {
    if (visiting.has(action.id)) return false;
    if (visited.has(action.id)) return true;
    visiting.add(action.id);
    for (const dependencyId of action.dependsOn) {
      const dependency = actionById.get(dependencyId);
      if (
        !isNonBlank(dependencyId)
        || !dependency
        || dependency.sourceOrder >= action.sourceOrder
        || !visit(dependency as QuestStrategyAction)
      ) return false;
    }
    visiting.delete(action.id);
    visited.add(action.id);
    return true;
  };

  if (!actions.every(action => visit(action as QuestStrategyAction))) return null;
  if (!hasValidItemFlow(actions as readonly QuestStrategyAction[], resolvedContext.rootRequirements)) return null;

  const completionActions = strategyActions.filter(action => action.coach.completion.kind === 'QUEST_COMPLETED');
  const finalAction = strategyActions.at(-1);
  if (
    completionActions.length !== 1
    || !finalAction
    || completionActions[0] !== finalAction
    || finalAction.coach.completion.kind !== 'QUEST_COMPLETED'
    || finalAction.coach.completion.questId !== walkthrough.questId
  ) return null;

  return Object.freeze({
    questId: walkthrough.questId,
    kind: resolvedContext.membership.kind,
    rolloutWave: resolvedContext.membership.wave,
    progressionPriority: resolvedContext.membership.progressionPriority,
    revision: walkthrough.revision,
    source: walkthrough.source,
    sourceLines: walkthrough.sourceLines,
    actions: Object.freeze(strategyActions),
  });
}
