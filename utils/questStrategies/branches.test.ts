import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ReviewedBranchRank, RuneProofCompiledPack } from './packModel';
import {
  activeRuneProofConfirmations,
  rankRuneProofBranches,
  resolveRuneProofBranch,
  type RuneProofBranchEvaluation,
  withSelectedRuneProofBranch,
} from './branches';
import {
  branchingPack,
  packWithSharedAndSingleBranchItemTarget,
  packWithSharedBranchItemTarget,
} from './testFixtures';

const evaluations = {
  local: { state: 'READY', evidenceComplete: true },
  remote: { state: 'READY', evidenceComplete: true },
} as const;

const emptyProgress = {
  selectedBranchId: undefined,
  confirmedActionIds: [] as readonly string[],
  confirmedItemKeys: [] as readonly string[],
  manualConfirmationIds: [] as readonly string[],
  confirmedCheckpointIds: [] as readonly string[],
};

type Mutable<T> = T extends readonly (infer Item)[]
  ? Mutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
    : T;

type FixtureBranchId = 'local' | 'remote';

interface RankingCase {
  readonly label: string;
  readonly evaluationOverrides: Partial<
    Record<FixtureBranchId, Partial<RuneProofBranchEvaluation>>
  >;
  readonly rankOverrides: Partial<Record<FixtureBranchId, Partial<ReviewedBranchRank>>>;
  readonly expectedOrder: readonly string[];
  readonly expectedReason: string;
}

const changedPack = (
  change: (pack: Mutable<RuneProofCompiledPack>) => void,
): RuneProofCompiledPack => {
  const pack = structuredClone(branchingPack) as Mutable<RuneProofCompiledPack>;
  change(pack);
  return pack;
};

describe('RuneProof branch selection', () => {
  it('recommends legal, evidenced, local, low-unlock, low-risk, authored order', () => {
    const ranked = rankRuneProofBranches({ pack: branchingPack, evaluations });
    expect(ranked.map(branch => branch.branchId)).toEqual(['local', 'remote']);
    expect(ranked[0].recommendationReason).toContain('local reviewed route');
    expect(ranked.map(branch => branch.recommended)).toEqual([true, false]);
  });

  it.each<RankingCase>([
    {
      label: 'complete evidence',
      evaluationOverrides: {
        local: { evidenceComplete: false },
        remote: { evidenceComplete: true },
      },
      rankOverrides: {},
      expectedOrder: ['remote', 'local'],
      expectedReason: 'complete evidence',
    },
    {
      label: 'locality',
      evaluationOverrides: {},
      rankOverrides: {
        local: { localRoutePenalty: 0 },
        remote: { localRoutePenalty: 1 },
      },
      expectedOrder: ['local', 'remote'],
      expectedReason: 'local reviewed route',
    },
    {
      label: 'unlock count',
      evaluationOverrides: {},
      rankOverrides: {
        local: { newUnlockCount: 2 },
        remote: { newUnlockCount: 1 },
      },
      expectedOrder: ['remote', 'local'],
      expectedReason: 'fewer new unlocks',
    },
    {
      label: 'risk cost',
      evaluationOverrides: {},
      rankOverrides: { local: { riskCost: 2 }, remote: { riskCost: 1 } },
      expectedOrder: ['remote', 'local'],
      expectedReason: 'lower reviewed risk/resource cost',
    },
    {
      label: 'authored tie-break',
      evaluationOverrides: {},
      rankOverrides: { local: { tieBreak: 2 }, remote: { tieBreak: 1 } },
      expectedOrder: ['remote', 'local'],
      expectedReason: 'authored tie-break',
    },
  ])('isolates the $label rank position', ({
    evaluationOverrides,
    rankOverrides,
    expectedOrder,
    expectedReason,
  }) => {
    const pack = changedPack((mutable) => {
      for (const branch of mutable.branches) {
        Object.assign(branch.rank, {
          localRoutePenalty: 0,
          newUnlockCount: 0,
          riskCost: 0,
          tieBreak: 0,
          ...rankOverrides[branch.id as FixtureBranchId],
        });
      }
    });
    const ranked = rankRuneProofBranches({
      pack,
      evaluations: {
        local: { ...evaluations.local, ...evaluationOverrides.local },
        remote: { ...evaluations.remote, ...evaluationOverrides.remote },
      },
    });
    expect(ranked.map(branch => branch.branchId)).toEqual(expectedOrder);
    expect(ranked[0].recommendationReason).toContain(expectedReason);
  });

  it('uses branch ID only as a truthful deterministic fallback after a complete tuple tie', () => {
    const pack = changedPack((mutable) => {
      mutable.branches.reverse();
      for (const branch of mutable.branches) {
        Object.assign(branch.rank, {
          localRoutePenalty: 0,
          newUnlockCount: 0,
          riskCost: 0,
          tieBreak: 0,
        });
      }
    });
    const first = rankRuneProofBranches({ pack, evaluations });
    const second = rankRuneProofBranches({ pack, evaluations });
    expect(first.map(branch => branch.branchId)).toEqual(['local', 'remote']);
    expect(second).toEqual(first);
    expect(first[0].recommendationReason).toContain('branch ID stability fallback');
  });

  it('prioritizes current proof state and complete evidence before route costs', () => {
    const ranked = rankRuneProofBranches({
      pack: branchingPack,
      evaluations: {
        local: { state: 'BLOCKED', evidenceComplete: false },
        remote: { state: 'READY', evidenceComplete: true },
      },
    });
    expect(ranked.map(branch => branch.branchId)).toEqual(['remote', 'local']);
    expect(ranked[0].recommendationReason).toContain('legal now');
  });

  it('pins after branch-specific progress even if the recommendation changes', () => {
    const selection = resolveRuneProofBranch({
      pack: branchingPack,
      evaluations: {
        local: { state: 'BLOCKED', evidenceComplete: true },
        remote: { state: 'READY', evidenceComplete: true },
      },
      progress: {
        ...emptyProgress,
        confirmedActionIds: ['local:step'],
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: true });
  });

  it.each([
    ['item', { confirmedItemKeys: ['local token'] }],
    ['manual proof', { manualConfirmationIds: ['local:manual'] }],
    ['checkpoint', { confirmedCheckpointIds: ['local:checkpoint'] }],
  ])('also pins from branch-specific %s', (_label, confirmation) => {
    const selection = resolveRuneProofBranch({
      pack: branchingPack,
      evaluations,
      progress: {
        ...emptyProgress,
        ...confirmation,
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: true });
  });

  it('pins to the owner action before considering a globally owned proof target', () => {
    const pack = changedPack((mutable) => {
      mutable.branches[1].actions[0].completion = {
        kind: 'ITEM_CONFIRMED',
        itemKey: 'global root',
      };
    });
    expect(resolveRuneProofBranch({
      pack,
      evaluations,
      progress: { ...emptyProgress, confirmedItemKeys: ['global root'] },
    })).toMatchObject({ branchId: 'remote', pinned: true });
  });

  it('does not pin when one proof target completes actions on multiple branches', () => {
    const pack = packWithSharedBranchItemTarget(branchingPack, 'shared token');
    const selection = resolveRuneProofBranch({
      pack,
      evaluations,
      progress: {
        ...emptyProgress,
        confirmedItemKeys: ['shared token'],
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: false });
  });

  it('pins when a proof target completes a shared action and exactly one branch action', () => {
    const pack = packWithSharedAndSingleBranchItemTarget(
      branchingPack,
      'shared plus local token',
      'local',
    );
    const selection = resolveRuneProofBranch({
      pack,
      evaluations: {
        local: { state: 'BLOCKED', evidenceComplete: true },
        remote: { state: 'READY', evidenceComplete: true },
      },
      progress: {
        ...emptyProgress,
        confirmedItemKeys: ['shared plus local token'],
      },
    });
    expect(selection).toMatchObject({
      branchId: 'local',
      recommendedBranchId: 'remote',
      pinned: true,
    });
  });

  it('does not pin a proof target attached only to a shared action', () => {
    const pack = changedPack((mutable) => {
      mutable.sharedActions[0].completion = {
        kind: 'ITEM_CONFIRMED',
        itemKey: 'global-only target',
      };
    });
    expect(resolveRuneProofBranch({
      pack,
      evaluations,
      progress: {
        ...emptyProgress,
        confirmedItemKeys: ['global-only target'],
      },
    })).toMatchObject({ branchId: 'local', pinned: false });
  });

  it('uses authored proof occurrence before branch ID for competing unique proofs', () => {
    const selection = resolveRuneProofBranch({
      pack: branchingPack,
      evaluations,
      progress: {
        ...emptyProgress,
        confirmedActionIds: ['remote:step', 'local:step'],
      },
    });
    expect(selection).toMatchObject({ branchId: 'local', pinned: true });
  });

  it('keeps a valid explicit selection pinned when its current evaluation changes', () => {
    expect(resolveRuneProofBranch({
      pack: branchingPack,
      evaluations: {
        local: { state: 'NEEDS_REVIEW', evidenceComplete: false },
        remote: { state: 'READY', evidenceComplete: true },
      },
      progress: { ...emptyProgress, selectedBranchId: 'local' },
    })).toMatchObject({
      branchId: 'local',
      recommendedBranchId: 'remote',
      pinned: true,
    });
  });

  it('switches only through an explicit update and retains inactive confirmations', () => {
    const progress = {
      selectedBranchId: 'local',
      confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
      confirmedItemKeys: [],
      manualConfirmationIds: [],
      confirmedCheckpointIds: [],
      revision: 2 as const,
    };
    const switched = withSelectedRuneProofBranch(
      progress,
      'remote',
      branchingPack,
      evaluations,
    );
    expect(switched.selectedBranchId).toBe('remote');
    expect(switched.confirmedActionIds).toEqual([
      'shared:start', 'local:step', 'remote:step',
    ]);
    expect(switched.revision).toBe(2);
    expect(activeRuneProofConfirmations({ pack: branchingPack, progress: switched })
      .actionIds).toEqual(new Set(['shared:start', 'remote:step']));
    expect(progress.selectedBranchId).toBe('local');
    expect(switched).not.toBe(progress);
    expect(switched.confirmedActionIds).toBe(progress.confirmedActionIds);
    expectTypeOf(switched.revision).toEqualTypeOf<2>();
  });

  it('projects globally owned and selected-branch proof types without stale confirmations', () => {
    const active = activeRuneProofConfirmations({
      pack: branchingPack,
      branchId: 'local',
      progress: {
        selectedBranchId: 'remote',
        confirmedActionIds: ['shared:start', 'local:step', 'remote:step'],
        confirmedItemKeys: [
          'global root', 'global alternative', 'local token', 'local effect',
          'remote token', 'remote effect',
        ],
        manualConfirmationIds: [
          'global:manual', 'local:manual', 'local:combat',
          'remote:manual', 'remote:combat',
        ],
        confirmedCheckpointIds: ['local:checkpoint', 'remote:checkpoint'],
      },
    });
    expect(active.actionIds).toEqual(new Set(['shared:start', 'local:step']));
    expect(active.itemKeys).toEqual(new Set([
      'global root', 'global alternative', 'local token', 'local effect',
    ]));
    expect(active.manualIds).toEqual(new Set([
      'global:manual', 'local:manual', 'local:combat',
    ]));
    expect(active.checkpointIds).toEqual(new Set(['local:checkpoint']));
  });

  it('treats globally unique action IDs as exact branch proof', () => {
    const actionIds = [
      ...branchingPack.sharedActions,
      ...branchingPack.branches.flatMap(branch => branch.actions),
    ].map(action => action.id);
    expect(new Set(actionIds).size).toBe(actionIds.length);
    expect(resolveRuneProofBranch({
      pack: branchingPack,
      evaluations,
      progress: { ...emptyProgress, confirmedActionIds: ['remote:step'] },
    })).toMatchObject({ branchId: 'remote', pinned: true });
  });

  it('never recommends a needs-review branch as playable', () => {
    const ranked = rankRuneProofBranches({
      pack: branchingPack,
      evaluations: {
        local: { state: 'NEEDS_REVIEW', evidenceComplete: false },
        remote: { state: 'BLOCKED', evidenceComplete: true },
      },
    });
    expect(ranked[0].branchId).toBe('remote');
    expect(ranked.find(branch => branch.branchId === 'local')?.playable).toBe(false);
  });

  it('fails closed when a branch evaluation is missing', () => {
    const ranked = rankRuneProofBranches({
      pack: branchingPack,
      evaluations: { local: evaluations.local },
    });
    expect(ranked.find(branch => branch.branchId === 'remote')).toMatchObject({
      playable: false,
      recommended: false,
    });
  });

  it('returns no recommendation when every route needs review', () => {
    const allReview = {
      local: { state: 'NEEDS_REVIEW', evidenceComplete: false },
      remote: { state: 'NEEDS_REVIEW', evidenceComplete: false },
    } as const;
    expect(rankRuneProofBranches({
      pack: branchingPack,
      evaluations: allReview,
    }).every(branch => branch.recommended === false)).toBe(true);
    expect(resolveRuneProofBranch({
      pack: branchingPack,
      evaluations: allReview,
      progress: emptyProgress,
    })).toMatchObject({
      branchId: undefined,
      recommendedBranchId: undefined,
      pinned: false,
    });
  });

  it('rejects a direct switch to a needs-review branch', () => {
    expect(() => withSelectedRuneProofBranch({
      ...emptyProgress,
      selectedBranchId: 'local',
    }, 'remote', branchingPack, {
      local: { state: 'READY', evidenceComplete: true },
      remote: { state: 'NEEDS_REVIEW', evidenceComplete: false },
    })).toThrow(/remote.*needs review/i);
  });

  it('rejects direct switches with an unknown branch or missing evaluation', () => {
    expect(() => withSelectedRuneProofBranch(
      emptyProgress,
      'unknown',
      branchingPack,
      evaluations,
    )).toThrow(/unknown.*branch/i);
    expect(() => withSelectedRuneProofBranch(
      emptyProgress,
      'remote',
      branchingPack,
      { local: evaluations.local },
    )).toThrow(/remote.*evaluation/i);
  });

  it('does not mutate the immutable pack, evaluations, or progress while resolving', () => {
    const progress = Object.freeze({
      ...emptyProgress,
      confirmedActionIds: Object.freeze(['local:step']),
      confirmedItemKeys: Object.freeze(['remote token']),
      manualConfirmationIds: Object.freeze([] as string[]),
      confirmedCheckpointIds: Object.freeze([] as string[]),
    });
    const frozenEvaluations = Object.freeze({
      local: Object.freeze({ state: 'READY' as const, evidenceComplete: true }),
      remote: Object.freeze({ state: 'READY' as const, evidenceComplete: true }),
    });
    const before = JSON.stringify({ progress, evaluations: frozenEvaluations });
    rankRuneProofBranches({ pack: branchingPack, evaluations: frozenEvaluations });
    resolveRuneProofBranch({
      pack: branchingPack,
      evaluations: frozenEvaluations,
      progress,
    });
    activeRuneProofConfirmations({ pack: branchingPack, progress });
    expect(JSON.stringify({ progress, evaluations: frozenEvaluations })).toBe(before);
    expect(Object.isFrozen(branchingPack)).toBe(true);
  });
});
