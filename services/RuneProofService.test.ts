import { describe, expect, it, vi } from 'vitest';
import type { RuneProofRunSnapshot } from '../types';
import type { CompiledGoal } from '../utils/runeproof/goalCompiler';
import type { RuneProofEngine, RuneProofQuery } from '../utils/runeproof/engine';
import { RuneProofService } from './RuneProofService';
import * as RuneProofServiceModule from './RuneProofService';
import { createProofCertificate } from '../utils/runeproof/proof';

const goal = { id: 'item:plank', kind: 'ITEM', label: 'Plank', requirement: { op: 'FACT', fact: { id: 'item:plank', kind: 'ITEM', label: 'Plank' } }, coverage: 'VERIFIED', provenanceIds: [], sourceVersion: 'goal-a' } as CompiledGoal;
const snapshot = (runRevision = 1, runId = 'run-a'): RuneProofRunSnapshot => ({ runId, runRevision, gameModeId: undefined, equipmentTiers: {}, skillCaps: {}, currentLevels: {}, unlockedAreas: [], unlockedChunks: [], unlockedMobility: [], unlockedArcana: [], unlockedHousing: [], unlockedMerchants: [], unlockedMinigames: [], unlockedBosses: [], unlockedStorage: [], unlockedGuilds: [], unlockedFarming: [], unlockedSlayer: [], unlockedBanks: [], completedQuests: [], completedDiaries: [], completedCombatAchievements: [], completedTasks: [], collectionLog: {} });
const report = (id: string) => ({ goalId: id, status: 'UNKNOWN' as const, coverage: 'UNKNOWN' as const, routes: [], blockers: [], unavoidableBlockerFactIds: [], routesComplete: false });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

describe('RuneProofService', () => {
  it('provides an isolated display-only export registry', () => {
    expect(typeof (RuneProofServiceModule as any).RuneProofExportRegistry).toBe('function');
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    expect(typeof registry.record).toBe('function');
    expect(typeof registry.select).toBe('function');
    expect(typeof registry.metadata).toBe('function');
  });

  it('records a current evaluated proof and rechecks its certificate hash for export', async () => {
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    const witness = await createProofCertificate({
      rootFactId: 'item:plank',
      steps: { root: { ruleId: 'seed:item:plank', proves: { id: 'item:plank', kind: 'ITEM', label: 'Plank' }, chosenTerms: [], childStepIds: [] } },
      sourceVersion: 'sources-a', runId: 'run-a', runRevision: 1, proofHash: '',
    });
    const positive = {
      goalId: 'item:plank', status: 'OBTAINABLE' as const, coverage: 'VERIFIED' as const,
      routes: [{ id: 'route-a', deterministic: true, prerequisiteCount: 0, recursiveIngredientCount: 0, travelDistance: 0, probability: null, witness }],
      blockers: [], unavoidableBlockerFactIds: [], routesComplete: true,
      explanation: 'A current route is verified.',
    };
    let replayCalls = 0;
    const engine: RuneProofEngine = { sourceVersion: 'sources-a', evaluate: async () => { replayCalls += 1; return positive; } };
    const service = new RuneProofService(engine, () => snapshot(), registry);
    expect((await service.evaluate({ goal }))?.status).toBe('OBTAINABLE');
    service.dispose();

    const selected = await registry.select({ runId: 'run-a', runRevision: 1, sourceVersion: 'sources-a', pinnedGoalIds: [] });
    expect(replayCalls).toBe(2);
    expect(selected).toEqual([{
      goalId: 'item:plank', goalLabel: 'Plank', status: 'OBTAINABLE',
      explanation: 'A current route is verified.', routeLabels: ['Plank'],
      blockerLabels: [], unavoidableBlockerLabels: [], proofHash: witness.proofHash,
      sourceVersion: 'sources-a', runRevision: 1,
    }]);
  });

  it('replays and exports a positive composite goal with its synthetic witness root', async () => {
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    const compositeGoal = {
      ...goal, id: 'quest:composite', kind: 'QUEST', label: 'Composite quest',
      requirement: { op: 'ALL', terms: [goal.requirement] },
    } as CompiledGoal;
    const rootFactId = 'capability:runeproof-goal-quest-composite-goal-a';
    const witness = await createProofCertificate({
      rootFactId,
      steps: { root: { ruleId: 'goal:quest:composite:goal-a', proves: { id: rootFactId, kind: 'CAPABILITY', label: 'runeproof-goal-quest:composite-goal-a' }, chosenTerms: [], childStepIds: [] } },
      sourceVersion: 'sources-a', runId: 'run-a', runRevision: 1, proofHash: '',
    });
    const positive = {
      goalId: compositeGoal.id, status: 'OBTAINABLE' as const, coverage: 'VERIFIED' as const,
      routes: [{ id: 'route-composite', deterministic: true, prerequisiteCount: 0, recursiveIngredientCount: 0, travelDistance: 0, probability: null, witness }],
      blockers: [], unavoidableBlockerFactIds: [], routesComplete: true,
    };
    const engine: RuneProofEngine = { sourceVersion: 'sources-a', evaluate: async () => positive };
    const service = new RuneProofService(engine, () => snapshot(), registry);

    expect((await service.evaluate({ goal: compositeGoal }))?.status).toBe('OBTAINABLE');
    const [selected] = await registry.select({ runId: 'run-a', runRevision: 1, sourceVersion: 'sources-a', pinnedGoalIds: [] });
    expect(selected).toMatchObject({ goalId: compositeGoal.id, status: 'OBTAINABLE', proofHash: witness.proofHash });
  });
  it('exports UNKNOWN when a selected certificate is malformed or stale', async () => {
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    const witness = await createProofCertificate({
      rootFactId: 'item:plank',
      steps: { root: { ruleId: 'seed:item:plank', proves: { id: 'item:plank', kind: 'ITEM', label: 'Plank' }, chosenTerms: [], childStepIds: [] } },
      sourceVersion: 'sources-a', runId: 'run-a', runRevision: 1, proofHash: '',
    });
    registry.record(goal, {
      goalId: goal.id, status: 'OBTAINABLE', coverage: 'VERIFIED',
      routes: [{ id: 'route-a', deterministic: true, prerequisiteCount: 0, recursiveIngredientCount: 0, travelDistance: 0, probability: null, witness: { ...witness, proofHash: 'sha256-' + 'b'.repeat(64) } }],
      blockers: [], unavoidableBlockerFactIds: [], routesComplete: true,
    }, snapshot(), 'sources-a');

    expect(await registry.select({ runId: 'run-a', runRevision: 2, sourceVersion: 'sources-b', pinnedGoalIds: [] }))
      .toEqual([{
        goalId: 'item:plank', goalLabel: 'Plank', status: 'UNKNOWN',
        explanation: 'The selected proof is stale or could not be verified.',
        routeLabels: [], blockerLabels: [], unavoidableBlockerLabels: [],
        proofHash: null, sourceVersion: 'sources-b', runRevision: 2,
      }]);
  });

  it('prevents an older result from overwriting a newer export record', async () => {
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    registry.record(goal, { ...report(goal.id), explanation: 'newer' }, snapshot(2), 'sources-a');
    registry.record(goal, { ...report(goal.id), explanation: 'older' }, snapshot(1), 'sources-a');
    const selected = await registry.select({ runId: 'run-a', runRevision: 2, sourceVersion: 'sources-a', pinnedGoalIds: [] });
    expect(selected[0].explanation).toBe('newer');
  });

  it('caps selected and pinned display records at twenty deterministically', async () => {
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    const goals = Array.from({ length: 21 }, (_, index) => ({ ...goal, id: `item:goal-${String(index).padStart(2, '0')}`, label: `Goal ${index}` }));
    goals.forEach(value => registry.record(value, report(value.id), snapshot(), 'sources-a'));
    const selection = { runId: 'run-a', runRevision: 1, sourceVersion: 'sources-a', pinnedGoalIds: goals.map(value => value.id).reverse() };
    const selected = await registry.select(selection);
    expect(selected).toHaveLength(20);
    expect(selected.map((value: any) => value.goalId)).toEqual([...selected.map((value: any) => value.goalId)].sort());
    expect(registry.metadata(selection)).toEqual({ proofCount: 20, sourceVersion: 'sources-a' });
    expect(registry.latestSourceVersion('run-a')).toBe('sources-a');
  });
  it('reselects a cached goal and keeps equal-revision source records isolated', async () => {
    const registry = new (RuneProofServiceModule as any).RuneProofExportRegistry();
    const engine: RuneProofEngine = { sourceVersion: 'sources-a', evaluate: async query => report(query.goal.id) };
    const service = new RuneProofService(engine, () => snapshot(), registry);
    const otherGoal = { ...goal, id: 'item:nails', label: 'Nails' } as CompiledGoal;
    await service.evaluate({ goal });
    await service.evaluate({ goal: otherGoal });
    await service.evaluate({ goal });
    const selected = await registry.select({ runId: 'run-a', runRevision: 1, sourceVersion: 'sources-a', pinnedGoalIds: [] });
    expect(selected.map((value: any) => value.goalId)).toEqual(['item:plank']);

    registry.record(otherGoal, { ...report(otherGoal.id), explanation: 'other source' }, snapshot(), 'sources-b');
    const exact = await registry.select({ runId: 'run-a', runRevision: 1, sourceVersion: 'sources-a', pinnedGoalIds: [] });
    expect(exact[0]).toMatchObject({ goalId: goal.id, explanation: 'Verified evidence is incomplete.', sourceVersion: 'sources-a' });
  });
  it('uses a complete cache identity so different goals and revisions cannot share results', async () => {
    let calls = 0;
    const engine: RuneProofEngine = { sourceVersion: 'sources-a', evaluate: async (query) => { calls += 1; return report(query.goal.id); } };
    let current = snapshot();
    const service = new RuneProofService(engine, () => current);
    await service.evaluate({ goal });
    await service.evaluate({ goal });
    current = snapshot(2);
    await service.evaluate({ goal });
    await service.evaluate({ goal: { ...goal, id: 'item:nails' } });
    expect(calls).toBe(3);
  });

  it('publishes only the latest asynchronous request and ignores stale revision, source, run-switch and disposal responses', async () => {
    const first = deferred<ReturnType<typeof report>>();
    const second = deferred<ReturnType<typeof report>>();
    let call = 0;
    const engine: RuneProofEngine = { sourceVersion: 'sources-a', evaluate: async () => (++call === 1 ? first.promise : second.promise) };
    let current = snapshot();
    const service = new RuneProofService(engine, () => current);
    const older = service.evaluate({ goal });
    const latest = service.evaluate({ goal: { ...goal, id: 'item:nails' } });
    second.resolve(report('item:nails'));
    expect((await latest)?.goalId).toBe('item:nails');
    first.resolve(report('item:plank'));
    expect(await older).toBeNull();
    current = snapshot(2);
    const stale = service.evaluate({ goal });
    current = snapshot(3, 'run-b');
    expect(await stale).toBeNull();
    const disposed = service.evaluate({ goal });
    service.dispose();
    expect(await disposed).toBeNull();
  });

  it('discards a response if the source version changes while it is in flight', async () => {
    const pending = deferred<ReturnType<typeof report>>();
    let sourceVersion = 'sources-a';
    const engine: RuneProofEngine = { get sourceVersion() { return sourceVersion; }, evaluate: async () => pending.promise };
    const service = new RuneProofService(engine, () => snapshot());
    const result = service.evaluate({ goal });
    sourceVersion = 'sources-b';
    pending.resolve(report(goal.id));
    expect(await result).toBeNull();
  });

  it('disposes an optional owned engine lifecycle without requiring it from injected engines', () => {
    const dispose = vi.fn();
    const engine: RuneProofEngine = {
      sourceVersion: 'sources-a',
      evaluate: async query => report(query.goal.id),
      dispose,
    };
    const service = new RuneProofService(engine, () => snapshot());
    service.dispose();
    service.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);

    const injected: RuneProofEngine = {
      sourceVersion: 'sources-a',
      evaluate: async query => report(query.goal.id),
    };
    expect(() => new RuneProofService(injected, () => snapshot()).dispose())
      .not.toThrow();
  });
});
