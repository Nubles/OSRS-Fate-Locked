import { describe, expect, it } from 'vitest';
import type { RuneProofRunSnapshot } from '../types';
import type { CompiledGoal } from '../utils/runeproof/goalCompiler';
import type { RuneProofEngine, RuneProofQuery } from '../utils/runeproof/engine';
import { RuneProofService } from './RuneProofService';

const goal = { id: 'item:plank', kind: 'ITEM', label: 'Plank', requirement: { op: 'FACT', fact: { id: 'item:plank', kind: 'ITEM', label: 'Plank' } }, coverage: 'VERIFIED', provenanceIds: [], sourceVersion: 'goal-a' } as CompiledGoal;
const snapshot = (runRevision = 1, runId = 'run-a'): RuneProofRunSnapshot => ({ runId, runRevision, gameModeId: undefined, equipmentTiers: {}, skillCaps: {}, currentLevels: {}, unlockedAreas: [], unlockedChunks: [], unlockedMobility: [], unlockedArcana: [], unlockedHousing: [], unlockedMerchants: [], unlockedMinigames: [], unlockedBosses: [], unlockedStorage: [], unlockedGuilds: [], unlockedFarming: [], unlockedSlayer: [], unlockedBanks: [], completedQuests: [], completedDiaries: [], completedCombatAchievements: [], completedTasks: [], collectionLog: {} });
const report = (id: string) => ({ goalId: id, status: 'UNKNOWN' as const, coverage: 'UNKNOWN' as const, routes: [], blockers: [], unavoidableBlockerFactIds: [], routesComplete: false });
const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

describe('RuneProofService', () => {
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
});
