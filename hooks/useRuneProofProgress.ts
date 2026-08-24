import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RuneProofStorage } from '../utils/questRoutes/previewChecks';
import {
  resolveRuneProofBranch,
  type RuneProofBranchEvaluation,
  withSelectedRuneProofBranch,
} from '../utils/questStrategies/branches';
import type { RuneProofCompiledPack } from '../utils/questStrategies/packModel';
import {
  migrateRuneProofProgressV1,
  migrateRuneProofQuestProgressRevision,
  isRuneProofActionComplete,
  normalizeRuneProofQuestProgress,
  readRuneProofProgressIndex,
  readRuneProofQuestProgressSourceResult,
  writeRuneProofQuestProgress,
  type RuneProofProgressIndexV2,
  type RuneProofProgressSummary,
  type RuneProofQuestProgressV2,
  type RuneProofQuestProgressSourceReadResult,
} from '../utils/questStrategies/progress';

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

const emptyIndex = (runId: string): RuneProofProgressIndexV2 => ({
  schemaVersion: 2,
  runId,
  entries: {},
});

interface IndexState {
  readonly runId?: string;
  readonly storage?: RuneProofStorage;
  readonly index: RuneProofProgressIndexV2;
  readonly hydrated: boolean;
  readonly warnings: readonly string[];
}

interface SelectedState {
  readonly scope?: string;
  readonly storage?: RuneProofStorage;
  readonly selectedQuestId?: string;
  readonly progress?: RuneProofQuestProgressV2;
  readonly hydrated: boolean;
  readonly warnings: readonly string[];
}

export interface RuneProofProgressControls {
  readonly runId: string;
  readonly index: RuneProofProgressIndexV2;
  readonly isIndexHydrated: boolean;
  readonly selectedQuestId?: string;
  readonly selectedProgress?: RuneProofQuestProgressV2;
  readonly isSelectedHydrated: boolean;
  readonly warnings: readonly string[];
  summaryFor(questId: string): RuneProofProgressSummary | undefined;
  setActionConfirmed(actionId: string, confirmed: boolean): void;
  setItemConfirmed(itemKey: string, confirmed: boolean): void;
  setManualConfirmed(confirmationId: string, confirmed: boolean): void;
  setCheckpointConfirmed(checkpointId: string, confirmed: boolean): void;
  selectBranch(
    branchId: string,
    evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>,
  ): void;
}

const scopeFor = (
  runId: string,
  pack: RuneProofCompiledPack | undefined,
): string => [
  runId,
  pack?.questId ?? '',
  pack?.catalogue.slug ?? '',
  pack?.revision ?? '',
].join('\u0000');

const appendWarning = (warnings: readonly string[], warning: string): readonly string[] => (
  warnings.at(-1) === warning ? warnings : [...warnings, warning]
);

const now = (): string => new Date().toISOString();

const sameProofState = (
  left: RuneProofQuestProgressV2,
  right: RuneProofQuestProgressV2,
): boolean => left.selectedBranchId === right.selectedBranchId
  && left.confirmedActionIds.length === right.confirmedActionIds.length
  && left.confirmedActionIds.every((id, index) => right.confirmedActionIds[index] === id)
  && left.confirmedItemKeys.length === right.confirmedItemKeys.length
  && left.confirmedItemKeys.every((id, index) => right.confirmedItemKeys[index] === id)
  && left.manualConfirmationIds.length === right.manualConfirmationIds.length
  && left.manualConfirmationIds.every((id, index) => right.manualConfirmationIds[index] === id)
  && left.confirmedCheckpointIds.length === right.confirmedCheckpointIds.length
  && left.confirmedCheckpointIds.every(
    (id, index) => right.confirmedCheckpointIds[index] === id,
  );

const emptyProgress = (
  runId: string,
  pack: RuneProofCompiledPack,
): RuneProofQuestProgressV2 => ({
  schemaVersion: 2,
  runId,
  questId: pack.questId,
  packRevision: pack.revision,
  confirmedActionIds: [],
  confirmedItemKeys: [],
  manualConfirmationIds: [],
  confirmedCheckpointIds: [],
  updatedAt: now(),
});

const needsReviewEvaluations = (
  pack: RuneProofCompiledPack,
): Readonly<Record<string, RuneProofBranchEvaluation>> => Object.fromEntries(
  pack.branches.map(branch => [branch.id, {
    state: 'NEEDS_REVIEW' as const,
    evidenceComplete: false,
  }]),
);

type ConfirmationField = 'confirmedActionIds' | 'confirmedItemKeys'
  | 'manualConfirmationIds' | 'confirmedCheckpointIds';

interface ChangedConfirmation {
  readonly field: ConfirmationField;
  readonly id: string;
}

const isChangedCompletionTarget = (
  action: RuneProofCompiledPack['sharedActions'][number],
  changed: ChangedConfirmation,
): boolean => action.completion.kind === 'ACTION_CONFIRMED'
  || action.completion.kind === 'CANONICAL_QUEST_COMPLETED'
  ? changed.field === 'confirmedActionIds' && changed.id === action.id
  : action.completion.kind === 'ITEM_CONFIRMED'
    ? changed.field === 'confirmedItemKeys' && changed.id === action.completion.itemKey
    : action.completion.kind === 'MANUAL'
      ? changed.field === 'manualConfirmationIds'
        && changed.id === action.completion.confirmationId
      : action.completion.kind === 'BRANCH_CHECKPOINT'
        ? changed.field === 'confirmedCheckpointIds'
          && changed.id === action.completion.checkpointId
        : false;

const branchPinnedByNewlyCompleteAction = (
  pack: RuneProofCompiledPack,
  before: RuneProofQuestProgressV2,
  after: RuneProofQuestProgressV2,
  changed: ChangedConfirmation,
): string | undefined => {
  const actions = [
    ...pack.sharedActions,
    ...pack.branches.flatMap(branch => branch.actions),
  ];
  const completesMatchingAction = actions.some(action => (
    isChangedCompletionTarget(action, changed)
      && !isRuneProofActionComplete(action, before)
      && isRuneProofActionComplete(action, after)
  ));
  if (!completesMatchingAction) return undefined;
  const progress = {
    confirmedActionIds: [] as string[],
    confirmedItemKeys: [] as string[],
    manualConfirmationIds: [] as string[],
    confirmedCheckpointIds: [] as string[],
  };
  progress[changed.field] = [changed.id];
  const resolved = resolveRuneProofBranch({
    pack,
    evaluations: needsReviewEvaluations(pack),
    progress,
  });
  return resolved.pinned ? resolved.branchId : undefined;
};

export function useRuneProofProgress(
  runId: string,
  packs: readonly RuneProofCompiledPack[],
  selectedQuestId?: string,
  storage?: RuneProofStorage,
): RuneProofProgressControls {
  const activeStorage = useMemo(() => storage ?? defaultStorage(), [storage]);
  const selectedPack = useMemo(() => (
    selectedQuestId === undefined
      ? undefined
      : packs.find(pack => pack.questId === selectedQuestId)
  ), [packs, selectedQuestId]);
  const selectedScope = scopeFor(runId, selectedPack);

  const [indexState, setIndexState] = useState<IndexState>(() => ({
    index: emptyIndex(runId),
    hydrated: false,
    warnings: [],
  }));
  const [selectedState, setSelectedState] = useState<SelectedState>(() => ({
    hydrated: false,
    warnings: [],
  }));
  const selectedStateRef = useRef(selectedState);
  selectedStateRef.current = selectedState;

  const indexIsCurrent = indexState.runId === runId
    && indexState.storage === activeStorage
    && indexState.hydrated;
  const index = indexIsCurrent ? indexState.index : emptyIndex(runId);

  useEffect(() => {
    const result = readRuneProofProgressIndex(activeStorage, runId);
    setIndexState({
      runId,
      storage: activeStorage,
      index: result.index,
      hydrated: true,
      warnings: result.warnings,
    });
  }, [activeStorage, runId]);

  useEffect(() => {
    if (!indexIsCurrent) return;
    if (!selectedPack) {
      const next: SelectedState = {
        scope: selectedScope,
        storage: activeStorage,
        hydrated: true,
        warnings: [],
      };
      selectedStateRef.current = next;
      setSelectedState(next);
      return;
    }
    const pending: SelectedState = {
      scope: selectedScope,
      storage: activeStorage,
      selectedQuestId: selectedPack.questId,
      hydrated: false,
      warnings: [],
    };
    selectedStateRef.current = pending;
    setSelectedState(pending);
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const source = readRuneProofQuestProgressSourceResult({
        storage: activeStorage,
        runId,
        questSlug: selectedPack.catalogue.slug,
        questId: selectedPack.questId,
      });
      let progress: RuneProofQuestProgressV2 | undefined;
      let warnings: readonly string[] = [];
      let refreshIndex = false;

      if (source.status === 'MALFORMED') {
        warnings = [
          `RuneProof progress for ${selectedPack.questId} is malformed and was preserved.`,
        ];
      } else if (source.status === 'VALID') {
        if (source.progress.packRevision === selectedPack.revision) {
          progress = normalizeRuneProofQuestProgress({
            progress: source.progress,
            runId,
            pack: selectedPack,
          }) ?? undefined;
          if (!progress) {
            warnings = [
              `RuneProof progress for ${selectedPack.questId} is malformed and was preserved.`,
            ];
          }
        } else {
          progress = migrateRuneProofQuestProgressRevision({
            storage: activeStorage,
            runId,
            questSlug: selectedPack.catalogue.slug,
            pack: selectedPack,
            now,
          }) ?? undefined;
          if (progress) refreshIndex = true;
          else {
            warnings = [
              `RuneProof progress for ${selectedPack.questId} uses revision ${source.progress.packRevision}; no exact migration was committed.`,
            ];
          }
        }
      } else {
        let racedV2: RuneProofQuestProgressSourceReadResult | undefined;
        const migrated = migrateRuneProofProgressV1({
          storage: activeStorage,
          runId,
          packs: [selectedPack],
          questSlugs: new Map([[selectedPack.questId, selectedPack.catalogue.slug]]),
          onPreservedV2: (_questId, preserved) => { racedV2 = preserved; },
          now,
        });
        if (migrated.migratedQuestIds.includes(selectedPack.questId)) {
          const reread = readRuneProofQuestProgressSourceResult({
            storage: activeStorage,
            runId,
            questSlug: selectedPack.catalogue.slug,
            questId: selectedPack.questId,
          });
          if (reread.status === 'VALID') {
            progress = normalizeRuneProofQuestProgress({
              progress: reread.progress,
              runId,
              pack: selectedPack,
            }) ?? undefined;
          }
          refreshIndex = progress !== undefined;
        } else if (migrated.failedQuestIds.includes(selectedPack.questId)) {
          warnings = [`RuneProof could not migrate progress for ${selectedPack.questId}.`];
        } else if (racedV2?.status === 'MALFORMED') {
          warnings = [
            `RuneProof progress for ${selectedPack.questId} is malformed and was preserved.`,
          ];
        } else if (racedV2?.status === 'VALID') {
          if (racedV2.progress.packRevision === selectedPack.revision) {
            progress = normalizeRuneProofQuestProgress({
              progress: racedV2.progress,
              runId,
              pack: selectedPack,
            }) ?? undefined;
            if (!progress) {
              warnings = [
                `RuneProof progress for ${selectedPack.questId} is malformed and was preserved.`,
              ];
            }
          } else {
            progress = migrateRuneProofQuestProgressRevision({
              storage: activeStorage,
              runId,
              questSlug: selectedPack.catalogue.slug,
              pack: selectedPack,
              now,
            }) ?? undefined;
            if (progress) refreshIndex = true;
            else {
              warnings = [
                `RuneProof progress for ${selectedPack.questId} uses revision ${racedV2.progress.packRevision}; no exact migration was committed.`,
              ];
            }
          }
        } else {
          progress = emptyProgress(runId, selectedPack);
        }
      }

      if (cancelled) return;
      const next: SelectedState = {
        scope: selectedScope,
        storage: activeStorage,
        selectedQuestId: selectedPack.questId,
        ...(progress === undefined ? {} : { progress }),
        hydrated: true,
        warnings,
      };
      selectedStateRef.current = next;
      setSelectedState(next);
      if (refreshIndex) {
        const refreshed = readRuneProofProgressIndex(activeStorage, runId);
        setIndexState(current => (
          current.runId === runId && current.storage === activeStorage
            ? {
              ...current,
              index: refreshed.index,
              warnings: [...current.warnings, ...refreshed.warnings],
            }
            : current
        ));
      }
    });
    return () => { cancelled = true; };
  }, [activeStorage, indexIsCurrent, runId, selectedPack, selectedScope]);

  const selectedIsCurrent = selectedState.scope === selectedScope
    && selectedState.storage === activeStorage
    && selectedState.hydrated;
  const selectedProgress = selectedIsCurrent ? selectedState.progress : undefined;

  const commitProgress = useCallback((
    transform: (progress: RuneProofQuestProgressV2) => RuneProofQuestProgressV2,
    changedConfirmation?: ChangedConfirmation,
  ): void => {
    if (!selectedPack) return;
    const current = selectedStateRef.current;
    if (current.scope !== selectedScope
      || current.storage !== activeStorage
      || !current.hydrated
      || !current.progress) return;

    const candidate = transform(current.progress);
    let proofNormalized = normalizeRuneProofQuestProgress({
      progress: candidate,
      runId,
      pack: selectedPack,
    });
    if (!proofNormalized) return;
    if (changedConfirmation !== undefined
      && proofNormalized.selectedBranchId === undefined) {
      const branchId = branchPinnedByNewlyCompleteAction(
        selectedPack,
        current.progress,
        proofNormalized,
        changedConfirmation,
      );
      if (branchId !== undefined) {
        proofNormalized = { ...proofNormalized, selectedBranchId: branchId };
      }
    }
    if (sameProofState(current.progress, proofNormalized)) return;
    const timestamp = now();
    const normalized = normalizeRuneProofQuestProgress({
      progress: proofNormalized,
      runId,
      pack: selectedPack,
      now: () => timestamp,
    });
    if (!normalized) return;
    const written = writeRuneProofQuestProgress({
      storage: activeStorage,
      runId,
      questSlug: selectedPack.catalogue.slug,
      pack: selectedPack,
      progress: normalized,
      now: () => timestamp,
    });
    if (!written) {
      const warning = `RuneProof could not persist progress for ${selectedPack.questId}.`;
      setSelectedState(existing => {
        if (existing.scope !== selectedScope || existing.storage !== activeStorage) {
          return existing;
        }
        const next = { ...existing, warnings: appendWarning(existing.warnings, warning) };
        selectedStateRef.current = next;
        return next;
      });
      return;
    }

    const next: SelectedState = {
      ...current,
      progress: normalized,
    };
    selectedStateRef.current = next;
    setSelectedState(existing => (
      existing.scope === selectedScope && existing.storage === activeStorage
        ? next
        : existing
    ));
    const refreshed = readRuneProofProgressIndex(activeStorage, runId);
    setIndexState(existing => (
      existing.runId === runId && existing.storage === activeStorage
        ? {
          ...existing,
          index: refreshed.index,
          warnings: [...existing.warnings, ...refreshed.warnings],
        }
        : existing
    ));
  }, [activeStorage, runId, selectedPack, selectedScope]);

  const updateConfirmation = useCallback((
    field: ConfirmationField,
    id: string,
    confirmed: boolean,
  ): void => {
    const current = selectedStateRef.current;
    const existing = current.progress?.[field];
    if (!existing) return;
    const alreadyConfirmed = existing.includes(id);
    if (alreadyConfirmed === confirmed) return;
    commitProgress(progress => ({
      ...progress,
      [field]: confirmed ? [...progress[field], id] : progress[field].filter(value => value !== id),
    }), confirmed ? { field, id } : undefined);
  }, [commitProgress]);

  const setActionConfirmed = useCallback((actionId: string, confirmed: boolean): void => {
    updateConfirmation('confirmedActionIds', actionId, confirmed);
  }, [updateConfirmation]);
  const setItemConfirmed = useCallback((itemKey: string, confirmed: boolean): void => {
    updateConfirmation('confirmedItemKeys', itemKey, confirmed);
  }, [updateConfirmation]);
  const setManualConfirmed = useCallback((confirmationId: string, confirmed: boolean): void => {
    updateConfirmation('manualConfirmationIds', confirmationId, confirmed);
  }, [updateConfirmation]);
  const setCheckpointConfirmed = useCallback((checkpointId: string, confirmed: boolean): void => {
    updateConfirmation('confirmedCheckpointIds', checkpointId, confirmed);
  }, [updateConfirmation]);

  const selectBranch = useCallback((
    branchId: string,
    evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>,
  ): void => {
    const current = selectedStateRef.current;
    if (!selectedPack
      || current.scope !== selectedScope
      || current.storage !== activeStorage
      || !current.progress) return;
    let selected: RuneProofQuestProgressV2;
    try {
      selected = withSelectedRuneProofBranch(
        current.progress,
        branchId,
        selectedPack,
        evaluations,
      );
    } catch {
      return;
    }
    commitProgress(() => selected);
  }, [activeStorage, commitProgress, selectedPack, selectedScope]);

  const summaryFor = useCallback((questId: string): RuneProofProgressSummary | undefined => {
    const pack = packs.find(candidate => candidate.questId === questId);
    return pack === undefined ? undefined : index.entries[pack.catalogue.slug];
  }, [index.entries, packs]);

  return {
    runId,
    index,
    isIndexHydrated: indexIsCurrent,
    ...(selectedPack === undefined ? {} : { selectedQuestId: selectedPack.questId }),
    ...(selectedProgress === undefined ? {} : { selectedProgress }),
    isSelectedHydrated: selectedIsCurrent,
    warnings: [
      ...(indexIsCurrent ? indexState.warnings : []),
      ...(selectedIsCurrent ? selectedState.warnings : []),
    ],
    summaryFor,
    setActionConfirmed,
    setItemConfirmed,
    setManualConfirmed,
    setCheckpointConfirmed,
    selectBranch,
  };
}
