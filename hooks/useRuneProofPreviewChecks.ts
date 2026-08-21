import { useCallback, useEffect, useState } from 'react';
import {
  normalizeRuneProofPreviewChecks,
  readRuneProofPreviewChecks,
  type RuneProofPreviewChecks,
  type RuneProofStorage,
  writeRuneProofPreviewChecks,
} from '../utils/questRoutes/previewChecks';

const unavailableStorage: RuneProofStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const defaultStorage = (): RuneProofStorage => (
  typeof window === 'undefined' ? unavailableStorage : window.localStorage
);

interface RuneProofPreviewCheckState {
  readonly runId: string;
  readonly checks: RuneProofPreviewChecks;
}

const checksForCurrentRun = (
  state: RuneProofPreviewCheckState,
  runId: string,
): RuneProofPreviewChecks => (
  state.runId === runId ? state.checks : {}
);

export interface RuneProofPreviewCheckControls {
  checks: RuneProofPreviewChecks;
  readonly isHydratedForRun: boolean;
  confirmedItemKeys(questId: string): ReadonlySet<string>;
  setItemConfirmed(questId: string, itemKey: string, confirmed: boolean): void;
}

export function useRuneProofPreviewChecks(
  runId: string,
  storage?: RuneProofStorage,
): RuneProofPreviewCheckControls {
  const activeStorage = storage ?? defaultStorage();
  const [state, setState] = useState<RuneProofPreviewCheckState>(() => ({
    runId,
    checks: readRuneProofPreviewChecks(activeStorage, runId),
  }));

  useEffect(() => {
    setState({
      runId,
      checks: readRuneProofPreviewChecks(activeStorage, runId),
    });
  }, [activeStorage, runId]);

  const checks = checksForCurrentRun(state, runId);
  const isHydratedForRun = state.runId === runId;

  const confirmedItemKeys = useCallback(
    (questId: string): ReadonlySet<string> => new Set(checks[questId] ?? []),
    [checks],
  );

  const setItemConfirmed = useCallback((questId: string, itemKey: string, confirmed: boolean) => {
    setState(current => {
      const currentChecks = checksForCurrentRun(current, runId);
      const existing = currentChecks[questId] ?? [];
      const nextKeys = confirmed
        ? [...existing, itemKey]
        : existing.filter(key => key !== itemKey);
      const next = normalizeRuneProofPreviewChecks({ ...currentChecks, [questId]: nextKeys });
      writeRuneProofPreviewChecks(activeStorage, runId, next);
      return { runId, checks: next };
    });
  }, [activeStorage, runId]);

  return { checks, isHydratedForRun, confirmedItemKeys, setItemConfirmed };
}
