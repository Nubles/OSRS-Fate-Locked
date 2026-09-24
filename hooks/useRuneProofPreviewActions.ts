import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  normalizeRuneProofPreviewActions,
  readRuneProofPreviewActions,
  type RuneProofPreviewActions,
  writeRuneProofPreviewActions,
} from '../utils/questStrategies/previewActions';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import type { RuneProofStorage } from '../utils/questRoutes/previewChecks';
import type { CanonicalRuneProofControls } from '../utils/runeProofProgress';

const unavailableStorage: RuneProofStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const defaultStorage = (): RuneProofStorage => {
  try {
    return typeof window === 'undefined' ? unavailableStorage : window.localStorage;
  } catch {
    return unavailableStorage;
  }
};

interface RuneProofPreviewActionState {
  readonly runId: string;
  readonly strategies: readonly QuestStrategyDefinition[];
  readonly actions: RuneProofPreviewActions;
}

const actionsForCurrentScope = (
  state: RuneProofPreviewActionState,
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
): RuneProofPreviewActions => (
  state.runId === runId && state.strategies === strategies ? state.actions : {}
);

export interface RuneProofPreviewActionControls {
  readonly actionsByQuest: RuneProofPreviewActions;
  confirmedActionIdsFor(questId: string): ReadonlySet<string>;
  setActionConfirmed(questId: string, actionId: string, confirmed: boolean): void;
}

export function useRuneProofPreviewActions(
  runId: string,
  strategies: readonly QuestStrategyDefinition[],
  storage?: RuneProofStorage,
  canonical?: CanonicalRuneProofControls,
): RuneProofPreviewActionControls {
  const activeStorage = useMemo(() => (
    !canonical && strategies.length > 0 ? storage ?? defaultStorage() : unavailableStorage
  ), [storage, strategies, canonical]);
  const [state, setState] = useState<RuneProofPreviewActionState>(() => ({
    runId,
    strategies,
    actions: strategies.length > 0
      ? readRuneProofPreviewActions(activeStorage, runId, strategies)
      : {},
  }));

  useEffect(() => {
    if (canonical) return;
    setState({
      runId,
      strategies,
      actions: strategies.length > 0
        ? readRuneProofPreviewActions(activeStorage, runId, strategies)
        : {},
    });
  }, [activeStorage, runId, strategies, canonical]);

  useEffect(() => {
    if (!canonical) return;
    for (const strategy of strategies) {
      if (canonical.progress?.actions[strategy.questId]?.revision === null) {
        canonical.update(runId, { kind: 'BIND', questId: strategy.questId,
          revision: strategy.revision, validIds: strategy.actions.map(action => action.id) });
      }
    }
  }, [canonical, runId, strategies]);

  const actionsByQuest = useMemo(() => normalizeRuneProofPreviewActions(
    canonical ? Object.fromEntries(strategies.map(strategy => {
      const entry = canonical.progress?.actions[strategy.questId];
      return [strategy.questId, entry && (entry.revision === null || entry.revision === strategy.revision) ? entry.ids : []];
    })) : actionsForCurrentScope(state, runId, strategies),
    strategies,
  ), [runId, state, strategies, canonical]);

  const confirmedActionIdsFor = useCallback((questId: string): ReadonlySet<string> => (
    new Set(actionsByQuest[questId] ?? [])
  ), [actionsByQuest]);

  const setActionConfirmed = useCallback((
    questId: string,
    actionId: string,
    confirmed: boolean,
  ) => {
    if (canonical) {
      const strategy = strategies.find(entry => entry.questId === questId);
      if (strategy?.actions.some(action => action.id === actionId)) {
        canonical.update(runId, { kind: 'ACTION', questId, id: actionId, revision: strategy.revision, confirmed });
      }
      return;
    }
    setState(current => {
      const currentActions = actionsForCurrentScope(current, runId, strategies);
      const existing = currentActions[questId] ?? [];
      const nextActionIds = confirmed
        ? [...existing, actionId]
        : existing.filter(id => id !== actionId);
      const next = normalizeRuneProofPreviewActions({
        ...currentActions,
        [questId]: nextActionIds,
      }, strategies);
      writeRuneProofPreviewActions(activeStorage, runId, strategies, next);
      return { runId, strategies, actions: next };
    });
  }, [activeStorage, runId, strategies, canonical]);

  return { actionsByQuest, confirmedActionIdsFor, setActionConfirmed };
}
