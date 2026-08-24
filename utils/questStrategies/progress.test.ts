import { describe, expect, it, vi } from 'vitest';
import type { RuneProofStorage } from '../questRoutes/previewChecks';
import type {
  RequirementExpression,
  RuneProofCompiledPack,
  RuneProofProgressMigration,
} from './packModel';
import {
  RUNEPROOF_PROGRESS_INDEX_MAX_CHARS,
  RUNEPROOF_PROGRESS_MAX_CHARS,
  canonicalRuneProofProgressJson,
  isRuneProofActionComplete,
  isRuneProofRouteComplete,
  migrateRuneProofProgressV1,
  migrateRuneProofQuestProgressRevision,
  readRuneProofProgressIndex,
  readRuneProofQuestProgress,
  runeProofProgressIndexStorageKey,
  runeProofProgressStorageKey,
  runeProofProgressTransactionStorageKey,
  selectRuneProofManualObligations,
  type RuneProofProgressIndexV2,
  type RuneProofQuestProgressV2,
  writeRuneProofQuestProgress,
} from './progress';
import { runeProofPreviewStorageKey } from '../questRoutes/previewChecks';
import { runeProofPreviewActionStorageKey } from './previewActions';
import { branchingPack } from './testFixtures';

interface StorageCall {
  readonly method: 'getItem' | 'setItem' | 'removeItem';
  readonly key: string;
}

const memoryStorage = (): RuneProofStorage & {
  readonly values: Map<string, string>;
  readonly calls: StorageCall[];
} => {
  const values = new Map<string, string>();
  const calls: StorageCall[] = [];
  return {
    values,
    calls,
    getItem: key => {
      calls.push({ method: 'getItem', key });
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      calls.push({ method: 'setItem', key });
      values.set(key, value);
    },
    removeItem: (key) => {
      calls.push({ method: 'removeItem', key });
      values.delete(key);
    },
  };
};

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

const changedPack = (
  mutate: (pack: Mutable<RuneProofCompiledPack>) => void,
): RuneProofCompiledPack => {
  const pack = structuredClone(branchingPack) as Mutable<RuneProofCompiledPack>;
  mutate(pack);
  return pack;
};

const noGate = (): Mutable<RequirementExpression> => ({ kind: 'ALL', requirements: [] });

const simpleBranchingPack = (): RuneProofCompiledPack => changedPack((pack) => {
  pack.preflight = noGate();
  for (const branch of pack.branches) {
    branch.requirements = noGate();
    branch.checkpointIds = [];
    branch.actions = [branch.actions[0], branch.actions[2]];
    delete branch.actions[0].combat;
    branch.actions[1].completion = { kind: 'ACTION_CONFIRMED' };
    branch.actions[1].sourceOrder = 3;
    branch.actions[1].dependsOn = [branch.actions[0].id];
  }
});

const progressFor = (
  pack: RuneProofCompiledPack,
  runId = 'run-a',
  overrides: Partial<RuneProofQuestProgressV2> = {},
): RuneProofQuestProgressV2 => ({
  schemaVersion: 2,
  runId,
  questId: pack.questId,
  packRevision: pack.revision,
  confirmedActionIds: [],
  confirmedItemKeys: [],
  manualConfirmationIds: [],
  confirmedCheckpointIds: [],
  updatedAt: '2026-08-22T10:00:00.000Z',
  ...overrides,
});

const write = (
  storage: RuneProofStorage,
  pack: RuneProofCompiledPack,
  progress: RuneProofQuestProgressV2,
  questSlug = pack.catalogue.slug,
): boolean => writeRuneProofQuestProgress({
  storage,
  runId: progress.runId,
  questSlug,
  pack,
  progress,
  now: () => progress.updatedAt,
});

const packWithMigration = (
  migration: RuneProofProgressMigration,
): RuneProofCompiledPack => changedPack((pack) => {
  pack.revision = 'fixture-pack-revision-v2';
  pack.migrations = [migration];
});

describe('RuneProof V2 progress', () => {
  it('uses exact per-run/per-quest, index, and transaction keys', () => {
    expect(runeProofProgressStorageKey('run-a', 'cooks-assistant'))
      .toBe('fate_runeproof_progress_v2:run-a:cooks-assistant');
    expect(runeProofProgressIndexStorageKey('run-a'))
      .toBe('fate_runeproof_progress_index_v2:run-a');
    expect(runeProofProgressTransactionStorageKey('run-a'))
      .toBe('fate_runeproof_progress_tx_v2:run-a');
  });

  it('writes, rereads, and indexes only one quest record', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    const progress = progressFor(pack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
    });

    expect(write(storage, pack, progress)).toBe(true);
    expect(readRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      pack,
    })?.confirmedActionIds).toEqual(['shared:start', 'local:step', 'remote:step']);
    expect(storage.values.has(runeProofProgressIndexStorageKey('run-b'))).toBe(false);
    expect(storage.values.has(runeProofProgressTransactionStorageKey('run-a'))).toBe(false);
  });

  it('requires exact record keys and exact current identity while normalizing arrays', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    const key = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    storage.values.set(key, JSON.stringify({
      ...progressFor(pack, 'run-a'),
      selectedBranchId: 'local',
      confirmedActionIds: ['remote:step', 'shared:start', 'remote:step', 'unknown'],
      extra: true,
    }));
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
    })).toBeNull();

    storage.values.set(key, JSON.stringify({
      ...progressFor(pack, 'run-a'),
      selectedBranchId: 'local',
      confirmedActionIds: ['remote:step', 'shared:start', 'remote:step', 'unknown'],
    }));
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
    })?.confirmedActionIds).toEqual(['shared:start', 'remote:step']);

    storage.values.set(key, JSON.stringify({
      ...progressFor(pack, 'run-a'),
      questId: 'Different Quest',
    }));
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
    })).toBeNull();
  });

  it('rejects sparse proof arrays, invalid branches/timestamps, and oversized records', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    const key = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const sparse: unknown[] = [];
    sparse[1] = 'shared:start';
    for (const invalid of [
      { ...progressFor(pack), confirmedActionIds: sparse },
      { ...progressFor(pack), selectedBranchId: 'unknown' },
      { ...progressFor(pack), updatedAt: '2026-08-22' },
    ]) {
      storage.values.set(key, JSON.stringify(invalid));
      expect(readRuneProofQuestProgress({
        storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
      })).toBeNull();
    }
    storage.values.set(key, 'x'.repeat(RUNEPROOF_PROGRESS_MAX_CHARS + 1));
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
    })).toBeNull();
  });

  it('uses complete proof-ID universes and preserves stable pack order', () => {
    const pack = changedPack((mutable) => {
      mutable.preflight = {
        kind: 'MANUAL_CONFIRMATION',
        id: 'manual:preflight:req',
        confirmationId: 'manual:preflight',
        prompt: 'Confirm preflight.',
        evidenceIds: ['review:example'],
      };
      mutable.initialItems[0].alternatives = [
        { key: 'root alternative z', name: 'Root alternative z' },
        { key: 'root alternative a', name: 'Root alternative a' },
      ];
      const local = mutable.branches[0];
      local.actions[0].alternatives = [{
        id: 'alternative:local',
        label: 'Alternative local route',
        kind: 'QUEST_ROUTE',
        evidenceIds: ['review:example'],
        requirements: {
          kind: 'MANUAL_CONFIRMATION',
          id: 'manual:alternative:req',
          confirmationId: 'manual:alternative',
          prompt: 'Confirm alternative.',
          evidenceIds: ['review:example'],
        },
      }];
      local.actions[0].itemEffects = [{
        kind: 'PRODUCE',
        itemKey: 'effect output',
        quantity: 1,
        from: [{ itemKey: 'effect input', quantity: 1 }],
      }, {
        kind: 'LEND',
        itemKey: 'lent item',
        quantity: 1,
        replacementItemKey: 'replacement item',
      }];
      local.actions[1].completion = {
        kind: 'ITEM_CONFIRMED', itemKey: 'completion item',
      };
      local.actions[2].completion = {
        kind: 'MANUAL', confirmationId: 'manual:completion',
      };
      local.checkpointIds = ['checkpoint:z', 'checkpoint:a'];
    });
    const storage = memoryStorage();
    const source = progressFor(pack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['remote:step', 'shared:start', 'local:step', 'unknown'],
      confirmedItemKeys: [
        'replacement item', 'completion item', 'root alternative a', 'effect input',
        'root alternative z', 'effect output', 'lent item', 'unknown item',
      ],
      manualConfirmationIds: [
        'manual:completion', 'manual:alternative', 'local:combat',
        'manual:preflight', 'local:manual', 'unknown manual',
      ],
      confirmedCheckpointIds: ['checkpoint:a', 'checkpoint:z', 'unknown checkpoint'],
    });
    expect(write(storage, pack, source)).toBe(true);
    const stored = readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
    });
    expect(stored).toMatchObject({
      confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
      confirmedItemKeys: [
        'root alternative z', 'root alternative a', 'effect output', 'effect input',
        'lent item', 'replacement item', 'completion item',
      ],
      manualConfirmationIds: [
        'manual:preflight', 'local:manual', 'manual:alternative',
        'local:combat', 'manual:completion',
      ],
      confirmedCheckpointIds: ['checkpoint:z', 'checkpoint:a'],
    });
  });

  it('recomputes summaries from only the selected active route', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    const local = progressFor(pack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    });
    expect(write(storage, pack, local)).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries[pack.catalogue.slug])
      .toMatchObject({ completedActionCount: 1, totalActionCount: 3, complete: false });

    expect(write(storage, pack, { ...local, selectedBranchId: 'remote' })).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries[pack.catalogue.slug])
      .toMatchObject({ completedActionCount: 0, totalActionCount: 3, complete: false });
  });

  it('summarizes a uniquely inferred route without rewriting the record selection', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    expect(write(storage, pack, progressFor(pack, 'run-a', {
      confirmedActionIds: ['local:step'],
    }))).toBe(true);

    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries[pack.catalogue.slug])
      .toMatchObject({
        selectedBranchId: 'local',
        completedActionCount: 1,
        totalActionCount: 3,
        complete: false,
      });
    expect(readRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      pack,
    })?.selectedBranchId).toBeUndefined();
  });

  it('reports zero/zero for an empty ambiguous multi-branch record', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    expect(write(storage, pack, progressFor(pack))).toBe(true);
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries[pack.catalogue.slug])
      .toMatchObject({ completedActionCount: 0, totalActionCount: 0, complete: false });
  });

  it('reads an exact __proto__ index entry without changing the entries prototype', () => {
    const storage = memoryStorage();
    const summary = {
      questId: 'Prototype Quest',
      packRevision: 'prototype-revision',
      completedActionCount: 0,
      totalActionCount: 0,
      complete: false,
      updatedAt: '2026-08-22T10:00:00.000Z',
    };
    storage.values.set(runeProofProgressIndexStorageKey('run-a'),
      canonicalRuneProofProgressJson({
        schemaVersion: 2,
        runId: 'run-a',
        entries: Object.fromEntries([['__proto__', summary]]),
      }));

    const entries = readRuneProofProgressIndex(storage, 'run-a').index.entries;
    expect(Object.hasOwn(entries, '__proto__')).toBe(true);
    expect(entries['__proto__']).toEqual(summary);
    expect(Object.getPrototypeOf(entries)).toBe(Object.prototype);
  });

  it('does not complete an action from its target without selected manual and combat proof', () => {
    const action = branchingPack.branches[0].actions[0];
    const targetOnly = progressFor(branchingPack, 'run-a', {
      confirmedActionIds: [action.id],
    });
    expect(isRuneProofActionComplete(action, targetOnly)).toBe(false);
    expect(isRuneProofActionComplete(action, {
      ...targetOnly,
      manualConfirmationIds: ['local:combat'],
    })).toBe(true);
  });

  it('uses the terminal canonical action ID as an isolated target with separate gates', () => {
    const pack = changedPack((mutable) => {
      const action = mutable.branches[0].actions.at(-1)!;
      action.requirements = {
        kind: 'MANUAL_CONFIRMATION',
        id: 'terminal:manual-requirement',
        confirmationId: 'terminal:manual',
        prompt: 'Confirm the isolated terminal step.',
        evidenceIds: ['review:example'],
      };
      action.combat = {
        ...structuredClone(mutable.branches[0].actions[0].combat!),
        id: 'terminal:combat-declaration',
        confirmationId: 'terminal:combat',
      };
    });
    const action = pack.branches[0].actions.at(-1)!;
    expect(action.completion.kind).toBe('CANONICAL_QUEST_COMPLETED');
    const targetOnly = progressFor(pack, 'run-a', {
      confirmedActionIds: [action.id],
    });
    expect(isRuneProofActionComplete(action, targetOnly)).toBe(false);
    expect(isRuneProofActionComplete(action, {
      ...targetOnly,
      manualConfirmationIds: ['terminal:manual'],
    })).toBe(false);
    expect(isRuneProofActionComplete(action, {
      ...targetOnly,
      manualConfirmationIds: ['terminal:manual', 'terminal:combat'],
    })).toBe(true);
  });

  it('selects one satisfied manual-only ANY branch without leaking the loser', () => {
    const expression: RequirementExpression = {
      kind: 'ANY',
      requirements: [
        {
          kind: 'MANUAL_CONFIRMATION', id: 'req:a', confirmationId: 'manual:a',
          prompt: 'Confirm A.', evidenceIds: ['review:a'],
        },
        {
          kind: 'MANUAL_CONFIRMATION', id: 'req:b', confirmationId: 'manual:b',
          prompt: 'Confirm B.', evidenceIds: ['review:b'],
        },
      ],
    };
    expect(selectRuneProofManualObligations(expression, new Set())).toMatchObject({
      satisfied: false,
      requirements: [expect.objectContaining({ confirmationId: 'manual:a' })],
    });
    expect(selectRuneProofManualObligations(expression, new Set(['manual:b'])))
      .toMatchObject({
        satisfied: true,
        requirements: [expect.objectContaining({ confirmationId: 'manual:b' })],
      });
  });

  it('requires composite route completion including pack and branch manuals', () => {
    const pack = simpleBranchingPack();
    const branch = pack.branches[0];
    const targets = [
      ...pack.sharedActions.map(action => action.id),
      ...branch.actions.map(action => action.id),
    ];
    const completed = progressFor(pack, 'run-a', {
      selectedBranchId: branch.id,
      confirmedActionIds: targets,
    });
    expect(isRuneProofRouteComplete(pack, branch, completed)).toBe(true);

    const withManualGates = changedPack((mutable) => {
      mutable.preflight = {
        kind: 'MANUAL_CONFIRMATION', id: 'preflight:req',
        confirmationId: 'preflight:manual', prompt: 'Confirm preflight.',
        evidenceIds: ['review:example'],
      };
      mutable.branches[0].requirements = {
        kind: 'MANUAL_CONFIRMATION', id: 'branch:req',
        confirmationId: 'branch:manual', prompt: 'Confirm branch.',
        evidenceIds: ['review:example'],
      };
      for (const branchValue of mutable.branches) {
        branchValue.actions = [branchValue.actions[0], branchValue.actions[2]];
        delete branchValue.actions[0].combat;
        branchValue.actions[1].completion = { kind: 'ACTION_CONFIRMED' };
        branchValue.actions[1].dependsOn = [branchValue.actions[0].id];
      }
    });
    const manualBranch = withManualGates.branches[0];
    const allTargets = [
      ...withManualGates.sharedActions,
      ...manualBranch.actions,
    ].map(action => action.id);
    const targetOnly = progressFor(withManualGates, 'run-a', {
      selectedBranchId: manualBranch.id,
      confirmedActionIds: allTargets,
    });
    expect(isRuneProofRouteComplete(withManualGates, manualBranch, targetOnly)).toBe(false);
    expect(isRuneProofRouteComplete(withManualGates, manualBranch, {
      ...targetOnly,
      manualConfirmationIds: ['preflight:manual', 'branch:manual'],
    })).toBe(true);
  });

  it('completes a real compiled isolated route from every exact composite target', () => {
    const branch = branchingPack.branches[0];
    const progress = progressFor(branchingPack, 'run-a', {
      selectedBranchId: branch.id,
      confirmedActionIds: ['shared:start', 'local:step', 'local:complete'],
      manualConfirmationIds: ['global:manual', 'local:manual', 'local:combat'],
      confirmedCheckpointIds: ['local:checkpoint'],
    });

    expect(isRuneProofRouteComplete(branchingPack, branch, progress)).toBe(true);
    expect(isRuneProofRouteComplete(branchingPack, branch, {
      ...progress,
      confirmedActionIds: ['shared:start', 'local:step'],
    })).toBe(false);
  });

  it('indexes isolated route completion without writing or inferring canonical state', () => {
    const storage = memoryStorage();
    const branch = branchingPack.branches[0];
    const canonicalSentinelKey = 'canonical-run-state:run-a';
    const canonicalSentinel = '{"completedQuestIds":[]}';
    storage.values.set(canonicalSentinelKey, canonicalSentinel);
    const progress = progressFor(branchingPack, 'run-a', {
      selectedBranchId: branch.id,
      confirmedActionIds: ['shared:start', 'local:step', 'local:complete'],
      manualConfirmationIds: ['global:manual', 'local:manual', 'local:combat'],
      confirmedCheckpointIds: ['local:checkpoint'],
    });

    expect(write(storage, branchingPack, progress)).toBe(true);

    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries[
      branchingPack.catalogue.slug
    ]).toMatchObject({
      selectedBranchId: 'local',
      completedActionCount: 4,
      totalActionCount: 4,
      complete: true,
    });
    const recordRaw = storage.values.get(runeProofProgressStorageKey(
      'run-a', branchingPack.catalogue.slug,
    ));
    expect(JSON.parse(recordRaw!)).toEqual(progress);
    expect(recordRaw).not.toContain('canonicalQuestCompleted');
    expect(recordRaw).not.toContain('completedQuestIds');
    expect(storage.values.get(canonicalSentinelKey)).toBe(canonicalSentinel);
    expect(storage.calls.some(call => call.key === canonicalSentinelKey)).toBe(false);
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const isolatedKeys = new Set([
      runeProofProgressStorageKey('run-a', branchingPack.catalogue.slug),
      runeProofProgressIndexStorageKey('run-a'),
      transactionKey,
      `${transactionKey}:committed`,
    ]);
    expect(storage.calls.every(call => isolatedKeys.has(call.key))).toBe(true);
  });

  it('does not advance the index after a failed journal write or failed quest reread', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const originalSet = storage.setItem;
    storage.setItem = vi.fn((key, value) => {
      if (key === runeProofProgressTransactionStorageKey('run-a')) throw new Error('quota');
      originalSet(key, value);
    });
    expect(write(storage, pack, progressFor(pack))).toBe(false);
    expect(storage.values.has(runeProofProgressIndexStorageKey('run-a'))).toBe(false);
    expect(storage.values.has(runeProofProgressStorageKey('run-a', pack.catalogue.slug)))
      .toBe(false);
  });

  it('verifies a reread journal canonically before mutating either target', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const originalGet = storage.getItem;
    storage.getItem = (key) => {
      const raw = originalGet(key);
      if (key !== transactionKey || raw === null) return raw;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return JSON.stringify({
        schemaVersion: parsed.schemaVersion,
        runId: parsed.runId,
        questSlug: parsed.questSlug,
        previousQuestRecord: parsed.previousQuestRecord,
        previousIndex: parsed.previousIndex,
      });
    };
    expect(write(storage, pack, progressFor(pack))).toBe(true);
  });

  it('cleans an unverifiable journal without touching the record or index', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const originalSet = storage.setItem;
    storage.setItem = (key, value) => {
      originalSet(key, key === transactionKey ? `${value}x` : value);
    };
    expect(write(storage, pack, progressFor(pack))).toBe(false);
    expect(storage.values.has(runeProofProgressStorageKey('run-a', pack.catalogue.slug)))
      .toBe(false);
    expect(storage.values.has(runeProofProgressIndexStorageKey('run-a'))).toBe(false);
    expect(storage.values.has(transactionKey)).toBe(false);
  });

  it('rolls both raw targets back when the index write fails', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    storage.values.set(recordKey, '{"previous":"record"}');
    storage.values.set(indexKey, '{"previous":"index"}');
    const originalSet = storage.setItem;
    let failed = false;
    storage.setItem = (key, value) => {
      if (!failed && key === indexKey) {
        failed = true;
        throw new Error('index write failed');
      }
      originalSet(key, value);
    };
    expect(write(storage, pack, progressFor(pack))).toBe(false);
    expect(storage.values.get(recordKey)).toBe('{"previous":"record"}');
    expect(storage.values.get(indexKey)).toBe('{"previous":"index"}');
    expect(storage.values.has(runeProofProgressTransactionStorageKey('run-a'))).toBe(false);
  });

  it('recovers an interrupted journal with a warning while ordinary reads do zero quest reads', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const txKey = runeProofProgressTransactionStorageKey('run-a');
    const previousIndex = canonicalRuneProofProgressJson({
      schemaVersion: 2,
      runId: 'run-a',
      entries: {},
    });
    storage.values.set(recordKey, '{"partial":true}');
    storage.values.set(indexKey, '{"partial":true}');
    storage.values.set(txKey, canonicalRuneProofProgressJson({
      schemaVersion: 2,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      previousQuestRecord: null,
      previousIndex,
    }));
    const recovered = readRuneProofProgressIndex(storage, 'run-a');
    expect(recovered.index.entries).toEqual({});
    expect(recovered.warnings).toEqual([
      'RuneProof recovered interrupted progress for run run-a.',
    ]);
    expect(storage.values.has(recordKey)).toBe(false);
    expect(storage.values.has(txKey)).toBe(false);

    storage.calls.length = 0;
    expect(readRuneProofProgressIndex(storage, 'run-a').warnings).toEqual([]);
    expect(storage.calls.filter(call => call.method === 'getItem')).toEqual([
      { method: 'getItem', key: `${txKey}:committed` },
      { method: 'getItem', key: txKey },
      { method: 'getItem', key: indexKey },
    ]);
    expect(storage.calls.some(call => call.key === recordKey)).toBe(false);
  });

  it('does not let an unrelated shaped COMMITTED marker discard a valid PREPARED journal', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const commitKey = `${transactionKey}:committed`;
    const previousRecord = canonicalRuneProofProgressJson(progressFor(pack));
    const previousIndex = canonicalRuneProofProgressJson({
      schemaVersion: 2,
      runId: 'run-a',
      entries: {},
    });
    storage.values.set(recordKey, '{"partial":"quest-a"}');
    storage.values.set(indexKey, '{"partial":"index-a"}');
    storage.values.set(transactionKey, canonicalRuneProofProgressJson({
      schemaVersion: 2,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      previousQuestRecord: previousRecord,
      previousIndex,
    }));
    storage.values.set(commitKey, canonicalRuneProofProgressJson({
      schemaVersion: 2,
      phase: 'COMMITTED',
      runId: 'run-a',
      questSlug: 'other-quest',
      nextQuestRecord: '{}',
      nextIndex: previousIndex,
    }));

    const recovered = readRuneProofProgressIndex(storage, 'run-a');

    expect(recovered.warnings).toEqual([
      'RuneProof recovered interrupted progress for run run-a.',
    ]);
    expect(storage.values.get(recordKey)).toBe(previousRecord);
    expect(storage.values.get(indexKey)).toBe(previousIndex);
    expect(storage.values.has(transactionKey)).toBe(false);
    expect(storage.values.has(commitKey)).toBe(false);
  });

  it.each((() => {
    const pack = simpleBranchingPack();
    const slug = pack.catalogue.slug;
    const nextProgress = progressFor(pack);
    const summary = {
      questId: pack.questId,
      packRevision: pack.revision,
      completedActionCount: 0,
      totalActionCount: 0,
      complete: false,
      updatedAt: nextProgress.updatedAt,
    };
    const nextIndex = {
      schemaVersion: 2,
      runId: 'run-a',
      entries: { [slug]: summary },
    };
    const marker = (
      overrides: Readonly<Record<string, unknown>> = {},
      record: unknown = nextProgress,
      index: unknown = nextIndex,
    ): string => canonicalRuneProofProgressJson({
      schemaVersion: 2,
      phase: 'COMMITTED',
      runId: 'run-a',
      questSlug: slug,
      nextQuestRecord: canonicalRuneProofProgressJson(record),
      nextIndex: canonicalRuneProofProgressJson(index),
      ...overrides,
    });
    const indexWithSummary = (overrides: Readonly<Record<string, unknown>>) => ({
      ...nextIndex,
      entries: { [slug]: { ...summary, ...overrides } },
    });
    return [
      ['mismatched slug', marker({ questSlug: 'other-quest' })],
      ['mismatched run', marker({ runId: 'run-b' })],
      ['mismatched record quest', marker({}, { ...nextProgress, questId: 'Other Quest' })],
      ['mismatched summary quest', marker({}, nextProgress, indexWithSummary({ questId: 'Other Quest' }))],
      ['mismatched revision', marker({}, nextProgress, indexWithSummary({ packRevision: 'other-revision' }))],
      ['mismatched selection', marker({}, { ...nextProgress, selectedBranchId: 'local' })],
      ['mismatched timestamp', marker({}, nextProgress, indexWithSummary({ updatedAt: '2026-08-22T11:00:00.000Z' }))],
      ['empty index', marker({}, nextProgress, { ...nextIndex, entries: {} })],
      ['malformed record', marker({}, {})],
      ['non-canonical record', marker({
        nextQuestRecord: `${canonicalRuneProofProgressJson(nextProgress)} `,
      })],
    ] as const;
  })())('rolls PREPARED back for an invalid COMMITTED marker: %s', (_name, commitRaw) => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const commitKey = `${transactionKey}:committed`;
    const previousRecord = canonicalRuneProofProgressJson(progressFor(pack));
    const previousIndex = canonicalRuneProofProgressJson({
      schemaVersion: 2,
      runId: 'run-a',
      entries: {},
    });
    storage.values.set(recordKey, '{"partial":"quest"}');
    storage.values.set(indexKey, '{"partial":"index"}');
    storage.values.set(transactionKey, canonicalRuneProofProgressJson({
      schemaVersion: 2,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      previousQuestRecord: previousRecord,
      previousIndex,
    }));
    storage.values.set(commitKey, commitRaw);

    const recovered = readRuneProofProgressIndex(storage, 'run-a');

    expect(recovered.warnings).toEqual([
      'RuneProof recovered interrupted progress for run run-a.',
    ]);
    expect(storage.values.get(recordKey)).toBe(previousRecord);
    expect(storage.values.get(indexKey)).toBe(previousIndex);
    expect(storage.values.has(transactionKey)).toBe(false);
    expect(storage.values.has(commitKey)).toBe(false);
  });

  it('leaves a journal for verified recovery when rollback itself cannot be verified', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    expect(write(storage, pack, progressFor(pack))).toBe(true);
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const beforeRecord = storage.values.get(recordKey)!;
    const beforeIndex = storage.values.get(indexKey)!;
    const originalSet = storage.setItem;
    let failIndex = true;
    let sabotageRollback = true;
    storage.setItem = (key, value) => {
      if (key === indexKey && failIndex) {
        failIndex = false;
        throw new Error('index unavailable');
      }
      if (key === recordKey && sabotageRollback && value === beforeRecord) {
        originalSet(key, '{"rollback":"did-not-stick"}');
        return;
      }
      originalSet(key, value);
    };

    expect(write(storage, pack, progressFor(pack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    }))).toBe(false);
    expect(storage.values.has(transactionKey)).toBe(true);

    sabotageRollback = false;
    const recovered = readRuneProofProgressIndex(storage, 'run-a');
    expect(recovered.warnings).toEqual([
      'RuneProof recovered interrupted progress for run run-a.',
    ]);
    expect(storage.values.get(recordKey)).toBe(beforeRecord);
    expect(storage.values.get(indexKey)).toBe(beforeIndex);
    expect(storage.values.has(transactionKey)).toBe(false);
  });

  it('keeps a committed next pair recoverable when journal-removal verification throws', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    expect(write(storage, pack, progressFor(pack))).toBe(true);
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const commitKey = `${transactionKey}:committed`;
    const beforeRecord = storage.values.get(recordKey)!;
    const beforeIndex = storage.values.get(indexKey)!;
    const underlyingGet = storage.getItem;
    const underlyingSet = storage.setItem;
    const underlyingRemove = storage.removeItem;
    let transactionRemoved = false;
    let throwRemovalVerification = true;
    storage.getItem = (key) => {
      if (key === transactionKey && transactionRemoved && throwRemovalVerification) {
        throwRemovalVerification = false;
        throw new Error('journal verification unavailable');
      }
      return underlyingGet(key);
    };
    storage.setItem = (key, value) => {
      if (key === indexKey && transactionRemoved && value === beforeIndex) return;
      underlyingSet(key, value);
    };
    storage.removeItem = (key) => {
      underlyingRemove(key);
      if (key === transactionKey) transactionRemoved = true;
    };

    expect(write(storage, pack, progressFor(pack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    }))).toBe(true);
    expect(storage.values.get(recordKey)).not.toBe(beforeRecord);
    expect(storage.values.get(indexKey)).not.toBe(beforeIndex);
    expect(storage.values.has(commitKey)).toBe(true);

    const recovered = readRuneProofProgressIndex(storage, 'run-a');
    expect(recovered.warnings).toEqual([
      'RuneProof recovered committed progress for run run-a.',
    ]);
    expect(recovered.index.entries[pack.catalogue.slug]).toMatchObject({
      selectedBranchId: 'local',
      completedActionCount: 1,
    });
    expect(storage.values.has(commitKey)).toBe(false);
  });

  it('rolls back through PREPARED when a committed marker is only partially written', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    expect(write(storage, pack, progressFor(pack))).toBe(true);
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    const transactionKey = runeProofProgressTransactionStorageKey('run-a');
    const commitKey = `${transactionKey}:committed`;
    const beforeRecord = storage.values.get(recordKey)!;
    const beforeIndex = storage.values.get(indexKey)!;
    const underlyingSet = storage.setItem;
    storage.setItem = (key, value) => {
      underlyingSet(key, key === commitKey ? `${value}x` : value);
    };

    expect(write(storage, pack, progressFor(pack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    }))).toBe(false);
    expect(storage.values.get(recordKey)).toBe(beforeRecord);
    expect(storage.values.get(indexKey)).toBe(beforeIndex);
    expect(storage.values.has(transactionKey)).toBe(false);
    expect(storage.values.has(commitKey)).toBe(false);
  });

  it('never mutates a different quest record', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    const otherKey = runeProofProgressStorageKey('run-a', 'other-quest');
    storage.values.set(otherKey, '{"preserve":"exactly"}');
    expect(write(storage, pack, progressFor(pack))).toBe(true);
    expect(storage.values.get(otherKey)).toBe('{"preserve":"exactly"}');
    expect(storage.calls.some(call => call.key === otherKey)).toBe(false);
  });

  it('keeps a worst-case 210-entry compact index within its cap', () => {
    const entries: RuneProofProgressIndexV2['entries'] = Object.fromEntries(
      Array.from({ length: 210 }, (_, index) => [
        `quest-${String(index).padStart(3, '0')}-${'x'.repeat(20)}`,
        {
          questId: `Quest ${String(index).padStart(3, '0')} ${'Q'.repeat(20)}`,
          packRevision: `revision-${'r'.repeat(30)}`,
          selectedBranchId: `branch-${'b'.repeat(16)}`,
          completedActionCount: 999,
          totalActionCount: 999,
          complete: true,
          updatedAt: '2026-08-22T10:00:00.000Z',
        },
      ]),
    );
    const index: RuneProofProgressIndexV2 = {
      schemaVersion: 2,
      runId: `run-${'x'.repeat(40)}`,
      entries,
    };
    expect(canonicalRuneProofProgressJson(index).length)
      .toBeLessThanOrEqual(RUNEPROOF_PROGRESS_INDEX_MAX_CHARS);
  });

  it('migrates every V2 namespace with one exact revision map', () => {
    const storage = memoryStorage();
    const pack = packWithMigration({
      id: 'fixture-v1-to-v2',
      fromRevision: 'fixture-pack-revision-v1',
      actionIds: { 'old:action': 'local:step' },
      itemKeys: { 'old item': 'local token' },
      branchIds: { 'old-local': 'local' },
      manualConfirmationIds: { 'old:manual': 'local:manual' },
      checkpointIds: { 'old:checkpoint': 'local:checkpoint' },
    });
    storage.values.set(runeProofProgressStorageKey('run-a', pack.catalogue.slug), JSON.stringify({
      ...progressFor(pack, 'run-a'),
      packRevision: 'fixture-pack-revision-v1',
      selectedBranchId: 'old-local',
      confirmedActionIds: ['old:action', 'shared:start'],
      confirmedItemKeys: ['old item'],
      manualConfirmationIds: ['old:manual'],
      confirmedCheckpointIds: ['old:checkpoint'],
    }));
    const migrated = migrateRuneProofQuestProgressRevision({
      storage,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      pack,
      now: () => '2026-08-22T11:00:00.000Z',
    });
    expect(migrated).toMatchObject({
      packRevision: pack.revision,
      selectedBranchId: 'local',
      confirmedActionIds: ['shared:start', 'local:step'],
      confirmedItemKeys: ['local token'],
      manualConfirmationIds: ['local:manual'],
      confirmedCheckpointIds: ['local:checkpoint'],
      updatedAt: '2026-08-22T11:00:00.000Z',
    });
    expect(readRuneProofProgressIndex(storage, 'run-a').index.entries[pack.catalogue.slug])
      .toMatchObject({ packRevision: pack.revision, selectedBranchId: 'local' });
  });

  it('leaves old revision record and index untouched without an exact migration', () => {
    const storage = memoryStorage();
    const pack = changedPack((mutable) => { mutable.revision = 'current'; });
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    storage.values.set(recordKey, JSON.stringify({
      ...progressFor(pack), packRevision: 'old',
    }));
    storage.values.set(indexKey, '{"preserved":"index"}');
    const beforeRecord = storage.values.get(recordKey);
    const beforeIndex = storage.values.get(indexKey);
    expect(migrateRuneProofQuestProgressRevision({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
      now: () => '2026-08-22T11:00:00.000Z',
    })).toBeNull();
    expect(storage.values.get(recordKey)).toBe(beforeRecord);
    expect(storage.values.get(indexKey)).toBe(beforeIndex);
  });

  it('rolls a revision migration back when its index update fails', () => {
    const storage = memoryStorage();
    const pack = packWithMigration({
      id: 'fixture-v1-to-v2',
      fromRevision: 'fixture-pack-revision-v1',
      actionIds: { 'old:action': 'local:step' },
      itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
    });
    expect(write(storage, pack, progressFor(pack))).toBe(true);
    const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    storage.values.set(recordKey, canonicalRuneProofProgressJson({
      ...progressFor(pack),
      packRevision: 'fixture-pack-revision-v1',
      confirmedActionIds: ['old:action'],
    }));
    const beforeRecord = storage.values.get(recordKey);
    const beforeIndex = storage.values.get(indexKey);
    const originalSet = storage.setItem;
    let failed = false;
    storage.setItem = (key, value) => {
      if (!failed && key === indexKey) {
        failed = true;
        throw new Error('index unavailable');
      }
      originalSet(key, value);
    };
    expect(migrateRuneProofQuestProgressRevision({
      storage,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      pack,
      now: () => '2026-08-22T11:00:00.000Z',
    })).toBeNull();
    expect(storage.values.get(recordKey)).toBe(beforeRecord);
    expect(storage.values.get(indexKey)).toBe(beforeIndex);
  });
});

describe('RuneProof V1 progress migration', () => {
  it('migrates raw generic V1 records once, filters unknown IDs, and preserves V1', () => {
    const storage = memoryStorage();
    const pack = simpleBranchingPack();
    const actionsKey = runeProofPreviewActionStorageKey('run-a');
    const itemsKey = runeProofPreviewStorageKey('run-a');
    const oldActions = JSON.stringify({
      [pack.questId]: ['shared:start', 'local:step', 'unknown:action'],
      'Unknown Quest': ['unknown'],
    });
    const oldItems = JSON.stringify({
      [pack.questId]: ['global alternative', 'unknown item'],
    });
    storage.values.set(actionsKey, oldActions);
    storage.values.set(itemsKey, oldItems);

    const input = {
      storage,
      runId: 'run-a',
      packs: [pack],
      questSlugs: new Map([[pack.questId, pack.catalogue.slug]]),
      now: () => '2026-08-22T10:00:00.000Z',
    } as const;
    expect(migrateRuneProofProgressV1(input)).toEqual({
      migratedQuestIds: [pack.questId],
      failedQuestIds: [],
    });
    expect(migrateRuneProofProgressV1({
      ...input,
      now: () => '2026-08-22T11:00:00.000Z',
    })).toEqual({ migratedQuestIds: [], failedQuestIds: [] });
    expect(storage.values.get(actionsKey)).toBe(oldActions);
    expect(storage.values.get(itemsKey)).toBe(oldItems);
    expect(readRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      pack,
    })).toMatchObject({
      selectedBranchId: 'local',
      confirmedActionIds: ['shared:start', 'local:step'],
      confirmedItemKeys: ['global alternative'],
    });
  });

  it('never applies revision-specific rename maps to revisionless V1 data', () => {
    const pack = changedPack((mutable) => {
      mutable.migrations = [{
        id: 'first-history',
        fromRevision: 'history-one',
        actionIds: { 'renamed:legacy-action': 'local:step' },
        itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
      }, {
        id: 'second-history',
        fromRevision: 'history-two',
        actionIds: { 'renamed:legacy-action': 'remote:step' },
        itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
      }];
    });
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      [pack.questId]: ['renamed:legacy-action'],
    }));
    expect(migrateRuneProofProgressV1({
      storage,
      runId: 'run-a',
      packs: [pack],
      questSlugs: new Map([[pack.questId, pack.catalogue.slug]]),
      now: () => '2026-08-22T10:00:00.000Z',
    })).toEqual({ migratedQuestIds: [pack.questId], failedQuestIds: [] });
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: pack.catalogue.slug, pack,
    })?.confirmedActionIds).toEqual([]);
  });

  it('never overwrites an existing malformed V2 record from revisionless V1 data', () => {
    const pack = simpleBranchingPack();
    const storage = memoryStorage();
    const key = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
    storage.values.set(key, '{malformed V2');
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      [pack.questId]: ['local:step'],
    }));
    expect(migrateRuneProofProgressV1({
      storage,
      runId: 'run-a',
      packs: [pack],
      questSlugs: new Map([[pack.questId, pack.catalogue.slug]]),
      now: () => '2026-08-22T10:00:00.000Z',
    })).toEqual({ migratedQuestIds: [], failedQuestIds: [] });
    expect(storage.values.get(key)).toBe('{malformed V2');
  });

  it.each(['current', 'old', 'malformed'] as const)(
    'does not overwrite a %s V2 record that appears at the V1 writer capture boundary',
    (winnerKind) => {
      const pack = simpleBranchingPack();
      const storage = memoryStorage();
      const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
      const winnerRaw = winnerKind === 'malformed'
        ? '{raced malformed V2'
        : canonicalRuneProofProgressJson({
          ...progressFor(pack),
          packRevision: winnerKind === 'old' ? 'old-revision' : pack.revision,
          confirmedActionIds: ['remote:step'],
        });
      storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
        [pack.questId]: ['local:step'],
      }));
      const underlyingGet = storage.getItem;
      let recordReads = 0;
      storage.getItem = (key) => {
        if (key === recordKey) {
          recordReads += 1;
          if (recordReads === 1) {
            storage.calls.push({ method: 'getItem', key });
            return null;
          }
          if (recordReads === 2) storage.values.set(recordKey, winnerRaw);
        }
        return underlyingGet(key);
      };
      const preservedStatuses: string[] = [];

      expect(migrateRuneProofProgressV1({
        storage,
        runId: 'run-a',
        packs: [pack],
        questSlugs: new Map([[pack.questId, pack.catalogue.slug]]),
        onPreservedV2: (_questId, source) => { preservedStatuses.push(source.status); },
        now: () => '2026-08-22T10:00:00.000Z',
      })).toEqual({ migratedQuestIds: [], failedQuestIds: [] });
      expect(storage.values.get(recordKey)).toBe(winnerRaw);
      expect(preservedStatuses).toEqual([
        winnerKind === 'malformed' ? 'MALFORMED' : 'VALID',
      ]);
    },
  );

  it('migrates an exact generic V1 __proto__ quest without prototype mutation', () => {
    const pack = changedPack((mutable) => {
      mutable.questId = '__proto__';
      mutable.catalogue.questId = '__proto__';
      mutable.catalogue.slug = 'prototype-quest';
      mutable.completion.canonicalQuestId = '__proto__';
      for (const branch of mutable.branches) {
        branch.actions[branch.actions.length - 1].completion = {
          kind: 'CANONICAL_QUEST_COMPLETED', questId: '__proto__',
        };
      }
    });
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify(
      Object.fromEntries([['__proto__', ['shared:start']]]),
    ));

    expect(migrateRuneProofProgressV1({
      storage,
      runId: 'run-a',
      packs: [pack],
      questSlugs: new Map([[pack.questId, pack.catalogue.slug]]),
      now: () => '2026-08-22T10:00:00.000Z',
    })).toEqual({ migratedQuestIds: ['__proto__'], failedQuestIds: [] });
    expect(readRuneProofQuestProgress({
      storage,
      runId: 'run-a',
      questSlug: pack.catalogue.slug,
      pack,
    })?.confirmedActionIds).toEqual(['shared:start']);
  });

  it('reads each V1 catalogue record once and treats malformed namespaces independently', () => {
    const itemOnlyPack = changedPack((mutable) => {
      mutable.questId = 'Item Only Quest';
      mutable.catalogue.questId = 'Item Only Quest';
      mutable.catalogue.slug = 'item-only-quest';
      mutable.completion.canonicalQuestId = 'Item Only Quest';
      for (const branch of mutable.branches) {
        branch.actions[branch.actions.length - 1].completion = {
          kind: 'CANONICAL_QUEST_COMPLETED', questId: 'Item Only Quest',
        };
      }
    });
    const storage = memoryStorage();
    const actionsKey = runeProofPreviewActionStorageKey('run-a');
    const itemsKey = runeProofPreviewStorageKey('run-a');
    storage.values.set(actionsKey, '{bad json');
    storage.values.set(itemsKey, JSON.stringify({
      [itemOnlyPack.questId]: ['global root'],
    }));
    expect(migrateRuneProofProgressV1({
      storage,
      runId: 'run-a',
      packs: [simpleBranchingPack(), itemOnlyPack],
      questSlugs: new Map([
        [branchingPack.questId, branchingPack.catalogue.slug],
        [itemOnlyPack.questId, itemOnlyPack.catalogue.slug],
      ]),
      now: () => '2026-08-22T10:00:00.000Z',
    })).toEqual({ migratedQuestIds: [itemOnlyPack.questId], failedQuestIds: [] });
    expect(storage.calls.filter(call => call.method === 'getItem' && call.key === actionsKey))
      .toHaveLength(1);
    expect(storage.calls.filter(call => call.method === 'getItem' && call.key === itemsKey))
      .toHaveLength(1);
  });

  it('continues after a quest-local write failure and records stable pack-order results', () => {
    const first = simpleBranchingPack();
    const second = changedPack((mutable) => {
      mutable.questId = 'Second Quest';
      mutable.catalogue.questId = 'Second Quest';
      mutable.catalogue.slug = 'second-quest';
      mutable.completion.canonicalQuestId = 'Second Quest';
      for (const branch of mutable.branches) {
        branch.actions[branch.actions.length - 1].completion = {
          kind: 'CANONICAL_QUEST_COMPLETED', questId: 'Second Quest',
        };
      }
    });
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      [first.questId]: ['shared:start'],
      [second.questId]: ['shared:start'],
    }));
    const underlyingSet = storage.setItem;
    let failedFirstJournal = false;
    storage.setItem = (key, value) => {
      if (!failedFirstJournal && key === runeProofProgressTransactionStorageKey('run-a')) {
        failedFirstJournal = true;
        throw new Error('first quest unavailable');
      }
      underlyingSet(key, value);
    };
    expect(migrateRuneProofProgressV1({
      storage,
      runId: 'run-a',
      packs: [first, second],
      questSlugs: new Map([
        [first.questId, first.catalogue.slug],
        [second.questId, second.catalogue.slug],
      ]),
      now: () => '2026-08-22T10:00:00.000Z',
    })).toEqual({
      migratedQuestIds: [second.questId],
      failedQuestIds: [first.questId],
    });
    expect(readRuneProofQuestProgress({
      storage, runId: 'run-a', questSlug: second.catalogue.slug, pack: second,
    })?.confirmedActionIds).toEqual(['shared:start']);
  });
});
