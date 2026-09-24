import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CanonicalRuneProofControls } from '../utils/runeProofProgress';
import {
  normalizeRuneProofPreviewChecks,
  readRuneProofPreviewChecks,
  type RuneProofPreviewChecks,
  type RuneProofRequirementLookup,
  type RuneProofStorage,
  writeRuneProofPreviewChecks,
} from '../utils/questRoutes/previewChecks';

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

/** Without requirementsFor, only the built-in reviewed item lists are accepted. */
export function useRuneProofPreviewChecks(
  runId: string,
  storage?: RuneProofStorage,
  canonical?: CanonicalRuneProofControls,
  requirementsFor?: RuneProofRequirementLookup,
): RuneProofPreviewCheckControls {
  const activeStorage = canonical ? unavailableStorage : storage ?? defaultStorage();
  const [state, setState] = useState<RuneProofPreviewCheckState>(() => ({
    runId,
    checks: readRuneProofPreviewChecks(activeStorage, runId, requirementsFor),
  }));

  useEffect(() => {
    if (canonical) return;
    setState({
      runId,
      checks: readRuneProofPreviewChecks(activeStorage, runId, requirementsFor),
    });
  }, [activeStorage, runId, canonical, requirementsFor]);

  const checks = useMemo(() => canonical
    ? normalizeRuneProofPreviewChecks(canonical.progress?.items ?? {}, requirementsFor)
    : checksForCurrentRun(state, runId), [canonical, state, runId, requirementsFor]);
  const isHydratedForRun = !!canonical || state.runId === runId;

  const confirmedItemKeys = useCallback(
    (questId: string): ReadonlySet<string> => new Set(checks[questId] ?? []),
    [checks],
  );

  const setItemConfirmed = useCallback((questId: string, itemKey: string, confirmed: boolean) => {
    if (canonical) {
      if (normalizeRuneProofPreviewChecks({ [questId]: [itemKey] }, requirementsFor)[questId]?.includes(itemKey)) {
        canonical.update(runId, { kind: 'ITEM', questId, id: itemKey, confirmed });
      }
      return;
    }
    setState(current => {
      const currentChecks = checksForCurrentRun(current, runId);
      const existing = currentChecks[questId] ?? [];
      const nextKeys = confirmed
        ? [...existing, itemKey]
        : existing.filter(key => key !== itemKey);
      const next = normalizeRuneProofPreviewChecks({ ...currentChecks, [questId]: nextKeys }, requirementsFor);
      writeRuneProofPreviewChecks(activeStorage, runId, next, requirementsFor);
      return { runId, checks: next };
    });
  }, [activeStorage, runId, canonical, requirementsFor]);

  return { checks, isHydratedForRun, confirmedItemKeys, setItemConfirmed };
}
