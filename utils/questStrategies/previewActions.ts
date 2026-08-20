import {
  RUNEPROOF_PREVIEW_MAX_CHARS,
  type RuneProofStorage,
} from '../questRoutes/previewChecks';
import type { QuestStrategyDefinition } from './model';

export type RuneProofPreviewActions = Record<string, readonly string[]>;

export const runeProofPreviewActionStorageKey = (runId: string): string =>
  `fate_runeproof_preview_actions_v1:${runId}`;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const ownStoredActionIds = (value: unknown): Set<string> => {
  if (!Array.isArray(value)) return new Set();

  return new Set(
    Object.keys(value)
      .filter(key => /^(0|[1-9]\d*)$/.test(key))
      .map(key => value[Number(key)])
      .filter((actionId): actionId is string => typeof actionId === 'string'),
  );
};

export function normalizeRuneProofPreviewActions(
  value: unknown,
  strategy: QuestStrategyDefinition,
): RuneProofPreviewActions {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, strategy.questId)) {
    return {};
  }

  const requestedActionIds = ownStoredActionIds(value[strategy.questId]);
  const confirmedActionIds = strategy.actions
    .map(action => action.id)
    .filter(actionId => requestedActionIds.has(actionId));

  return confirmedActionIds.length > 0
    ? { [strategy.questId]: confirmedActionIds }
    : {};
}

export function readRuneProofPreviewActions(
  storage: RuneProofStorage,
  runId: string,
  strategy: QuestStrategyDefinition,
): RuneProofPreviewActions {
  try {
    const raw = storage.getItem(runeProofPreviewActionStorageKey(runId));
    if (typeof raw !== 'string' || raw.length > RUNEPROOF_PREVIEW_MAX_CHARS) return {};
    return normalizeRuneProofPreviewActions(JSON.parse(raw), strategy);
  } catch {
    return {};
  }
}

export function writeRuneProofPreviewActions(
  storage: RuneProofStorage,
  runId: string,
  strategy: QuestStrategyDefinition,
  actions: RuneProofPreviewActions,
): void {
  const normalized = normalizeRuneProofPreviewActions(actions, strategy);
  const key = runeProofPreviewActionStorageKey(runId);
  try {
    if (Object.keys(normalized).length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Preview action persistence must never interrupt the Goal Planner.
  }
}
