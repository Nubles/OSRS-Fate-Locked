import { describe, expect, it } from 'vitest';
import { createPlankFixture, plankSource, requirement } from './fixtures/plank';
import { createRuneProofEngine, evaluateRuneProof } from './engine';
import { verifyProof } from './proof';
import { RuneProofExportRegistry, RuneProofService } from '../../services/RuneProofService';

describe('RuneProof plank scenario', () => {
  it('exports the exact app-authored plank summary consumed by RuneLite', async () => {
    const fixture = createPlankFixture();
    const registry = new RuneProofExportRegistry();
    const service = new RuneProofService(
      createRuneProofEngine(fixture.sources),
      () => fixture.snapshot,
      registry,
    );

    expect((await service.evaluate({ goal: fixture.goal }))?.status)
      .toBe('OBTAINABLE_RNG');
    expect(await registry.select({
      runId: fixture.snapshot.runId,
      runRevision: fixture.snapshot.runRevision,
      sourceVersion: fixture.sources.sourceVersion,
      pinnedGoalIds: [],
    })).toEqual([{
      goalId: 'item:plank',
      goalLabel: 'Plank',
      status: 'OBTAINABLE_RNG',
      explanation: 'A current route is verified and depends on chance.',
      routeLabels: ['Lumberyard goblin'],
      blockerLabels: [],
      unavoidableBlockerLabels: [],
      proofHash: 'sha256-c57febc43f4ddbc9f3c7af0397e3d9ae87b8be239b4efdea4cc519d026f7e68b',
      sourceVersion: 'plank-fixture-v1',
      runRevision: 7,
    }]);
  });
  it('proves the reachable verified monster drop without suggesting an unlock', async () => {
    const fixture = createPlankFixture();
    const report = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);
    const verifyResult = await verifyProof({
      witness: report.routes[0].witness,
      rules: fixture.rulesById(),
      runFacts: fixture.runFacts(),
      runId: fixture.snapshot.runId,
      runRevision: fixture.snapshot.runRevision,
      sourceVersion: fixture.sources.sourceVersion,
    });

    expect(report.status).toBe('OBTAINABLE_RNG');
    expect(Object.values(report.routes[0].witness.steps)).toContainEqual(
      expect.objectContaining({ proves: expect.objectContaining({ id: 'item:plank' }) }),
    );
    expect(verifyResult).toEqual({ valid: true, stale: false, errors: [] });
    expect(report.explanation ?? '').not.toContain('unlock');
  });
  it('ranks a reachable floor spawn ahead of a random monster drop', async () => {
    const fixture = createPlankFixture({ rules: [
      plankSource('plank-random-drop', { sourceKind: 'DROP', probability: 0.2 }),
      plankSource('plank-floor-spawn', { sourceKind: 'SPAWN', probability: null }),
    ] });

    const report = await evaluateRuneProof({ goal: fixture.goal, includeAlternatives: true }, fixture.snapshot, fixture.sources);

    expect(report.status).toBe('OBTAINABLE');
    expect(report.routes[0].witness.steps.root.ruleId).toBe('plank-floor-spawn');
    expect(report.routes.every(route => route.deterministic)).toBe(true);
  });

  it('excludes a drop in an unlocked but stranded current chunk', async () => {
    const fixture = createPlankFixture({
      rules: [plankSource('plank-stranded-drop', { locationId: 'stranded-island' })],
      snapshot: { unlockedChunks: ['1,1', '2,2'] },
    });

    const report = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);

    expect(report.status).toBe('IMPOSSIBLE');
    expect(report.routes).toEqual([]);
  });

  it('requires both the exact dungeon entrance and its current gate', async () => {
    const entranceBlocked = createPlankFixture({
      rules: [plankSource('plank-gated-drop', { locationId: 'gated-dungeon' })],
      snapshot: { unlockedChunks: [], completedQuests: ['Dungeon access'] },
    });
    const gateBlocked = createPlankFixture({
      rules: [plankSource('plank-gated-drop', { locationId: 'gated-dungeon' })],
    });
    const reachable = createPlankFixture({
      rules: [plankSource('plank-gated-drop', { locationId: 'gated-dungeon' })],
      snapshot: { completedQuests: ['Dungeon access'] },
    });

    expect((await evaluateRuneProof({ goal: entranceBlocked.goal }, entranceBlocked.snapshot, entranceBlocked.sources)).status)
      .toBe('IMPOSSIBLE');
    expect((await evaluateRuneProof({ goal: gateBlocked.goal }, gateBlocked.snapshot, gateBlocked.sources)).status)
      .toBe('IMPOSSIBLE');
    expect((await evaluateRuneProof({ goal: reachable.goal }, reachable.snapshot, reachable.sources)).status)
      .toBe('OBTAINABLE_RNG');
  });

  it('reports exact missing current requirements only when a route is reachable', async () => {
    const fixture = createPlankFixture({ rules: [plankSource('plank-permit', {
      sourceKind: 'SPAWN', probability: null,
      requirements: requirement('QUEST', 'Carpenter permit'),
    })] });

    const report = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);

    expect(report.status).toBe('BLOCKED');
    expect(report.blockers).toEqual([{
      factIds: ['quest:carpenter-permit'],
      labels: ['Carpenter permit'],
    }]);
    expect(report.unavoidableBlockerFactIds).toEqual(['quest:carpenter-permit']);
  });

  it('returns IMPOSSIBLE only after every known source is excluded with verified coverage', async () => {
    const fixture = createPlankFixture({ rules: [
      plankSource('plank-far-shop', { sourceKind: 'SHOP', locationId: 'town-shop', probability: null }),
      plankSource('plank-stranded-drop', { locationId: 'stranded-island' }),
    ] });

    const report = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);

    expect(report.status).toBe('IMPOSSIBLE');
    expect(report.coverage).toBe('VERIFIED');
    expect(report.routesComplete).toBe(true);
  });

  it('returns UNKNOWN rather than an impossibility claim with partial source coverage', async () => {
    const fixture = createPlankFixture({
      coverage: 'PARTIAL',
      rules: [
        plankSource('plank-far-shop', { sourceKind: 'SHOP', locationId: 'town-shop', probability: null }),
        plankSource('plank-stranded-drop', { locationId: 'stranded-island' }),
      ],
    });

    const report = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);

    expect(report).toMatchObject({
      status: 'UNKNOWN', coverage: 'UNKNOWN', routes: [], blockers: [],
      unavoidableBlockerFactIds: [], routesComplete: false,
    });
  });

  it('does not manufacture a proof from an unseeded production cycle', async () => {
    const fixture = createPlankFixture({ rules: [
      plankSource('plank-from-logs', {
        sourceKind: 'PRODUCTION', probability: null,
        requirements: requirement('ITEM', 'Logs'),
      }),
      plankSource('logs-from-plank', {
        output: { id: 'item:logs', kind: 'ITEM', label: 'Logs' },
        sourceKind: 'PRODUCTION', probability: null,
        requirements: requirement('ITEM', 'Plank'),
      }),
    ] });

    const first = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);
    const second = await evaluateRuneProof({ goal: fixture.goal }, fixture.snapshot, fixture.sources);

    expect(first).toMatchObject({
      status: 'UNKNOWN', routes: [], blockers: [], unavoidableBlockerFactIds: [], routesComplete: false,
    });
    expect(first.explanation).toContain('dependency cycle');
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
