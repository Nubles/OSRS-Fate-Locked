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

export interface RuneProofPreviewCheckControls {
  checks: RuneProofPreviewChecks;
  confirmedItemKeys(questId: string): ReadonlySet<string>;
  setItemConfirmed(questId: string, itemKey: string, confirmed: boolean): void;
}

export function useRuneProofPreviewChecks(
  runId: string,
  storage?: RuneProofStorage,
): RuneProofPreviewCheckControls {
  const activeStorage = storage ?? defaultStorage();
  const [checks, setChecks] = useState<RuneProofPreviewChecks>(() => (
    readRuneProofPreviewChecks(activeStorage, runId)
  ));

  useEffect(() => {
    setChecks(readRuneProofPreviewChecks(activeStorage, runId));
  }, [activeStorage, runId]);

  const confirmedItemKeys = useCallback(
    (questId: string): ReadonlySet<string> => new Set(checks[questId] ?? []),
    [checks],
  );

  const setItemConfirmed = useCallback((questId: string, itemKey: string, confirmed: boolean) => {
    setChecks(current => {
      const existing = current[questId] ?? [];
      const nextKeys = confirmed
        ? [...existing, itemKey]
        : existing.filter(key => key !== itemKey);
      const next = normalizeRuneProofPreviewChecks({ ...current, [questId]: nextKeys });
      writeRuneProofPreviewChecks(activeStorage, runId, next);
      return next;
    });
  }, [activeStorage, runId]);

  return { checks, confirmedItemKeys, setItemConfirmed };
}
