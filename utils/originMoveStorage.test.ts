import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { initialState } from '../context/GameContext';
import type { GameState } from '../types';
import { serializeCurrent } from './gamePersistence';
import { PROFILES_KEY, parseProfileMetadata } from './profileMetadata';
import type { ProfileTransactionDependencies } from './profileMetadataTransaction';
import { profileBaseKey } from './profileStorage';
import { resolveSaveRecovery, type SaveRecoveryDecision } from './saveRecovery';
import { parseAndMigrateSave } from './saveSchema';
import { chooseMove, planMoveImport, summarizeMovedSave, type MoveProfile } from './originMove';
import { applyMovePlan, collectMoveProfiles, readExistingRuns, type MoveCollectDependencies } from './originMoveStorage';
import type { RecoveryRepository } from './recoveryTypes';

const RUN_A = '123e4567-e89b-42d3-a456-426614174000';
const RUN_B = '223e4567-e89b-42d3-a456-426614174001';
const RUN_HERE = '423e4567-e89b-42d3-a456-426614174003';

const fresh = (): GameState => structuredClone(initialState) as GameState;
const save = (runId: string, entries = 0): string => {
  const state = fresh();
  state.runId = runId;
  state.history = Array.from({ length: entries }, (_, index) => ({
    id: `h${index}`, timestamp: 1_000 + index, type: 'ROLL_FAIL' as const, message: 'No key.',
  }));
  return serializeCurrent(state);
};
const profile = (id: string, data: string, over: Partial<MoveProfile> = {}): MoveProfile => ({
  id, name: `Run ${id}`, createdAt: 7, active: false, data, ...over,
});

const memoryStorage = (entries: [string, string][] = []) => {
  const values = new Map(entries);
  return {
    values,
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

const deps = (storage = memoryStorage()): ProfileTransactionDependencies & { storage: ReturnType<typeof memoryStorage> } => {
  let next = 0;
  let clock = 1_000;
  return {
    storage,
    ownerId: 'move-tab',
    now: () => clock,
    wait: async ms => { clock += ms; },
    validateGameSave: raw => parseAndMigrateSave(raw, fresh()).ok,
    createProfileId: () => `generated-${next += 1}`,
  };
};

const summarize = (data: string) => summarizeMovedSave(data, fresh());
const runIdOf = (data: string) => { const s = summarize(data); return s.ok ? s.runId : null; };
const metadataOf = (storage: ReturnType<typeof memoryStorage>) => {
  const parsed = parseProfileMetadata(storage.getItem(PROFILES_KEY));
  if (parsed.status !== 'current') throw new Error(`metadata ${parsed.status}`);
  return parsed.metadata;
};

describe('adding moved runs on the new address', () => {
  it('a fresh address gets exactly the moved runs, with the open one opened', async () => {
    const d = deps();
    const plan = planMoveImport({ profiles: [
      profile('alpha', save(RUN_A, 2)),
      profile('beta', save(RUN_B), { active: true, name: 'Main' }),
    ] }, readExistingRuns(d.storage, runIdOf), summarize);

    const outcomes = await applyMovePlan(d, plan);

    expect(outcomes).toEqual([{ sourceId: 'alpha', outcome: 'moved' }, { sourceId: 'beta', outcome: 'moved' }]);
    const metadata = metadataOf(d.storage);
    expect(metadata.profiles.map(p => [p.id, p.name, p.createdAt])).toEqual([['alpha', 'Run alpha', 7], ['beta', 'Main', 7]]);
    expect(metadata.activeProfileId).toBe('beta');
    expect(d.storage.getItem(profileBaseKey('alpha'))).toBe(save(RUN_A, 2));
  });

  it('the first load of a moved run goes through the normal startup recovery and is journaled', async () => {
    const d = deps();
    await applyMovePlan(d, planMoveImport({ profiles: [profile('alpha', save(RUN_A, 2))] }, [], summarize));
    const decision: SaveRecoveryDecision = await resolveSaveRecovery({
      profileId: 'alpha',
      pendingRaw: null,
      primaryRaw: d.storage.getItem(profileBaseKey('alpha')),
      mirrorMetadataRaw: null,
      head: null,
      checkpoints: [],
      defaults: fresh(),
    });
    expect(decision).toMatchObject({ kind: 'ready', reason: 'legacy', needsJournalImport: true });
    expect(decision.kind === 'ready' && decision.state.history).toHaveLength(2);
  });

  it('never writes over a run already here: a same run is skipped unless the player keeps both', async () => {
    const here = save(RUN_A, 9);
    const storage = memoryStorage([
      [PROFILES_KEY, JSON.stringify({ version: 2, revision: 3, profiles: [{ id: 'alpha', name: 'Here', createdAt: 1 }], activeProfileId: 'alpha', deletions: [] })],
      [profileBaseKey('alpha'), here],
    ]);
    const d = deps(storage);
    const incoming = [profile('alpha', save(RUN_A, 2))];

    const skipped = planMoveImport({ profiles: incoming }, readExistingRuns(storage, runIdOf), summarize);
    expect(await applyMovePlan(d, skipped)).toEqual([{ sourceId: 'alpha', outcome: 'already_there' }]);
    expect(metadataOf(storage).profiles).toHaveLength(1);

    const keepBoth = planMoveImport({ profiles: incoming }, readExistingRuns(storage, runIdOf), summarize)
      .map(item => chooseMove(item, 'copy'));
    expect(await applyMovePlan(d, keepBoth)).toEqual([{ sourceId: 'alpha', outcome: 'kept_both' }]);
    const metadata = metadataOf(storage);
    expect(metadata.profiles.map(p => [p.id, p.name])).toEqual([['alpha', 'Here'], ['generated-1', 'Run alpha (moved)']]);
    expect(storage.getItem(profileBaseKey('alpha'))).toBe(here);
    expect(storage.getItem(profileBaseKey('generated-1'))).toBe(save(RUN_A, 2));
  });

  it('a different run under a profile id already used here gets a new id', async () => {
    const here = save(RUN_HERE);
    const storage = memoryStorage([
      [PROFILES_KEY, JSON.stringify({ version: 2, revision: 3, profiles: [{ id: 'alpha', name: 'Here', createdAt: 1 }], activeProfileId: 'alpha', deletions: [] })],
      [profileBaseKey('alpha'), here],
    ]);
    const d = deps(storage);
    const plan = planMoveImport({ profiles: [profile('alpha', save(RUN_A))] }, readExistingRuns(storage, runIdOf), summarize);
    expect(await applyMovePlan(d, plan)).toEqual([{ sourceId: 'alpha', outcome: 'moved' }]);
    expect(storage.getItem(profileBaseKey('alpha'))).toBe(here);
    expect(storage.getItem(profileBaseKey('generated-1'))).toBe(save(RUN_A));
  });

  it('a partial move: past the profile limit the rest fail and leave nothing behind', async () => {
    const profiles = Array.from({ length: 11 }, (_, index) =>
      profile(`p${index}`, save(`${String(index).padStart(8, '0')}-e89b-42d3-a456-426614174000`)));
    const d = deps();
    const outcomes = await applyMovePlan(d, planMoveImport({ profiles }, [], summarize));
    expect(outcomes.filter(o => o.outcome === 'moved')).toHaveLength(10);
    expect(outcomes[10]).toEqual({ sourceId: 'p10', outcome: 'failed' });
    expect(d.storage.getItem(profileBaseKey('p10'))).toBeNull();
  });

  it('runs the player left behind, and broken ones, are reported, not written', async () => {
    const d = deps();
    const plan = planMoveImport({ profiles: [profile('alpha', save(RUN_A)), profile('broken', '{"history":7}')] }, [], summarize)
      .map(item => (item.source.id === 'alpha' ? chooseMove(item, 'skip') : chooseMove(item, 'import')));
    expect(await applyMovePlan(d, plan)).toEqual([
      { sourceId: 'alpha', outcome: 'skipped' },
      { sourceId: 'broken', outcome: 'failed' },
    ]);
    expect(d.storage.getItem(profileBaseKey('alpha'))).toBeNull();
    expect(d.storage.getItem(profileBaseKey('broken'))).toBeNull();
  });
});

describe('reading every run on the old address', () => {
  const repository = (): RecoveryRepository => ({
    getHead: vi.fn(async () => null),
    listCheckpoints: vi.fn(async () => []),
    close: vi.fn(),
  } as unknown as RecoveryRepository);

  const collectDeps = (decisions: Record<string, SaveRecoveryDecision | Error>): MoveCollectDependencies => ({
    createFreshState: fresh,
    readPending: () => null,
    readPrimary: () => null,
    readMirrorMetadata: () => null,
    openRepository: () => repository(),
    resolveSaveRecovery: async input => {
      const decision = decisions[input.profileId];
      if (decision instanceof Error) throw decision;
      return decision;
    },
  });

  it('sends what is on screen for the open profile and the startup decision for the rest', async () => {
    const ready = { kind: 'ready', data: save(RUN_B) } as SaveRecoveryDecision;
    const result = await collectMoveProfiles(
      [
        { id: 'open', name: 'Open', createdAt: 1 },
        { id: 'other', name: 'Other', createdAt: 2 },
        { id: 'blank', name: 'Blank', createdAt: 3 },
        { id: 'torn', name: 'Torn', createdAt: 4 },
        { id: 'future', name: 'Future', createdAt: 5 },
        { id: 'gone', name: 'Gone', createdAt: 6 },
      ],
      'open',
      save(RUN_A),
      collectDeps({
        other: ready,
        blank: { kind: 'empty', maxDurablePersistenceRevision: 0 },
        torn: { kind: 'recovery_required' } as SaveRecoveryDecision,
        future: { kind: 'unsupported', rawCandidates: [] },
        gone: new Error('idb'),
      }),
    );
    expect(result.profiles).toEqual([
      { id: 'open', name: 'Open', createdAt: 1, active: true, data: save(RUN_A) },
      { id: 'other', name: 'Other', createdAt: 2, active: false, data: save(RUN_B) },
    ]);
    expect(result.skipped).toEqual([
      { id: 'blank', name: 'Blank', reason: 'empty' },
      { id: 'torn', name: 'Torn', reason: 'needs_recovery' },
      { id: 'future', name: 'Future', reason: 'unsupported' },
      { id: 'gone', name: 'Gone', reason: 'unreadable' },
    ]);
  });
});
