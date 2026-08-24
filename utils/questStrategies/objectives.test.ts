import { describe, expect, it } from 'vitest';
import { questStrategyFor } from '../../data/questWalkthroughs.preview-boundary';
import {
  preflightRuneProofObjectives,
  questStrategyProgress,
  rankRuneProofObjectives,
} from './objectives';
import {
  candidate,
  catalogueSummary,
  makeCatalogueSummaries,
  progressSummary,
  readyRequirementSnapshot,
} from './testFixtures';

const strategyFor = (questId: string) => {
  const strategy = questStrategyFor(questId);
  if (!strategy) throw new Error(`Missing ${questId} strategy fixture.`);
  return strategy;
};

describe('RuneProof objective preflight', () => {
  it('evaluates 210 lightweight headers and no action graph', () => {
    const summaries = makeCatalogueSummaries(210, {
      noPackQuestIds: new Set(['Quest 210']),
    });
    let indexLookups = 0;
    const entries = new Proxy({}, {
      get: () => {
        indexLookups += 1;
        return undefined;
      },
    });
    const result = preflightRuneProofObjectives({
      summaries,
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries,
      },
    });
    expect(result.candidates).toHaveLength(210);
    expect(result.metrics).toEqual({
      headerEvaluations: 210,
      progressIndexLookups: 210,
      packLoads: 0,
      deepAnalyses: 0,
    });
    expect(indexLookups).toBe(210);
    expect(summaries.some(summary => 'actions' in summary)).toBe(false);
    expect(result.candidates.at(-1)?.proofState).toBe('NEEDS_REVIEW');
  });

  it('returns at most three playable recommendations in the exact sort order', () => {
    const recommendations = rankRuneProofObjectives([
      candidate('ready-late', 'READY', 2, 20, 0, 10),
      candidate('confirm', 'CONFIRM', 1, 10, 5, 10),
      candidate('blocked', 'BLOCKED', 1, 8, 9, 10),
      candidate('ready-progress', 'READY', 1, 9, 7, 10),
      candidate('ready-empty', 'READY', 1, 9, 0, 10),
      candidate('review', 'NEEDS_REVIEW', 1, 1, 0, 10),
      candidate('complete', 'COMPLETE', 1, 1, 10, 10),
    ]);
    expect(recommendations.map(value => value.questId)).toEqual([
      'ready-progress',
      'ready-empty',
      'ready-late',
    ]);
    expect(recommendations).toHaveLength(3);
  });

  it('ignores stale progress summaries from another pack revision', () => {
    const summary = catalogueSummary({
      questId: 'Revised quest',
      packRevision: 'pack-v2',
      packDisposition: 'RELEASED',
      lifecycle: 'PREVIEW_VALIDATED',
      playable: true,
    });
    const result = preflightRuneProofObjectives({
      summaries: [summary],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {
          'revised-quest': progressSummary({
            questId: 'Revised quest',
            packRevision: 'pack-v1',
            complete: true,
          }),
        },
      },
    });
    expect(result.candidates[0].proofState).not.toBe('COMPLETE');
    expect(result.candidates[0].progress).toEqual({ completed: 0, total: 0 });
  });

  it('ignores a progress row whose exact quest ID does not match', () => {
    const summary = catalogueSummary({
      questId: 'Exact quest',
      packRevision: 'pack-v2',
    });
    const result = preflightRuneProofObjectives({
      summaries: [summary],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {
          'exact-quest': progressSummary({
            questId: 'Wrong quest',
            packRevision: 'pack-v2',
            completedActionCount: 8,
            totalActionCount: 8,
            complete: true,
          }),
        },
      },
    });
    expect(result.candidates[0]).toMatchObject({
      proofState: 'READY',
      progress: { completed: 0, total: 0 },
    });
  });

  it('copies matching compact counts without inferring completion from equal counts', () => {
    const summary = catalogueSummary({
      questId: 'In progress',
      packRevision: 'pack-v2',
    });
    const result = preflightRuneProofObjectives({
      summaries: [summary],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {
          'in-progress': progressSummary({
            questId: 'In progress',
            packRevision: 'pack-v2',
            completedActionCount: 8,
            totalActionCount: 8,
            complete: false,
          }),
        },
      },
    });
    expect(result.candidates[0]).toMatchObject({
      proofState: 'READY',
      progress: { completed: 8, total: 8 },
    });
  });

  it('projects an exact matching complete compact summary as complete', () => {
    const summary = catalogueSummary({
      questId: 'Guide complete',
      packRevision: 'pack-v2',
    });
    const result = preflightRuneProofObjectives({
      summaries: [summary],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {
          'guide-complete': progressSummary({
            questId: 'Guide complete',
            packRevision: 'pack-v2',
            completedActionCount: 6,
            totalActionCount: 6,
            complete: true,
          }),
        },
      },
    });
    expect(result.candidates[0]).toMatchObject({
      proofState: 'COMPLETE',
      progress: { completed: 6, total: 6 },
      actionable: false,
    });
  });

  it('keeps canonical completion scoped to each quest', () => {
    const result = preflightRuneProofObjectives({
      summaries: [
        catalogueSummary({ questId: 'Complete quest' }),
        catalogueSummary({ questId: 'Ready quest' }),
      ],
      snapshot: readyRequirementSnapshot({
        completedQuestIds: new Set(['Complete quest']),
        observedCanonicalCompletion: true,
      }),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {},
      },
    });
    expect(result.candidates.map(value => value.proofState)).toEqual([
      'COMPLETE',
      'READY',
    ]);
  });

  it('fails closed for unplayable lifecycle metadata and unresolved evidence', () => {
    const result = preflightRuneProofObjectives({
      summaries: [
        catalogueSummary({
          questId: 'Draft quest',
          lifecycle: 'DRAFT',
          reviewStatus: 'DRAFT',
          playable: true,
        }),
        catalogueSummary({
          questId: 'Mismatched review quest',
          lifecycle: 'PREVIEW_VALIDATED',
          reviewStatus: 'REJECTED',
          playable: true,
        }),
        catalogueSummary({
          questId: 'Unresolved quest',
          requirementStatus: 'UNRESOLVED',
          playable: true,
        }),
      ],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {},
      },
    });
    expect(result.candidates.map(value => value.proofState)).toEqual([
      'NEEDS_REVIEW',
      'NEEDS_REVIEW',
      'NEEDS_REVIEW',
    ]);
  });

  it('keeps only reviewed blockers with both exact actionable fields', () => {
    const blockedSummary = catalogueSummary({
      questId: 'Mining quest',
      preflight: {
        kind: 'SKILL_LEVEL',
        id: 'skill:mining:10',
        skill: 'Mining',
        level: 10,
        evidenceIds: ['review:mining'],
      },
    });
    const result = preflightRuneProofObjectives({
      summaries: [blockedSummary],
      snapshot: readyRequirementSnapshot({ levels: { Mining: 1 } }),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {},
      },
    });
    expect(result.candidates[0]).toMatchObject({
      proofState: 'BLOCKED',
      blockerReason: 'Requires Mining 10; effective level is 1.',
      unblockAction: 'Raise Mining to 10.',
      actionable: true,
    });
    expect(rankRuneProofObjectives(result.candidates)).toEqual([{
      questId: 'Mining quest',
      reason: 'Requires Mining 10; effective level is 1. Raise Mining to 10.',
      progress: { completed: 0, total: 0 },
      readiness: 'BLOCKED',
    }]);

    expect(rankRuneProofObjectives([{
      ...candidate('incomplete-blocker', 'BLOCKED', 1, 1, 0, 1),
      actionable: true,
      blockerReason: undefined,
      unblockAction: undefined,
    }])).toEqual([]);
  });

  it('floors and caps limits and uses quest ID as the final stable tie-breaker', () => {
    const tied = [
      candidate('Zebra quest', 'READY', 1, 1, 1, 2),
      candidate('Aardvark quest', 'READY', 1, 1, 1, 2),
      candidate('Middle quest', 'READY', 1, 1, 1, 2),
      candidate('Fourth quest', 'READY', 1, 1, 1, 2),
    ];
    expect(rankRuneProofObjectives(tied, 2.9).map(value => value.questId)).toEqual([
      'Aardvark quest',
      'Fourth quest',
    ]);
    expect(rankRuneProofObjectives(tied, 99)).toHaveLength(3);
    expect(rankRuneProofObjectives(tied, -1)).toEqual([]);
  });

  it('uses exact manual copy and never recommends review or complete states', () => {
    expect(rankRuneProofObjectives([
      candidate('confirm', 'CONFIRM', 1, 1, 0, 1),
    ])).toEqual([{
      questId: 'confirm',
      reason: 'Deterministic gates pass; confirm the reviewed manual requirement.',
      progress: { completed: 0, total: 1 },
      readiness: 'CONFIRM',
    }]);
    expect(rankRuneProofObjectives([
      candidate('review', 'NEEDS_REVIEW', 1, 1, 0, 1),
      candidate('complete', 'COMPLETE', 1, 1, 1, 1),
    ])).toEqual([]);
  });

  it('prefers greater completed count after an equal retained ratio', () => {
    expect(rankRuneProofObjectives([
      candidate('one-of-two', 'READY', 1, 1, 1, 2),
      candidate('two-of-four', 'READY', 1, 1, 2, 4),
    ]).map(value => value.questId)).toEqual(['two-of-four', 'one-of-two']);
  });

  it('freezes the projected candidates, progress, metrics, and result', () => {
    const result = preflightRuneProofObjectives({
      summaries: [catalogueSummary()],
      snapshot: readyRequirementSnapshot(),
      progressIndex: {
        schemaVersion: 2,
        runId: 'run-a',
        entries: {},
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.candidates)).toBe(true);
    expect(Object.isFrozen(result.candidates[0])).toBe(true);
    expect(Object.isFrozen(result.candidates[0].progress)).toBe(true);
    expect(Object.isFrozen(result.metrics)).toBe(true);
  });
});

describe('questStrategyProgress', () => {
  it('counts direct manual confirmations', () => {
    const strategy = strategyFor("Cook's Assistant");

    expect(questStrategyProgress(
      strategy,
      new Set(['cooks-assistant:start-quest']),
      new Set(),
      new Set(),
    )).toEqual({ completed: 1, total: 9 });
  });

  it('closes transitive dependencies for item confirmations', () => {
    const strategy = strategyFor("Cook's Assistant");

    expect(questStrategyProgress(
      strategy,
      new Set(),
      new Set(['pot of flour']),
      new Set(),
    )).toEqual({ completed: 7, total: 9 });
  });

  it('counts a preview-confirmed final quest action as completion', () => {
    const strategy = strategyFor("Cook's Assistant");

    expect(questStrategyProgress(
      strategy,
      new Set(['cooks-assistant:complete']),
      new Set(),
      new Set(),
    )).toEqual({ completed: 9, total: 9 });
  });
});
