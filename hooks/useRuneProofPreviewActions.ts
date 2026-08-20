import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  normalizeRuneProofPreviewActions,
  readRuneProofPreviewActions,
  type RuneProofPreviewActions,
  writeRuneProofPreviewActions,
} from '../utils/questStrategies/previewActions';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { RuneProofStorage } from '../utils/questRoutes/previewChecks';

const unavailableStorage: RuneProofStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const defaultStorage = (): RuneProofStorage => (
  typeof window === 'undefined' ? unavailableStorage : window.localStorage
);

export interface RuneProofPreviewActionControls {
  readonly confirmedActionIds: ReadonlySet<string>;
  setActionConfirmed(actionId: string, confirmed: boolean): void;
}

export function useRuneProofPreviewActions(
  runId: string,
  strategy: QuestStrategyDefinition | null,
  storage?: RuneProofStorage,
): RuneProofPreviewActionControls {
  const activeStorage = storage ?? defaultStorage();
  const [actions, setActions] = useState<RuneProofPreviewActions>(() => (
    strategy ? readRuneProofPreviewActions(activeStorage, runId, strategy) : {}
  ));

  useEffect(() => {
    setActions(strategy ? readRuneProofPreviewActions(activeStorage, runId, strategy) : {});
  }, [activeStorage, runId, strategy]);

  const confirmedActionIds = useMemo(() => new Set(
    strategy
      ? normalizeRuneProofPreviewActions(actions, strategy)[strategy.questId] ?? []
      : [],
  ), [actions, strategy]);

  const setActionConfirmed = useCallback((actionId: string, confirmed: boolean) => {
    if (!strategy) return;

    setActions(current => {
      const existing = current[strategy.questId] ?? [];
      const nextActionIds = confirmed
        ? [...existing, actionId]
        : existing.filter(id => id !== actionId);
      const next = normalizeRuneProofPreviewActions({
        [strategy.questId]: nextActionIds,
      }, strategy);
      writeRuneProofPreviewActions(activeStorage, runId, strategy, next);
      return next;
    });
  }, [activeStorage, runId, strategy]);

  return { confirmedActionIds, setActionConfirmed };
}
