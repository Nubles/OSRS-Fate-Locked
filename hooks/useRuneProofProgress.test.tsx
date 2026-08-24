// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  runeProofPreviewStorageKey,
  type RuneProofStorage,
} from '../utils/questRoutes/previewChecks';
import type {
  RuneProofActionCompletion,
  RuneProofCompiledPack,
} from '../utils/questStrategies/packModel';
import {
  canonicalRuneProofProgressJson,
  runeProofProgressIndexStorageKey,
  runeProofProgressStorageKey,
  runeProofProgressTransactionStorageKey,
  type RuneProofQuestProgressV2,
} from '../utils/questStrategies/progress';
import { compileRuneProofQuestPack } from '../utils/questStrategies/packCompiler';
import { runeProofPreviewActionStorageKey } from '../utils/questStrategies/previewActions';
import {
  branchingPack,
  branchingPackDefinition,
  exampleCatalogueEntry,
} from '../utils/questStrategies/testFixtures';
import { useRuneProofProgress } from './useRuneProofProgress';

afterEach(cleanup);

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

const localPack = branchingPack;
const remotePack = changedPack((pack) => {
  pack.questId = 'Remote Quest';
  pack.catalogue.questId = 'Remote Quest';
  pack.catalogue.slug = 'remote-quest';
  pack.completion.canonicalQuestId = 'Remote Quest';
  for (const branch of pack.branches) {
    branch.actions[branch.actions.length - 1].completion = {
      kind: 'CANONICAL_QUEST_COMPLETED', questId: 'Remote Quest',
    };
  }
});
const packs = [localPack, remotePack] as const;

const packWithLocalTarget = (
  completion: RuneProofActionCompletion,
): RuneProofCompiledPack => changedPack((pack) => {
  pack.branches[0].actions[0].completion = completion;
  delete pack.branches[0].actions[0].combat;
});

const localActionTargetPack = packWithLocalTarget({ kind: 'ACTION_CONFIRMED' });
const localItemTargetPack = packWithLocalTarget({
  kind: 'ITEM_CONFIRMED', itemKey: 'local token',
});
const localManualTargetPack = packWithLocalTarget({
  kind: 'MANUAL', confirmationId: 'local:manual',
});
const localCheckpointTargetPack = packWithLocalTarget({
  kind: 'BRANCH_CHECKPOINT', checkpointId: 'local:checkpoint',
});
const staleLocalItemGatePack = changedPack((pack) => {
  const localAction = pack.branches[0].actions[0];
  localAction.completion = { kind: 'ITEM_CONFIRMED', itemKey: 'local token' };
  localAction.requirements = structuredClone(pack.preflight);
  delete localAction.combat;
});

const emptyProgress = (
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

const seedExactProgress = (
  storage: ReturnType<typeof memoryStorage>,
  pack: RuneProofCompiledPack,
  progress: RuneProofQuestProgressV2 = emptyProgress(pack),
): void => {
  storage.values.set(
    runeProofProgressStorageKey(progress.runId, pack.catalogue.slug),
    canonicalRuneProofProgressJson(progress),
  );
};

const questReadsFor = (
  storage: ReturnType<typeof memoryStorage>,
  runId: string,
  pack: RuneProofCompiledPack,
): number => storage.calls.filter(call => call.method === 'getItem'
  && call.key === runeProofProgressStorageKey(runId, pack.catalogue.slug)).length;

describe('useRuneProofProgress', () => {
  it('reads one compact index and hydrates only the selected quest record', async () => {
    const storage = memoryStorage();
    seedExactProgress(storage, localPack);
    const { result, rerender } = renderHook(
      ({ selected }) => useRuneProofProgress('run-a', packs, selected, storage),
      { initialProps: { selected: undefined as string | undefined } },
    );
    await waitFor(() => expect(result.current.isIndexHydrated).toBe(true));
    expect(questReadsFor(storage, 'run-a', localPack)).toBe(0);
    expect(questReadsFor(storage, 'run-a', remotePack)).toBe(0);
    expect(storage.calls.filter(call => call.method === 'getItem'
      && call.key === runeProofProgressIndexStorageKey('run-a'))).toHaveLength(1);

    rerender({ selected: localPack.questId });
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedQuestId).toBe(localPack.questId);
    expect(questReadsFor(storage, 'run-a', localPack)).toBe(1);
    expect(questReadsFor(storage, 'run-a', remotePack)).toBe(0);
  });

  it('commits UI state only after a verified write and isolates run transitions', async () => {
    const values = new Map<string, string>();
    const storage: RuneProofStorage = {
      getItem: key => values.get(key) ?? null,
      setItem: () => { throw new Error('quota'); },
      removeItem: key => { values.delete(key); },
    };
    const { result, rerender } = renderHook(
      ({ runId }) => useRuneProofProgress(runId, [localPack], localPack.questId, storage),
      { initialProps: { runId: 'run-a' } },
    );
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    act(() => result.current.setActionConfirmed('local:step', true));
    expect(result.current.selectedProgress?.confirmedActionIds).toEqual([]);
    expect(result.current.warnings.at(-1)).toMatch(/could not persist/i);

    rerender({ runId: 'run-b' });
    expect(result.current.selectedProgress).toBeUndefined();
    await waitFor(() => expect(result.current.runId).toBe('run-b'));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedProgress?.confirmedActionIds).toEqual([]);
  });

  it('does not persist an unknown confirmation that normalization rejects', async () => {
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', localPack.catalogue.slug);
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [localPack], localPack.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(questReadsFor(storage, 'run-a', localPack)).toBe(1);
    act(() => result.current.setActionConfirmed('unknown:action', true));
    expect(result.current.selectedProgress?.confirmedActionIds).toEqual([]);
    expect(storage.values.has(recordKey)).toBe(false);
  });

  it('cancels an obsolete selected-quest hydration before it can publish or read', async () => {
    const storage = memoryStorage();
    seedExactProgress(storage, localPack);
    seedExactProgress(storage, remotePack, emptyProgress(remotePack));
    const { result, rerender } = renderHook(
      ({ selected }) => useRuneProofProgress('run-a', packs, selected, storage),
      { initialProps: { selected: undefined as string | undefined } },
    );
    await waitFor(() => expect(result.current.isIndexHydrated).toBe(true));
    rerender({ selected: localPack.questId });
    rerender({ selected: remotePack.questId });
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedQuestId).toBe(remotePack.questId);
    expect(questReadsFor(storage, 'run-a', localPack)).toBe(0);
    expect(questReadsFor(storage, 'run-a', remotePack)).toBe(1);
  });

  it('does not awaken a stale branch effect when a later shared action completes', async () => {
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewStorageKey('run-a'), JSON.stringify({
      [localPack.questId]: ['local effect'],
    }));
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [localPack], localPack.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedProgress?.selectedBranchId).toBeUndefined();
    expect(result.current.selectedProgress?.confirmedItemKeys).toEqual(['local effect']);

    act(() => result.current.setActionConfirmed('shared:start', true));

    expect(result.current.selectedProgress?.selectedBranchId).toBeUndefined();
    expect(result.current.selectedProgress).toMatchObject({
      confirmedActionIds: ['shared:start'],
      confirmedItemKeys: ['local effect'],
    });
  });

  it('does not pin from a stale V1 item target when a different global gate completes it', async () => {
    const storage = memoryStorage();
    storage.values.set(runeProofPreviewStorageKey('run-a'), JSON.stringify({
      [staleLocalItemGatePack.questId]: ['local token'],
    }));
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [staleLocalItemGatePack], staleLocalItemGatePack.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.warnings).toEqual([]);
    expect(result.current.selectedProgress?.confirmedItemKeys).toEqual(['local token']);
    expect(result.current.selectedProgress?.selectedBranchId).toBeUndefined();

    act(() => result.current.setManualConfirmed('global:manual', true));

    expect(result.current.selectedProgress).toMatchObject({
      confirmedItemKeys: ['local token'],
      manualConfirmationIds: ['global:manual'],
    });
    expect(result.current.selectedProgress?.selectedBranchId).toBeUndefined();
  });

  it.each([
    ['action', localActionTargetPack, (controls: ReturnType<typeof useRuneProofProgress>) => (
      controls.setActionConfirmed('local:step', true)
    )],
    ['item', localItemTargetPack, (controls: ReturnType<typeof useRuneProofProgress>) => (
      controls.setItemConfirmed('local token', true)
    )],
    ['manual', localManualTargetPack, (controls: ReturnType<typeof useRuneProofProgress>) => (
      controls.setManualConfirmed('local:manual', true)
    )],
    ['checkpoint', localCheckpointTargetPack, (controls: ReturnType<typeof useRuneProofProgress>) => (
      controls.setCheckpointConfirmed('local:checkpoint', true)
    )],
  ])('pins and reloads from the first unambiguous branch-specific %s proof', async (
    _label,
    pack,
    confirm,
  ) => {
    const storage = memoryStorage();
    const first = renderHook(() => useRuneProofProgress(
      'run-a', [pack], pack.questId, storage,
    ));
    await waitFor(() => expect(first.result.current.isSelectedHydrated).toBe(true));
    act(() => confirm(first.result.current));
    expect(first.result.current.selectedProgress?.selectedBranchId).toBe('local');
    first.unmount();

    const second = renderHook(() => useRuneProofProgress(
      'run-a', [pack], pack.questId, storage,
    ));
    await waitFor(() => expect(second.result.current.selectedProgress?.selectedBranchId)
      .toBe('local'));
  });

  it.each([
    ['no terminal gates', [], undefined],
    ['only the terminal manual', ['local:terminal-manual'], undefined],
    ['only terminal combat', ['local:terminal-combat'], undefined],
    [
      'every terminal gate',
      ['local:terminal-manual', 'local:terminal-combat'],
      'local',
    ],
  ] as const)(
    'pins a compiler-valid terminal canonical target with %s',
    async (_label, manualConfirmationIds, expectedBranchId) => {
      const definition: any = structuredClone(branchingPackDefinition);
      const terminal = definition.branches[0].actions.at(-1);
      terminal.requirements = {
        kind: 'MANUAL_CONFIRMATION',
        id: 'local:terminal-manual-requirement',
        confirmationId: 'local:terminal-manual',
        prompt: 'Confirm the isolated terminal step.',
        evidenceIds: ['review:example'],
      };
      terminal.combat = {
        ...structuredClone(definition.branches[0].actions[0].combat),
        id: 'local:terminal-combat-declaration',
        confirmationId: 'local:terminal-combat',
      };
      const compiled = compileRuneProofQuestPack(definition, {
        catalogue: exampleCatalogueEntry,
        expectedCatalogueRevision: 'catalogue-revision',
      });
      expect(compiled.findings).toEqual([]);
      const pack = compiled.pack!;
      const actionId = pack.branches[0].actions.at(-1)!.id;
      expect(pack.branches[0].actions.at(-1)!.completion.kind)
        .toBe('CANONICAL_QUEST_COMPLETED');
      const storage = memoryStorage();
      seedExactProgress(storage, pack, emptyProgress(pack, 'run-a', {
        manualConfirmationIds,
      }));
      const first = renderHook(() => useRuneProofProgress(
        'run-a', [pack], pack.questId, storage,
      ));
      await waitFor(() => expect(first.result.current.isSelectedHydrated).toBe(true));
      expect(first.result.current.selectedProgress?.selectedBranchId).toBeUndefined();

      act(() => first.result.current.setActionConfirmed(actionId, true));

      expect(first.result.current.selectedProgress?.confirmedActionIds).toEqual([actionId]);
      expect(first.result.current.selectedProgress?.selectedBranchId)
        .toBe(expectedBranchId);
      first.unmount();
      const second = renderHook(() => useRuneProofProgress(
        'run-a', [pack], pack.questId, storage,
      ));
      await waitFor(() => expect(second.result.current.isSelectedHydrated).toBe(true));
      expect(second.result.current.selectedProgress?.selectedBranchId)
        .toBe(expectedBranchId);
      second.unmount();
    },
  );

  it('does not pin a compiler-valid proof target attached to actions on both branches', async () => {
    const definition: any = structuredClone(branchingPackDefinition);
    for (const branch of definition.branches) {
      branch.actions[0].completion = {
        kind: 'ITEM_CONFIRMED',
        itemKey: 'global root',
      };
      delete branch.actions[0].combat;
    }
    const compiled = compileRuneProofQuestPack(definition, {
      catalogue: exampleCatalogueEntry,
      expectedCatalogueRevision: 'catalogue-revision',
    });
    expect(compiled.findings).toEqual([]);
    expect(compiled.pack?.branches.map(branch => branch.id)).toEqual(['local', 'remote']);
    const pack = compiled.pack!;
    const storage = memoryStorage();
    const first = renderHook(() => useRuneProofProgress(
      'run-a', [pack], pack.questId, storage,
    ));
    await waitFor(() => expect(first.result.current.isSelectedHydrated).toBe(true));

    act(() => first.result.current.setItemConfirmed('global root', true));

    expect(first.result.current.selectedProgress?.confirmedItemKeys).toEqual(['global root']);
    expect(first.result.current.selectedProgress?.selectedBranchId).toBeUndefined();
    first.unmount();
    const second = renderHook(() => useRuneProofProgress(
      'run-a', [pack], pack.questId, storage,
    ));
    await waitFor(() => expect(second.result.current.isSelectedHydrated).toBe(true));
    expect(second.result.current.selectedProgress?.selectedBranchId).toBeUndefined();
  });

  it('switches through supplied evaluations and rejects missing or needs-review routes', async () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [localPack], localPack.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    const ready = {
      local: { state: 'READY', evidenceComplete: true },
      remote: { state: 'READY', evidenceComplete: true },
    } as const;
    act(() => result.current.selectBranch('remote', ready));
    expect(result.current.selectedProgress?.selectedBranchId).toBe('remote');
    const recordBefore = storage.values.get(
      runeProofProgressStorageKey('run-a', localPack.catalogue.slug),
    );
    act(() => result.current.selectBranch('local', {
      ...ready,
      local: { state: 'NEEDS_REVIEW', evidenceComplete: false },
    }));
    act(() => result.current.selectBranch('local', { remote: ready.remote }));
    expect(result.current.selectedProgress?.selectedBranchId).toBe('remote');
    expect(storage.values.get(
      runeProofProgressStorageKey('run-a', localPack.catalogue.slug),
    )).toBe(recordBefore);
  });

  it('migrates an old V2 revision before considering conflicting V1 fallback', async () => {
    const current = changedPack((pack) => {
      pack.revision = 'fixture-pack-v2';
      pack.migrations = [{
        id: 'fixture-v1-to-v2',
        fromRevision: 'fixture-pack-v1',
        actionIds: { 'old:action': 'local:step' },
        itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
      }];
    });
    const storage = memoryStorage();
    storage.values.set(runeProofProgressStorageKey('run-a', current.catalogue.slug),
      canonicalRuneProofProgressJson({
        ...emptyProgress(current),
        packRevision: 'fixture-pack-v1',
        confirmedActionIds: ['old:action'],
      }));
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      [current.questId]: ['remote:step'],
    }));
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [current], current.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedProgress).toMatchObject({
      packRevision: current.revision,
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    });
    expect(result.current.selectedProgress?.confirmedActionIds).not.toContain('remote:step');
    expect(result.current.index.entries[current.catalogue.slug].packRevision)
      .toBe(current.revision);
  });

  it('rereads V2 before relevant V1 migration when the record appears after hydration', async () => {
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', localPack.catalogue.slug);
    const v2Raw = canonicalRuneProofProgressJson(emptyProgress(localPack, 'run-a', {
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    }));
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      [localPack.questId]: ['remote:step'],
    }));
    const underlyingGet = storage.getItem;
    let materializeOnFirstRecordRead = true;
    storage.getItem = (key) => {
      if (key === recordKey && materializeOnFirstRecordRead) {
        materializeOnFirstRecordRead = false;
        storage.calls.push({ method: 'getItem', key });
        storage.values.set(recordKey, v2Raw);
        return null;
      }
      return underlyingGet(key);
    };

    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [localPack], localPack.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));

    expect(result.current.selectedProgress).toMatchObject({
      selectedBranchId: 'local',
      confirmedActionIds: ['local:step'],
    });
    expect(result.current.selectedProgress?.confirmedActionIds).not.toContain('remote:step');
    expect(storage.values.get(recordKey)).toBe(v2Raw);
  });

  it.each(['current', 'old', 'malformed'] as const)(
    'hydrates or migrates the %s V2 winner that appears at the V1 writer boundary',
    async (winnerKind) => {
      const pack = winnerKind === 'old' ? changedPack((mutable) => {
        mutable.revision = 'fixture-current-revision';
        mutable.migrations = [{
          id: 'fixture-old-to-current',
          fromRevision: 'fixture-old-revision',
          actionIds: { 'old:remote-step': 'remote:step' },
          itemKeys: {}, branchIds: {}, manualConfirmationIds: {}, checkpointIds: {},
        }];
      }) : localPack;
      const storage = memoryStorage();
      const recordKey = runeProofProgressStorageKey('run-a', pack.catalogue.slug);
      const winnerRaw = winnerKind === 'malformed'
        ? '{raced malformed V2'
        : canonicalRuneProofProgressJson(emptyProgress(pack, 'run-a', {
          packRevision: winnerKind === 'old' ? 'fixture-old-revision' : pack.revision,
          selectedBranchId: 'remote',
          confirmedActionIds: [winnerKind === 'old' ? 'old:remote-step' : 'remote:step'],
        }));
      storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
        [pack.questId]: ['local:step'],
      }));
      const underlyingGet = storage.getItem;
      let recordReads = 0;
      storage.getItem = (key) => {
        if (key === recordKey) {
          recordReads += 1;
          if (recordReads < 3) {
            storage.calls.push({ method: 'getItem', key });
            return null;
          }
          if (recordReads === 3) storage.values.set(recordKey, winnerRaw);
        }
        return underlyingGet(key);
      };

      const { result } = renderHook(() => useRuneProofProgress(
        'run-a', [pack], pack.questId, storage,
      ));
      await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));

      if (winnerKind === 'malformed') {
        expect(result.current.selectedProgress).toBeUndefined();
        expect(result.current.warnings.at(-1)).toMatch(/malformed/i);
        expect(storage.values.get(recordKey)).toBe(winnerRaw);
      } else {
        expect(result.current.selectedProgress).toMatchObject({
          packRevision: pack.revision,
          selectedBranchId: 'remote',
          confirmedActionIds: ['remote:step'],
        });
        expect(result.current.selectedProgress?.confirmedActionIds).not.toContain('local:step');
        if (winnerKind === 'current') expect(storage.values.get(recordKey)).toBe(winnerRaw);
      }
    },
  );

  it('preserves malformed current V2 and never overwrites it from V1', async () => {
    const storage = memoryStorage();
    const key = runeProofProgressStorageKey('run-a', localPack.catalogue.slug);
    storage.values.set(key, '{bad current V2');
    storage.values.set(runeProofPreviewActionStorageKey('run-a'), JSON.stringify({
      [localPack.questId]: ['local:step'],
    }));
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [localPack], localPack.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedProgress).toBeUndefined();
    expect(result.current.warnings.at(-1)).toMatch(/malformed/i);
    expect(storage.values.get(key)).toBe('{bad current V2');
  });

  it('preserves an unmigratable old V2 record and exposes no fabricated empty progress', async () => {
    const current = changedPack((pack) => { pack.revision = 'fixture-pack-v2'; });
    const storage = memoryStorage();
    const key = runeProofProgressStorageKey('run-a', current.catalogue.slug);
    const oldRaw = canonicalRuneProofProgressJson({
      ...emptyProgress(current), packRevision: 'fixture-pack-v1',
    });
    storage.values.set(key, oldRaw);
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [current], current.questId, storage,
    ));
    await waitFor(() => expect(result.current.isSelectedHydrated).toBe(true));
    expect(result.current.selectedProgress).toBeUndefined();
    expect(result.current.warnings.at(-1)).toMatch(/revision/i);
    expect(storage.values.get(key)).toBe(oldRaw);
  });

  it('copies transaction recovery warnings into controls', async () => {
    const storage = memoryStorage();
    const recordKey = runeProofProgressStorageKey('run-a', localPack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey('run-a');
    storage.values.set(recordKey, '{"partial":true}');
    storage.values.set(indexKey, '{"partial":true}');
    storage.values.set(runeProofProgressTransactionStorageKey('run-a'),
      canonicalRuneProofProgressJson({
        schemaVersion: 2,
        runId: 'run-a',
        questSlug: localPack.catalogue.slug,
        previousQuestRecord: null,
        previousIndex: canonicalRuneProofProgressJson({
          schemaVersion: 2, runId: 'run-a', entries: {},
        }),
      }));
    const { result } = renderHook(() => useRuneProofProgress(
      'run-a', [localPack], undefined, storage,
    ));
    await waitFor(() => expect(result.current.isIndexHydrated).toBe(true));
    expect(result.current.warnings).toEqual([
      'RuneProof recovered interrupted progress for run run-a.',
    ]);
  });
});
