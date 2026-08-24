import type { RuneProofStorage } from '../questRoutes/previewChecks';
import { runeProofPreviewStorageKey } from '../questRoutes/previewChecks';
import { resolveRuneProofBranch } from './branches';
import { runeProofPreviewActionStorageKey } from './previewActions';
import type {
  RequirementExpression,
  RuneProofAction,
  RuneProofAtomicRequirement,
  RuneProofBranch,
  RuneProofCompiledPack,
} from './packModel';

export const RUNEPROOF_PROGRESS_MAX_CHARS = 65_536;
export const RUNEPROOF_PROGRESS_INDEX_MAX_CHARS = 65_536;
export const RUNEPROOF_PROGRESS_TRANSACTION_MAX_CHARS = 393_216;

export interface RuneProofQuestProgressV2 {
  readonly schemaVersion: 2;
  readonly runId: string;
  readonly questId: string;
  readonly packRevision: string;
  readonly selectedBranchId?: string;
  readonly confirmedActionIds: readonly string[];
  readonly confirmedItemKeys: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly confirmedCheckpointIds: readonly string[];
  readonly updatedAt: string;
}

export interface RuneProofProgressSummary {
  readonly questId: string;
  readonly packRevision: string;
  readonly selectedBranchId?: string;
  readonly completedActionCount: number;
  readonly totalActionCount: number;
  readonly complete: boolean;
  readonly updatedAt: string;
}

export interface RuneProofProgressIndexV2 {
  readonly schemaVersion: 2;
  readonly runId: string;
  readonly entries: Readonly<Record<string, RuneProofProgressSummary>>;
}

export interface RuneProofProgressIndexReadResult {
  readonly index: RuneProofProgressIndexV2;
  readonly warnings: readonly string[];
}

export interface RuneProofProgressMigrationResult {
  readonly migratedQuestIds: readonly string[];
  readonly failedQuestIds: readonly string[];
}

export type RuneProofQuestProgressSourceReadResult =
  | { readonly status: 'ABSENT' }
  | { readonly status: 'MALFORMED' }
  | {
      readonly status: 'VALID';
      readonly progress: RuneProofQuestProgressV2;
    };

interface RuneProofProgressTransactionV2 {
  readonly schemaVersion: 2;
  readonly runId: string;
  readonly questSlug: string;
  readonly previousQuestRecord: string | null;
  readonly previousIndex: string | null;
}

interface RuneProofProgressCommitV2 {
  readonly schemaVersion: 2;
  readonly phase: 'COMMITTED';
  readonly runId: string;
  readonly questSlug: string;
  readonly nextQuestRecord: string;
  readonly nextIndex: string;
}

interface ProofUniverses {
  readonly actions: readonly string[];
  readonly items: readonly string[];
  readonly manuals: readonly string[];
  readonly checkpoints: readonly string[];
  readonly branches: ReadonlySet<string>;
}

const PROGRESS_KEYS = [
  'schemaVersion', 'runId', 'questId', 'packRevision', 'selectedBranchId',
  'confirmedActionIds', 'confirmedItemKeys', 'manualConfirmationIds',
  'confirmedCheckpointIds', 'updatedAt',
] as const;
const INDEX_KEYS = ['schemaVersion', 'runId', 'entries'] as const;
const SUMMARY_KEYS = [
  'questId', 'packRevision', 'selectedBranchId', 'completedActionCount',
  'totalActionCount', 'complete', 'updatedAt',
] as const;
const TRANSACTION_KEYS = [
  'schemaVersion', 'runId', 'questSlug', 'previousQuestRecord', 'previousIndex',
] as const;
const COMMIT_KEYS = [
  'schemaVersion', 'phase', 'runId', 'questSlug', 'nextQuestRecord', 'nextIndex',
] as const;

const runeProofProgressCommitStorageKey = (
  runId: string,
): string => `fate_runeproof_progress_tx_v2:${runId}:committed`;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  optional: readonly string[] = [],
): boolean => {
  const keys = Object.keys(value).sort();
  const optionalSet = new Set(optional);
  const required = allowed.filter(key => !optionalSet.has(key));
  return required.every(key => Object.hasOwn(value, key))
    && keys.every(key => allowed.includes(key));
};

const denseArray = (value: unknown): value is readonly unknown[] => {
  if (!Array.isArray(value)) return false;
  const numericKeys = Object.getOwnPropertyNames(value)
    .filter(key => /^(?:0|[1-9]\d*)$/.test(key));
  if (numericKeys.length !== value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) return false;
  }
  return true;
};

const nonblank = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const denseNonblankStrings = (value: unknown): value is readonly string[] => (
  denseArray(value) && value.every(nonblank)
);

const validTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || Number.isNaN(Date.parse(value))) return false;
  const canonicalInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(value).toISOString() === canonicalInput;
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]),
  );
};

export const canonicalRuneProofProgressJson = (value: unknown): string => (
  JSON.stringify(canonicalValue(value))
);

const stablePush = (values: string[], seen: Set<string>, value: string): void => {
  if (seen.has(value)) return;
  seen.add(value);
  values.push(value);
};

const collectRequirementProofs = (
  expression: RequirementExpression,
  item: (id: string) => void,
  manual: (id: string) => void,
  checkpoint: (id: string) => void,
): void => {
  if (expression.kind === 'ALL' || expression.kind === 'ANY') {
    expression.requirements.forEach(child => (
      collectRequirementProofs(child, item, manual, checkpoint)
    ));
    return;
  }
  if (expression.kind === 'ITEM') item(expression.itemKey);
  else if (expression.kind === 'MANUAL_CONFIRMATION') manual(expression.confirmationId);
  else if (expression.kind === 'BRANCH_STATE' && expression.checkpointId) {
    checkpoint(expression.checkpointId);
  } else if (expression.kind === 'TRANSPORT_ACCESS' && expression.fare) {
    item(expression.fare.itemKey);
  }
};

const proofUniversesFor = (pack: RuneProofCompiledPack): ProofUniverses => {
  const actions: string[] = [];
  const items: string[] = [];
  const manuals: string[] = [];
  const checkpoints: string[] = [];
  const actionSeen = new Set<string>();
  const itemSeen = new Set<string>();
  const manualSeen = new Set<string>();
  const checkpointSeen = new Set<string>();
  const addItem = (id: string): void => stablePush(items, itemSeen, id);
  const addManual = (id: string): void => stablePush(manuals, manualSeen, id);
  const addCheckpoint = (id: string): void => stablePush(checkpoints, checkpointSeen, id);
  const addRequirement = (value: RequirementExpression): void => (
    collectRequirementProofs(value, addItem, addManual, addCheckpoint)
  );
  const addAction = (action: RuneProofAction): void => {
    stablePush(actions, actionSeen, action.id);
    addRequirement(action.requirements);
    action.alternatives.forEach(alternative => addRequirement(alternative.requirements));
    action.itemEffects.forEach((effect) => {
      addItem(effect.itemKey);
      if (effect.kind === 'PRODUCE') effect.from.forEach(input => addItem(input.itemKey));
      if (effect.kind === 'LEND' && effect.replacementItemKey) {
        addItem(effect.replacementItemKey);
      }
    });
    if (action.combat) addManual(action.combat.confirmationId);
    if (action.completion.kind === 'ITEM_CONFIRMED') addItem(action.completion.itemKey);
    else if (action.completion.kind === 'MANUAL') {
      addManual(action.completion.confirmationId);
    } else if (action.completion.kind === 'BRANCH_CHECKPOINT') {
      addCheckpoint(action.completion.checkpointId);
    }
  };

  addRequirement(pack.preflight);
  pack.initialItems.forEach((root) => {
    addItem(root.item.key);
    root.alternatives?.forEach(alternative => addItem(alternative.key));
  });
  pack.sharedActions.forEach(addAction);
  pack.branches.forEach((branch) => {
    addRequirement(branch.requirements);
    branch.actions.forEach(addAction);
    branch.checkpointIds.forEach(addCheckpoint);
  });
  return {
    actions,
    items,
    manuals,
    checkpoints,
    branches: new Set(pack.branches.map(branch => branch.id)),
  };
};

const normalizeIds = (
  requested: readonly string[],
  stableUniverse: readonly string[],
): readonly string[] => {
  const wanted = new Set(requested);
  return stableUniverse.filter(id => wanted.has(id));
};

const structuralProgress = (
  value: unknown,
  runId: string,
  questId: string,
): RuneProofQuestProgressV2 | null => {
  if (!isRecord(value)
    || !exactKeys(value, PROGRESS_KEYS, ['selectedBranchId'])
    || value.schemaVersion !== 2
    || value.runId !== runId
    || value.questId !== questId
    || !nonblank(value.packRevision)
    || !denseNonblankStrings(value.confirmedActionIds)
    || !denseNonblankStrings(value.confirmedItemKeys)
    || !denseNonblankStrings(value.manualConfirmationIds)
    || !denseNonblankStrings(value.confirmedCheckpointIds)
    || !validTimestamp(value.updatedAt)
    || (value.selectedBranchId !== undefined && !nonblank(value.selectedBranchId))) {
    return null;
  }
  const selectedBranchId = value.selectedBranchId as string | undefined;
  return {
    schemaVersion: 2,
    runId,
    questId,
    packRevision: value.packRevision,
    ...(selectedBranchId === undefined ? {} : { selectedBranchId }),
    confirmedActionIds: [...value.confirmedActionIds],
    confirmedItemKeys: [...value.confirmedItemKeys],
    manualConfirmationIds: [...value.manualConfirmationIds],
    confirmedCheckpointIds: [...value.confirmedCheckpointIds],
    updatedAt: value.updatedAt,
  };
};

export const normalizeRuneProofQuestProgress = (input: {
  readonly progress: unknown;
  readonly runId: string;
  readonly pack: RuneProofCompiledPack;
  readonly now?: () => string;
}): RuneProofQuestProgressV2 | null => {
  const source = structuralProgress(input.progress, input.runId, input.pack.questId);
  if (!source || source.packRevision !== input.pack.revision) return null;
  const universes = proofUniversesFor(input.pack);
  if (source.selectedBranchId !== undefined
    && !universes.branches.has(source.selectedBranchId)) return null;
  const updatedAt = input.now?.() ?? source.updatedAt;
  if (!validTimestamp(updatedAt)) return null;
  return {
    schemaVersion: 2,
    runId: input.runId,
    questId: input.pack.questId,
    packRevision: input.pack.revision,
    ...(source.selectedBranchId === undefined
      ? {} : { selectedBranchId: source.selectedBranchId }),
    confirmedActionIds: normalizeIds(source.confirmedActionIds, universes.actions),
    confirmedItemKeys: normalizeIds(source.confirmedItemKeys, universes.items),
    manualConfirmationIds: normalizeIds(source.manualConfirmationIds, universes.manuals),
    confirmedCheckpointIds: normalizeIds(
      source.confirmedCheckpointIds,
      universes.checkpoints,
    ),
    updatedAt,
  };
};

const parseBoundedJson = (raw: string | null, cap: number): unknown | undefined => {
  if (raw === null || raw.length > cap) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

export const readRuneProofQuestProgressSourceResult = (input: {
  readonly storage: RuneProofStorage;
  readonly runId: string;
  readonly questSlug: string;
  readonly questId: string;
}): RuneProofQuestProgressSourceReadResult => {
  try {
    const raw = input.storage.getItem(
      runeProofProgressStorageKey(input.runId, input.questSlug),
    );
    if (raw === null) return { status: 'ABSENT' };
    const parsed = parseBoundedJson(raw, RUNEPROOF_PROGRESS_MAX_CHARS);
    if (parsed === undefined) return { status: 'MALFORMED' };
    const progress = structuralProgress(parsed, input.runId, input.questId);
    return progress === null
      ? { status: 'MALFORMED' }
      : { status: 'VALID', progress };
  } catch {
    return { status: 'MALFORMED' };
  }
};

export const readRuneProofQuestProgressSource = (input: {
  readonly storage: RuneProofStorage;
  readonly runId: string;
  readonly questSlug: string;
  readonly questId: string;
}): RuneProofQuestProgressV2 | null => {
  const result = readRuneProofQuestProgressSourceResult(input);
  return result.status === 'VALID' ? result.progress : null;
};

export const readRuneProofQuestProgress = (input: {
  readonly storage: RuneProofStorage;
  readonly runId: string;
  readonly questSlug: string;
  readonly pack: RuneProofCompiledPack;
}): RuneProofQuestProgressV2 | null => {
  const source = readRuneProofQuestProgressSource({
    storage: input.storage,
    runId: input.runId,
    questSlug: input.questSlug,
    questId: input.pack.questId,
  });
  return source === null ? null : normalizeRuneProofQuestProgress({
    progress: source,
    runId: input.runId,
    pack: input.pack,
  });
};

export interface RuneProofManualObligationSelection {
  readonly satisfied: boolean;
  readonly requirements: readonly Extract<
    RuneProofAtomicRequirement,
    { kind: 'MANUAL_CONFIRMATION' }
  >[];
}

const deduplicateManualRequirements = (
  requirements: RuneProofManualObligationSelection['requirements'],
): RuneProofManualObligationSelection['requirements'] => {
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    if (seen.has(requirement.confirmationId)) return false;
    seen.add(requirement.confirmationId);
    return true;
  });
};

export const selectRuneProofManualObligations = (
  expression: RequirementExpression,
  confirmedIds: ReadonlySet<string>,
): RuneProofManualObligationSelection => {
  if (expression.kind === 'MANUAL_CONFIRMATION') {
    return {
      satisfied: confirmedIds.has(expression.confirmationId),
      requirements: [expression],
    };
  }
  if (expression.kind !== 'ALL' && expression.kind !== 'ANY') {
    return { satisfied: true, requirements: [] };
  }
  const children = expression.requirements.map(child => (
    selectRuneProofManualObligations(child, confirmedIds)
  ));
  if (expression.kind === 'ALL') {
    return {
      satisfied: children.every(child => child.satisfied),
      requirements: deduplicateManualRequirements(
        children.flatMap(child => child.requirements),
      ),
    };
  }
  const bearing = children.filter(child => child.requirements.length > 0);
  if (bearing.length === 0) return { satisfied: true, requirements: [] };
  const selected = bearing.find(child => child.satisfied) ?? bearing[0];
  return {
    satisfied: selected.satisfied,
    requirements: deduplicateManualRequirements(selected.requirements),
  };
};

export const isRuneProofActionComplete = (
  action: RuneProofAction,
  progress: Pick<
    RuneProofQuestProgressV2,
    | 'confirmedActionIds' | 'confirmedItemKeys' | 'manualConfirmationIds'
    | 'confirmedCheckpointIds'
  >,
): boolean => {
  const targetSatisfied = action.completion.kind === 'ITEM_CONFIRMED'
    ? progress.confirmedItemKeys.includes(action.completion.itemKey)
    : action.completion.kind === 'MANUAL'
      ? progress.manualConfirmationIds.includes(action.completion.confirmationId)
      : action.completion.kind === 'BRANCH_CHECKPOINT'
        ? progress.confirmedCheckpointIds.includes(action.completion.checkpointId)
        : action.completion.kind === 'ACTION_CONFIRMED'
          || action.completion.kind === 'CANONICAL_QUEST_COMPLETED'
          ? progress.confirmedActionIds.includes(action.id)
          : false;
  if (!targetSatisfied) return false;
  const manuals = selectRuneProofManualObligations(
    action.requirements,
    new Set(progress.manualConfirmationIds),
  );
  return manuals.satisfied
    && (!action.combat
      || progress.manualConfirmationIds.includes(action.combat.confirmationId));
};

const orderedRoute = (
  pack: RuneProofCompiledPack,
  branch: RuneProofBranch,
): readonly RuneProofAction[] => [...pack.sharedActions, ...branch.actions]
  .sort((left, right) => left.sourceOrder - right.sourceOrder
    || left.id.localeCompare(right.id));

export const isRuneProofRouteComplete = (
  pack: RuneProofCompiledPack,
  branch: RuneProofBranch,
  progress: RuneProofQuestProgressV2,
): boolean => {
  const route = orderedRoute(pack, branch);
  if (route.length === 0 || !route.every(action => isRuneProofActionComplete(action, progress))) {
    return false;
  }
  const confirmed = new Set(progress.manualConfirmationIds);
  return selectRuneProofManualObligations(pack.preflight, confirmed).satisfied
    && selectRuneProofManualObligations(branch.requirements, confirmed).satisfied;
};

const emptyIndex = (runId: string): RuneProofProgressIndexV2 => ({
  schemaVersion: 2,
  runId,
  entries: {},
});

const parseSummary = (value: unknown): RuneProofProgressSummary | null => {
  if (!isRecord(value)
    || !exactKeys(value, SUMMARY_KEYS, ['selectedBranchId'])
    || !nonblank(value.questId)
    || !nonblank(value.packRevision)
    || (value.selectedBranchId !== undefined && !nonblank(value.selectedBranchId))
    || typeof value.completedActionCount !== 'number'
    || !Number.isInteger(value.completedActionCount)
    || value.completedActionCount < 0
    || typeof value.totalActionCount !== 'number'
    || !Number.isInteger(value.totalActionCount)
    || value.totalActionCount < value.completedActionCount
    || typeof value.complete !== 'boolean'
    || !validTimestamp(value.updatedAt)) return null;
  const selectedBranchId = value.selectedBranchId as string | undefined;
  return {
    questId: value.questId,
    packRevision: value.packRevision,
    ...(selectedBranchId === undefined ? {} : { selectedBranchId }),
    completedActionCount: value.completedActionCount,
    totalActionCount: value.totalActionCount,
    complete: value.complete,
    updatedAt: value.updatedAt,
  };
};

const parseIndex = (
  raw: string | null,
  runId: string,
): RuneProofProgressIndexV2 | null => {
  if (raw === null) return emptyIndex(runId);
  const value = parseBoundedJson(raw, RUNEPROOF_PROGRESS_INDEX_MAX_CHARS);
  if (!isRecord(value)
    || !exactKeys(value, INDEX_KEYS)
    || value.schemaVersion !== 2
    || value.runId !== runId
    || !isRecord(value.entries)) return null;
  const entryPairs: [string, RuneProofProgressSummary][] = [];
  for (const questSlug of Object.keys(value.entries).sort()) {
    if (!nonblank(questSlug)) return null;
    const summary = parseSummary(value.entries[questSlug]);
    if (!summary) return null;
    entryPairs.push([questSlug, summary]);
  }
  return { schemaVersion: 2, runId, entries: Object.fromEntries(entryPairs) };
};

const parseTransaction = (
  raw: string | null,
  runId: string,
): RuneProofProgressTransactionV2 | null => {
  const value = parseBoundedJson(raw, RUNEPROOF_PROGRESS_TRANSACTION_MAX_CHARS);
  if (!isRecord(value)
    || !exactKeys(value, TRANSACTION_KEYS)
    || value.schemaVersion !== 2
    || value.runId !== runId
    || !nonblank(value.questSlug)
    || (value.previousQuestRecord !== null && typeof value.previousQuestRecord !== 'string')
    || (value.previousIndex !== null && typeof value.previousIndex !== 'string')) return null;
  const previousQuestRecord = value.previousQuestRecord as string | null;
  const previousIndex = value.previousIndex as string | null;
  return {
    schemaVersion: 2,
    runId,
    questSlug: value.questSlug,
    previousQuestRecord,
    previousIndex,
  };
};

const parseCommit = (
  raw: string | null,
  runId: string,
): RuneProofProgressCommitV2 | null => {
  const value = parseBoundedJson(raw, RUNEPROOF_PROGRESS_TRANSACTION_MAX_CHARS);
  if (!isRecord(value)
    || !exactKeys(value, COMMIT_KEYS)
    || value.schemaVersion !== 2
    || value.phase !== 'COMMITTED'
    || value.runId !== runId
    || !nonblank(value.questSlug)
    || typeof value.nextQuestRecord !== 'string'
    || value.nextQuestRecord.length > RUNEPROOF_PROGRESS_MAX_CHARS
    || typeof value.nextIndex !== 'string'
    || value.nextIndex.length > RUNEPROOF_PROGRESS_INDEX_MAX_CHARS) return null;
  const nextIndex = parseIndex(value.nextIndex, runId);
  if (!nextIndex
    || canonicalRuneProofProgressJson(nextIndex) !== value.nextIndex) return null;
  const summary = nextIndex.entries[value.questSlug];
  if (!summary) return null;
  const nextProgress = structuralProgress(
    parseBoundedJson(value.nextQuestRecord, RUNEPROOF_PROGRESS_MAX_CHARS),
    runId,
    summary.questId,
  );
  if (!nextProgress
    || canonicalRuneProofProgressJson(nextProgress) !== value.nextQuestRecord
    || nextProgress.packRevision !== summary.packRevision
    || (nextProgress.selectedBranchId !== undefined
      && nextProgress.selectedBranchId !== summary.selectedBranchId)
    || nextProgress.updatedAt !== summary.updatedAt) return null;
  return {
    schemaVersion: 2,
    phase: 'COMMITTED',
    runId,
    questSlug: value.questSlug,
    nextQuestRecord: value.nextQuestRecord,
    nextIndex: value.nextIndex,
  };
};

const restoreRaw = (
  storage: RuneProofStorage,
  key: string,
  value: string | null,
): void => {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
};

const recoverTransaction = (
  storage: RuneProofStorage,
  runId: string,
): readonly string[] => {
  const txKey = runeProofProgressTransactionStorageKey(runId);
  const commitKey = runeProofProgressCommitStorageKey(runId);
  let raw: string | null;
  let commitRaw: string | null;
  try {
    commitRaw = storage.getItem(commitKey);
    raw = storage.getItem(txKey);
  } catch {
    return [`RuneProof could not inspect interrupted progress for run ${runId}.`];
  }
  if (raw === null && commitRaw === null) return [];
  const commit = parseCommit(commitRaw, runId);
  const transaction = parseTransaction(raw, runId);
  const commitMatchesPrepared = raw === null
    || (transaction !== null && transaction.questSlug === commit?.questSlug);
  if (commitRaw !== null && commit !== null && commitMatchesPrepared) {
    const recordKey = runeProofProgressStorageKey(runId, commit.questSlug);
    const indexKey = runeProofProgressIndexStorageKey(runId);
    try {
      restoreRaw(storage, recordKey, commit.nextQuestRecord);
      restoreRaw(storage, indexKey, commit.nextIndex);
      if (storage.getItem(recordKey) !== commit.nextQuestRecord
        || storage.getItem(indexKey) !== commit.nextIndex) {
        return [`RuneProof could not recover committed progress for run ${runId}.`];
      }
      storage.removeItem(txKey);
      if (storage.getItem(txKey) !== null) {
        return [`RuneProof could not recover committed progress for run ${runId}.`];
      }
      storage.removeItem(commitKey);
      if (storage.getItem(commitKey) !== null) {
        return [`RuneProof could not recover committed progress for run ${runId}.`];
      }
      return [`RuneProof recovered committed progress for run ${runId}.`];
    } catch {
      return [`RuneProof could not recover committed progress for run ${runId}.`];
    }
  }
  if (!transaction) return [`RuneProof found malformed interrupted progress for run ${runId}.`];
  const recordKey = runeProofProgressStorageKey(runId, transaction.questSlug);
  const indexKey = runeProofProgressIndexStorageKey(runId);
  try {
    restoreRaw(storage, recordKey, transaction.previousQuestRecord);
    restoreRaw(storage, indexKey, transaction.previousIndex);
    if (storage.getItem(recordKey) !== transaction.previousQuestRecord
      || storage.getItem(indexKey) !== transaction.previousIndex) {
      return [`RuneProof could not recover interrupted progress for run ${runId}.`];
    }
    storage.removeItem(commitKey);
    if (storage.getItem(commitKey) !== null) {
      return [`RuneProof could not recover interrupted progress for run ${runId}.`];
    }
    storage.removeItem(txKey);
    if (storage.getItem(txKey) !== null) {
      return [`RuneProof could not recover interrupted progress for run ${runId}.`];
    }
    return [`RuneProof recovered interrupted progress for run ${runId}.`];
  } catch {
    return [`RuneProof could not recover interrupted progress for run ${runId}.`];
  }
};

export const readRuneProofProgressIndex = (
  storage: RuneProofStorage,
  runId: string,
): RuneProofProgressIndexReadResult => {
  const warnings = recoverTransaction(storage, runId);
  try {
    const parsed = parseIndex(storage.getItem(runeProofProgressIndexStorageKey(runId)), runId);
    return {
      index: parsed ?? emptyIndex(runId),
      warnings,
    };
  } catch {
    return { index: emptyIndex(runId), warnings };
  }
};

const branchForSummary = (
  pack: RuneProofCompiledPack,
  progress: RuneProofQuestProgressV2,
): RuneProofBranch | undefined => {
  if (progress.selectedBranchId !== undefined) {
    return pack.branches.find(branch => branch.id === progress.selectedBranchId);
  }
  const needsReview = Object.fromEntries(pack.branches.map(branch => [branch.id, {
    state: 'NEEDS_REVIEW' as const,
    evidenceComplete: false,
  }]));
  const resolved = resolveRuneProofBranch({ pack, progress, evaluations: needsReview });
  if (resolved.pinned && resolved.branchId !== undefined) {
    return pack.branches.find(branch => branch.id === resolved.branchId);
  }
  return pack.branches.length === 1 ? pack.branches[0] : undefined;
};

const summaryFor = (
  pack: RuneProofCompiledPack,
  progress: RuneProofQuestProgressV2,
): RuneProofProgressSummary => {
  const branch = branchForSummary(pack, progress);
  if (!branch) {
    return {
      questId: pack.questId,
      packRevision: pack.revision,
      completedActionCount: 0,
      totalActionCount: 0,
      complete: false,
      updatedAt: progress.updatedAt,
    };
  }
  const route = orderedRoute(pack, branch);
  return {
    questId: pack.questId,
    packRevision: pack.revision,
    selectedBranchId: branch.id,
    completedActionCount: route.filter(action => (
      isRuneProofActionComplete(action, progress)
    )).length,
    totalActionCount: route.length,
    complete: isRuneProofRouteComplete(pack, branch, progress),
    updatedAt: progress.updatedAt,
  };
};

const rollback = (
  storage: RuneProofStorage,
  recordKey: string,
  indexKey: string,
  transactionKey: string,
  commitKey: string,
  previousRecord: string | null,
  previousIndex: string | null,
): void => {
  try {
    restoreRaw(storage, recordKey, previousRecord);
    restoreRaw(storage, indexKey, previousIndex);
    if (storage.getItem(recordKey) !== previousRecord
      || storage.getItem(indexKey) !== previousIndex) return;
    storage.removeItem(commitKey);
    if (storage.getItem(commitKey) !== null) return;
    storage.removeItem(transactionKey);
  } catch {
    // Leave the transaction journal for readRuneProofProgressIndex recovery.
  }
};

const discardUncommittedJournal = (
  storage: RuneProofStorage,
  transactionKey: string,
): void => {
  try {
    storage.removeItem(transactionKey);
    storage.getItem(transactionKey);
  } catch {
    // No target was changed; a journal that cannot be removed remains visible to recovery.
  }
};

export const writeRuneProofQuestProgress = (input: {
  readonly storage: RuneProofStorage;
  readonly runId: string;
  readonly questSlug: string;
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofQuestProgressV2;
  readonly now: () => string;
  readonly expectedPreviousQuestRecord?: string | null;
}): boolean => {
  const progress = normalizeRuneProofQuestProgress({
    progress: input.progress,
    runId: input.runId,
    pack: input.pack,
    now: input.now,
  });
  if (!progress) return false;
  const recordRaw = canonicalRuneProofProgressJson(progress);
  if (recordRaw.length > RUNEPROOF_PROGRESS_MAX_CHARS) return false;
  const recordKey = runeProofProgressStorageKey(input.runId, input.questSlug);
  const indexKey = runeProofProgressIndexStorageKey(input.runId);
  const transactionKey = runeProofProgressTransactionStorageKey(input.runId);
  const commitKey = runeProofProgressCommitStorageKey(input.runId);
  let previousRecord: string | null;
  let previousIndex: string | null;
  try {
    previousRecord = input.storage.getItem(recordKey);
    previousIndex = input.storage.getItem(indexKey);
  } catch {
    return false;
  }
  const hasExpectedPrevious = Object.hasOwn(input, 'expectedPreviousQuestRecord');
  if (hasExpectedPrevious && previousRecord !== input.expectedPreviousQuestRecord) return false;
  const currentIndex = parseIndex(previousIndex, input.runId);
  if (!currentIndex) return false;
  const entries = Object.fromEntries(
    Object.entries({
      ...currentIndex.entries,
      [input.questSlug]: summaryFor(input.pack, progress),
    }).sort(([left], [right]) => left.localeCompare(right)),
  );
  const nextIndex: RuneProofProgressIndexV2 = {
    schemaVersion: 2,
    runId: input.runId,
    entries,
  };
  const indexRaw = canonicalRuneProofProgressJson(nextIndex);
  if (indexRaw.length > RUNEPROOF_PROGRESS_INDEX_MAX_CHARS) return false;
  const transaction: RuneProofProgressTransactionV2 = {
    schemaVersion: 2,
    runId: input.runId,
    questSlug: input.questSlug,
    previousQuestRecord: previousRecord,
    previousIndex,
  };
  const transactionRaw = canonicalRuneProofProgressJson(transaction);
  if (transactionRaw.length > RUNEPROOF_PROGRESS_TRANSACTION_MAX_CHARS) return false;
  const commit: RuneProofProgressCommitV2 = {
    schemaVersion: 2,
    phase: 'COMMITTED',
    runId: input.runId,
    questSlug: input.questSlug,
    nextQuestRecord: recordRaw,
    nextIndex: indexRaw,
  };
  const commitRaw = canonicalRuneProofProgressJson(commit);
  if (commitRaw.length > RUNEPROOF_PROGRESS_TRANSACTION_MAX_CHARS) return false;

  let journalAttempted = false;
  try {
    if (input.storage.getItem(commitKey) !== null) return false;
    if (input.storage.getItem(transactionKey) !== null) return false;
    if (hasExpectedPrevious
      && input.storage.getItem(recordKey) !== input.expectedPreviousQuestRecord) return false;
    journalAttempted = true;
    input.storage.setItem(transactionKey, transactionRaw);
    const reread = parseTransaction(input.storage.getItem(transactionKey), input.runId);
    if (!reread || canonicalRuneProofProgressJson(reread) !== transactionRaw) {
      discardUncommittedJournal(input.storage, transactionKey);
      return false;
    }
  } catch {
    if (journalAttempted) discardUncommittedJournal(input.storage, transactionKey);
    return false;
  }
  try {
    input.storage.setItem(recordKey, recordRaw);
    const rereadProgress = readRuneProofQuestProgress({
      storage: input.storage,
      runId: input.runId,
      questSlug: input.questSlug,
      pack: input.pack,
    });
    if (!rereadProgress
      || canonicalRuneProofProgressJson(rereadProgress) !== recordRaw) throw new Error('record');
    input.storage.setItem(indexKey, indexRaw);
    const rereadIndex = parseIndex(input.storage.getItem(indexKey), input.runId);
    if (!rereadIndex
      || canonicalRuneProofProgressJson(rereadIndex) !== indexRaw) throw new Error('index');
  } catch {
    rollback(
      input.storage,
      recordKey,
      indexKey,
      transactionKey,
      commitKey,
      previousRecord,
      previousIndex,
    );
    return false;
  }
  try {
    input.storage.setItem(commitKey, commitRaw);
    const rereadCommit = parseCommit(input.storage.getItem(commitKey), input.runId);
    if (!rereadCommit
      || canonicalRuneProofProgressJson(rereadCommit) !== commitRaw) {
      throw new Error('commit');
    }
  } catch {
    rollback(
      input.storage,
      recordKey,
      indexKey,
      transactionKey,
      commitKey,
      previousRecord,
      previousIndex,
    );
    return false;
  }

  // A verified COMMITTED marker makes the next pair authoritative. Cleanup is best effort;
  // recovery can finish it, so never roll the durable pair back after this point.
  try {
    input.storage.removeItem(transactionKey);
    if (input.storage.getItem(transactionKey) !== null) return true;
    input.storage.removeItem(commitKey);
    if (input.storage.getItem(commitKey) !== null) return true;
  } catch {
    return true;
  }
  return true;
};

const mappedId = (
  id: string,
  mapping: Readonly<Record<string, string>>,
  accepted: ReadonlySet<string>,
): string | undefined => {
  const mapped = mapping[id];
  if (mapped !== undefined) return accepted.has(mapped) ? mapped : undefined;
  return accepted.has(id) ? id : undefined;
};

export const migrateRuneProofQuestProgressRevision = (input: {
  readonly storage: RuneProofStorage;
  readonly runId: string;
  readonly questSlug: string;
  readonly pack: RuneProofCompiledPack;
  readonly now: () => string;
}): RuneProofQuestProgressV2 | null => {
  const source = readRuneProofQuestProgressSource({
    storage: input.storage,
    runId: input.runId,
    questSlug: input.questSlug,
    questId: input.pack.questId,
  });
  if (!source || source.packRevision === input.pack.revision) return null;
  const migrations = input.pack.migrations.filter(
    migration => migration.fromRevision === source.packRevision,
  );
  if (migrations.length !== 1) return null;
  const migration = migrations[0];
  const universes = proofUniversesFor(input.pack);
  const acceptedActions = new Set(universes.actions);
  const acceptedItems = new Set(universes.items);
  const acceptedManuals = new Set(universes.manuals);
  const acceptedCheckpoints = new Set(universes.checkpoints);
  const mapArray = (
    values: readonly string[],
    mapping: Readonly<Record<string, string>>,
    accepted: ReadonlySet<string>,
  ): readonly string[] => values
    .map(id => mappedId(id, mapping, accepted))
    .filter((id): id is string => id !== undefined);
  const selectedBranchId = source.selectedBranchId === undefined
    ? undefined
    : mappedId(source.selectedBranchId, migration.branchIds, universes.branches);
  const updatedAt = input.now();
  let progress: RuneProofQuestProgressV2 = {
    schemaVersion: 2,
    runId: input.runId,
    questId: input.pack.questId,
    packRevision: input.pack.revision,
    ...(selectedBranchId === undefined ? {} : { selectedBranchId }),
    confirmedActionIds: mapArray(source.confirmedActionIds, migration.actionIds, acceptedActions),
    confirmedItemKeys: mapArray(source.confirmedItemKeys, migration.itemKeys, acceptedItems),
    manualConfirmationIds: mapArray(
      source.manualConfirmationIds,
      migration.manualConfirmationIds,
      acceptedManuals,
    ),
    confirmedCheckpointIds: mapArray(
      source.confirmedCheckpointIds,
      migration.checkpointIds,
      acceptedCheckpoints,
    ),
    updatedAt,
  };
  if (progress.selectedBranchId === undefined) {
    const evaluations = Object.fromEntries(input.pack.branches.map(branch => [branch.id, {
      state: 'NEEDS_REVIEW' as const,
      evidenceComplete: false,
    }]));
    const resolved = resolveRuneProofBranch({ pack: input.pack, evaluations, progress });
    if (resolved.pinned && resolved.branchId !== undefined) {
      progress = { ...progress, selectedBranchId: resolved.branchId };
    }
  }
  if (!writeRuneProofQuestProgress({
    ...input,
    progress,
    now: () => updatedAt,
  })) return null;
  return readRuneProofQuestProgress(input);
};

const readV1ProgressMap = (
  storage: RuneProofStorage,
  key: string,
): Readonly<Record<string, readonly string[]>> => {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return {};
  }
  const parsed = parseBoundedJson(raw, RUNEPROOF_PROGRESS_MAX_CHARS);
  if (!isRecord(parsed)) return {};
  const pairs: [string, readonly string[]][] = [];
  for (const questId of Object.keys(parsed)) {
    const values = parsed[questId];
    if (!nonblank(questId) || !denseNonblankStrings(values)) return {};
    pairs.push([questId, [...values]]);
  }
  return Object.fromEntries(pairs);
};

const selectedBranchFromV1Actions = (
  pack: RuneProofCompiledPack,
  confirmedActionIds: readonly string[],
): string | undefined => {
  const evaluations = Object.fromEntries(pack.branches.map(branch => [branch.id, {
    state: 'NEEDS_REVIEW' as const,
    evidenceComplete: false,
  }]));
  const selection = resolveRuneProofBranch({
    pack,
    evaluations,
    progress: {
      selectedBranchId: undefined,
      confirmedActionIds,
      confirmedItemKeys: [],
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
    },
  });
  return selection.pinned ? selection.branchId : undefined;
};

export const migrateRuneProofProgressV1 = (input: {
  readonly storage: RuneProofStorage;
  readonly runId: string;
  readonly packs: readonly RuneProofCompiledPack[];
  readonly questSlugs: ReadonlyMap<string, string>;
  readonly now: () => string;
  readonly onPreservedV2?: (
    questId: string,
    source: RuneProofQuestProgressSourceReadResult,
  ) => void;
}): RuneProofProgressMigrationResult => {
  const actionMap = readV1ProgressMap(
    input.storage,
    runeProofPreviewActionStorageKey(input.runId),
  );
  const itemMap = readV1ProgressMap(
    input.storage,
    runeProofPreviewStorageKey(input.runId),
  );
  const migratedQuestIds: string[] = [];
  const failedQuestIds: string[] = [];
  const seenQuestIds = new Set<string>();

  for (const pack of input.packs) {
    if (seenQuestIds.has(pack.questId)) continue;
    seenQuestIds.add(pack.questId);
    const hasActions = Object.hasOwn(actionMap, pack.questId);
    const hasItems = Object.hasOwn(itemMap, pack.questId);
    if (!hasActions && !hasItems) continue;
    const questSlug = input.questSlugs.get(pack.questId);
    if (!questSlug) {
      failedQuestIds.push(pack.questId);
      continue;
    }
    const existing = readRuneProofQuestProgressSourceResult({
      storage: input.storage,
      runId: input.runId,
      questSlug,
      questId: pack.questId,
    });
    if (existing.status !== 'ABSENT') {
      input.onPreservedV2?.(pack.questId, existing);
      continue;
    }

    const universes = proofUniversesFor(pack);
    const confirmedActionIds = normalizeIds(
      hasActions ? actionMap[pack.questId] : [],
      universes.actions,
    );
    const confirmedItemKeys = normalizeIds(
      hasItems ? itemMap[pack.questId] : [],
      universes.items,
    );
    const selectedBranchId = selectedBranchFromV1Actions(pack, confirmedActionIds);
    const updatedAt = input.now();
    const progress: RuneProofQuestProgressV2 = {
      schemaVersion: 2,
      runId: input.runId,
      questId: pack.questId,
      packRevision: pack.revision,
      ...(selectedBranchId === undefined ? {} : { selectedBranchId }),
      confirmedActionIds,
      confirmedItemKeys,
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
      updatedAt,
    };
    const written = writeRuneProofQuestProgress({
      storage: input.storage,
      runId: input.runId,
      questSlug,
      pack,
      progress,
      now: () => updatedAt,
      expectedPreviousQuestRecord: null,
    });
    const reread = written ? readRuneProofQuestProgress({
      storage: input.storage,
      runId: input.runId,
      questSlug,
      pack,
    }) : null;
    if (!reread) {
      const preserved = readRuneProofQuestProgressSourceResult({
        storage: input.storage,
        runId: input.runId,
        questSlug,
        questId: pack.questId,
      });
      if (preserved.status === 'ABSENT') failedQuestIds.push(pack.questId);
      else input.onPreservedV2?.(pack.questId, preserved);
    } else migratedQuestIds.push(pack.questId);
  }

  return { migratedQuestIds, failedQuestIds };
};

export const runeProofProgressStorageKey = (
  runId: string,
  questSlug: string,
): string => `fate_runeproof_progress_v2:${runId}:${questSlug}`;

export const runeProofProgressIndexStorageKey = (
  runId: string,
): string => `fate_runeproof_progress_index_v2:${runId}`;

export const runeProofProgressTransactionStorageKey = (
  runId: string,
): string => `fate_runeproof_progress_tx_v2:${runId}`;
