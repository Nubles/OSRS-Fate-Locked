import { canonicalItemKey } from '../questRoutes/model';
import type {
  QuestActionCoachMetadata,
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  WalkthroughItemRef,
} from '../questWalkthroughs/model';

export type QuestStrategyAction = QuestWalkthroughActionDefinition & {
  readonly coach: QuestActionCoachMetadata;
};

export interface QuestStrategyDefinition {
  readonly questId: string;
  readonly revision: string;
  readonly source: QuestWalkthroughDefinition['source'];
  readonly sourceLines: QuestWalkthroughDefinition['sourceLines'];
  readonly actions: readonly QuestStrategyAction[];
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

const isWalkthroughItemRef = (value: unknown): value is WalkthroughItemRef => {
  if (!isRecord(value) || !isRecord(value.item)) return false;
  return isNonBlank(value.item.name)
    && isCanonicalItemKey(value.item.key)
    && value.item.key === canonicalItemKey(value.item.name)
    && typeof value.quantity === 'number'
    && Number.isFinite(value.quantity)
    && value.quantity > 0
    && (value.supplyPolicy === 'PLAYER_OBTAINED' || value.supplyPolicy === 'QUEST_PROVIDED');
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
    || !Array.isArray(coach.fulfils)
    || !coach.fulfils.every(isWalkthroughItemRef)
  ) return false;
  if (
    coach.fallbackPolicy !== 'BLOCK_THEN_ALTERNATIVES'
    && coach.fallbackPolicy !== 'INTERCHANGEABLE'
    && coach.fallbackPolicy !== 'NONE'
  ) return false;

  const knownItemKeys = new Set([
    ...action.items.filter(isWalkthroughItemRef).map(entry => entry.item.key),
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

export function questStrategyFromWalkthrough(
  walkthrough: QuestWalkthroughDefinition,
): QuestStrategyDefinition | null {
  const actions = walkthrough.actions;
  if (actions.length === 0) return null;

  const actionIds = new Set<string>();
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
    actionIds.add(action.id);
    previousSourceOrder = action.sourceOrder;
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

  return {
    questId: walkthrough.questId,
    revision: walkthrough.revision,
    source: walkthrough.source,
    sourceLines: walkthrough.sourceLines,
    actions: actions as readonly QuestStrategyAction[],
  };
}
