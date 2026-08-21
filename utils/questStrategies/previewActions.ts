import {
  RUNEPROOF_PREVIEW_MAX_CHARS,
  type RuneProofStorage,
} from '../questRoutes/previewChecks';
import type { QuestStrategyDefinition } from './model';

export type RuneProofPreviewActions = Record<string, readonly string[]>;

export const runeProofPreviewActionStorageKey = (runId: string): string =>
  'fate_runeproof_preview_actions_v1:' + runId;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const ownStoredActionIds = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) return new Set();

  return new Set(
    Object.keys(value)
      .filter(key => /^(0|[1-9]\d*)$/.test(key))
      .map(key => value[Number(key)])
      .filter((actionId): actionId is string => typeof actionId === 'string'),
  );
};

const actionIdsFor = (strategy: unknown): readonly string[] | null => {
  if (!isRecord(strategy) || typeof strategy.questId !== 'string' || !Array.isArray(strategy.actions)) {
    return null;
  }

  const actionIds = strategy.actions.map(action => (
    isRecord(action) && typeof action.id === 'string' ? action.id : null
  ));
  return actionIds.every((id): id is string => id !== null) ? actionIds : null;
};

export function normalizeRuneProofPreviewActions(
  value: unknown,
  strategies: readonly QuestStrategyDefinition[],
): RuneProofPreviewActions {
  if (!isRecord(value) || !Array.isArray(strategies)) return {};

  const normalized: RuneProofPreviewActions = {};
  const seenQuestIds = new Set<string>();
  strategies.forEach((strategy) => {
    const actionIds = actionIdsFor(strategy);
    if (!actionIds || seenQuestIds.has(strategy.questId)) return;
    seenQuestIds.add(strategy.questId);
    if (!hasOwn(value, strategy.questId)) return;

    const requestedActionIds = ownStoredActionIds(value[strategy.questId]);
    const confirmedActionIds = actionIds.filter(actionId => requestedActionIds.has(actionId));
    if (confirmedActionIds.length > 0) normalized[strategy.questId] = confirmedActionIds;
  });

  return normalized;
}

export function readRuneProofPreviewActions(
  storage: RuneProofStorage,
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
): RuneProofPreviewActions {
  try {
    const raw = storage.getItem(runeProofPreviewActionStorageKey(runId));
    if (typeof raw !== 'string' || raw.length > RUNEPROOF_PREVIEW_MAX_CHARS) return {};
    return normalizeRuneProofPreviewActions(JSON.parse(raw), strategies);
  } catch {
    return {};
  }
}

export function writeRuneProofPreviewActions(
  storage: RuneProofStorage,
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
  actions: RuneProofPreviewActions,
): void {
  const normalized = normalizeRuneProofPreviewActions(actions, strategies);
  const key = runeProofPreviewActionStorageKey(runId);
  const serialized = JSON.stringify(normalized);
  if (serialized.length > RUNEPROOF_PREVIEW_MAX_CHARS) return;

  try {
    if (Object.keys(normalized).length === 0) storage.removeItem(key);
    else storage.setItem(key, serialized);
  } catch {
    // Preview action persistence must never interrupt the Goal Planner.
  }
}
