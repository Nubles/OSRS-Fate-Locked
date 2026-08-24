import type {
  RequirementExpression,
  RuneProofAction,
  RuneProofBranch,
  RuneProofCompiledPack,
  RuneProofProofState,
} from './packModel';

export interface RuneProofBranchProgressView {
  readonly selectedBranchId?: string;
  readonly confirmedActionIds: readonly string[];
  readonly confirmedItemKeys: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly confirmedCheckpointIds: readonly string[];
}

export interface RuneProofBranchEvaluation {
  readonly state: Exclude<RuneProofProofState, 'COMPLETE'>;
  readonly evidenceComplete: boolean;
}

export interface RankedRuneProofBranch {
  readonly branchId: string;
  readonly playable: boolean;
  readonly recommended: boolean;
  readonly recommendationReason: string;
  readonly rank: readonly [number, number, number, number, number, number];
}

export interface ResolvedRuneProofBranch {
  readonly branchId?: string;
  readonly recommendedBranchId?: string;
  readonly pinned: boolean;
}

type ProofKind = 'item' | 'manual' | 'checkpoint';
type OwnerScope = string | undefined;

interface ProofOwnership {
  global: boolean;
  readonly branches: Set<string>;
  firstOccurrence: number;
}

interface BranchOwnershipIndex {
  readonly actions: Map<string, ProofOwnership>;
  readonly item: Map<string, ProofOwnership>;
  readonly manual: Map<string, ProofOwnership>;
  readonly checkpoint: Map<string, ProofOwnership>;
  readonly attachedItem: Map<string, ProofOwnership>;
  readonly attachedManual: Map<string, ProofOwnership>;
  readonly attachedCheckpoint: Map<string, ProofOwnership>;
}

const missingEvaluation: RuneProofBranchEvaluation = {
  state: 'NEEDS_REVIEW',
  evidenceComplete: false,
};

const proofRank = (state: RuneProofBranchEvaluation['state']): number =>
  state === 'READY' || state === 'CONFIRM' ? 0
    : state === 'BLOCKED' ? 1
      : 2;

const tupleFor = (
  branch: RuneProofBranch,
  evaluation: RuneProofBranchEvaluation,
): RankedRuneProofBranch['rank'] => [
  proofRank(evaluation.state),
  evaluation.evidenceComplete ? 0 : 1,
  branch.rank.localRoutePenalty,
  branch.rank.newUnlockCount,
  branch.rank.riskCost,
  branch.rank.tieBreak,
];

const compareBranchIds = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const compareRanks = (
  left: RankedRuneProofBranch['rank'],
  right: RankedRuneProofBranch['rank'],
): number => {
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return difference;
  }
  return 0;
};

const decisiveReason = (
  winner: RankedRuneProofBranch['rank'],
  runnerUp: RankedRuneProofBranch['rank'] | undefined,
): string => {
  if (!runnerUp) return 'only reviewed route';
  const reasons = [
    'legal now',
    'complete evidence',
    'local reviewed route',
    'fewer new unlocks',
    'lower reviewed risk/resource cost',
    'authored tie-break',
  ] as const;
  for (let index = 0; index < winner.length; index += 1) {
    if (winner[index] !== runnerUp[index]) return reasons[index];
  }
  return 'branch ID stability fallback';
};

export const rankRuneProofBranches = (input: {
  readonly pack: RuneProofCompiledPack;
  readonly evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>;
}): readonly RankedRuneProofBranch[] => {
  const sorted = input.pack.branches.map((branch) => {
    const evaluation = input.evaluations[branch.id] ?? missingEvaluation;
    return {
      branchId: branch.id,
      playable: evaluation.state !== 'NEEDS_REVIEW',
      rank: tupleFor(branch, evaluation),
    };
  }).sort((left, right) => (
    compareRanks(left.rank, right.rank) || compareBranchIds(left.branchId, right.branchId)
  ));

  const recommendation = sorted.find(branch => branch.playable);
  const runnerUp = recommendation === undefined
    ? undefined
    : sorted.find(branch => branch.branchId !== recommendation.branchId);
  const reason = recommendation === undefined
    ? undefined
    : decisiveReason(recommendation.rank, runnerUp?.rank);

  return sorted.map(branch => Object.freeze({
    ...branch,
    recommended: branch.branchId === recommendation?.branchId,
    recommendationReason: branch.branchId === recommendation?.branchId
      ? `Recommended for ${reason}.`
      : branch.playable
        ? 'A higher-ranked reviewed route is available.'
        : 'Needs review before this route can be selected.',
  }));
};

const emptyOwnership = (occurrence: number): ProofOwnership => ({
  global: false,
  branches: new Set<string>(),
  firstOccurrence: occurrence,
});

const addOwner = (
  ownership: Map<string, ProofOwnership>,
  id: string,
  owner: OwnerScope,
  occurrence: number,
): void => {
  const existing = ownership.get(id) ?? emptyOwnership(occurrence);
  existing.firstOccurrence = Math.min(existing.firstOccurrence, occurrence);
  if (owner === undefined) existing.global = true;
  else existing.branches.add(owner);
  ownership.set(id, existing);
};

const proofMap = (
  index: BranchOwnershipIndex,
  kind: ProofKind,
  attached: boolean,
): Map<string, ProofOwnership> => {
  if (kind === 'item') return attached ? index.attachedItem : index.item;
  if (kind === 'manual') return attached ? index.attachedManual : index.manual;
  return attached ? index.attachedCheckpoint : index.checkpoint;
};

const buildBranchOwnershipIndex = (pack: RuneProofCompiledPack): BranchOwnershipIndex => {
  const index: BranchOwnershipIndex = {
    actions: new Map(),
    item: new Map(),
    manual: new Map(),
    checkpoint: new Map(),
    attachedItem: new Map(),
    attachedManual: new Map(),
    attachedCheckpoint: new Map(),
  };
  let occurrence = 0;

  const record = (kind: ProofKind, id: string, owner: OwnerScope): void => {
    addOwner(proofMap(index, kind, false), id, owner, occurrence);
    occurrence += 1;
  };

  const recordRequirement = (
    requirement: RequirementExpression,
    owner: OwnerScope,
  ): void => {
    if (requirement.kind === 'ALL' || requirement.kind === 'ANY') {
      requirement.requirements.forEach(child => recordRequirement(child, owner));
      return;
    }
    if (requirement.kind === 'ITEM') record('item', requirement.itemKey, owner);
    else if (requirement.kind === 'MANUAL_CONFIRMATION') {
      record('manual', requirement.confirmationId, owner);
    } else if (requirement.kind === 'BRANCH_STATE' && requirement.checkpointId) {
      record('checkpoint', requirement.checkpointId, owner);
    }
  };

  const recordAttached = (
    kind: ProofKind,
    id: string,
    owner: OwnerScope,
  ): void => {
    addOwner(proofMap(index, kind, true), id, owner, occurrence);
    record(kind, id, owner);
  };

  const recordAction = (action: RuneProofAction, owner: OwnerScope): void => {
    addOwner(index.actions, action.id, owner, occurrence);
    occurrence += 1;
    recordRequirement(action.requirements, owner);
    action.alternatives.forEach(alternative => recordRequirement(alternative.requirements, owner));
    for (const effect of action.itemEffects) {
      record('item', effect.itemKey, owner);
      if (effect.kind === 'PRODUCE') {
        effect.from.forEach(input => record('item', input.itemKey, owner));
      }
      if (effect.kind === 'LEND' && effect.replacementItemKey) {
        record('item', effect.replacementItemKey, owner);
      }
    }
    if (action.combat) record('manual', action.combat.confirmationId, owner);
    if (action.completion.kind === 'ITEM_CONFIRMED') {
      recordAttached('item', action.completion.itemKey, owner);
    } else if (action.completion.kind === 'MANUAL') {
      recordAttached('manual', action.completion.confirmationId, owner);
    } else if (action.completion.kind === 'BRANCH_CHECKPOINT') {
      recordAttached('checkpoint', action.completion.checkpointId, owner);
    }
  };

  recordRequirement(pack.preflight, undefined);
  for (const requirement of pack.initialItems) {
    record('item', requirement.item.key, undefined);
    requirement.alternatives?.forEach(alternative => record('item', alternative.key, undefined));
  }
  pack.sharedActions.forEach(action => recordAction(action, undefined));
  for (const branch of pack.branches) {
    recordRequirement(branch.requirements, branch.id);
    branch.actions.forEach(action => recordAction(action, branch.id));
    branch.checkpointIds.forEach(checkpointId => record('checkpoint', checkpointId, branch.id));
  }
  return index;
};

const uniqueBranchOwner = (ownership: ProofOwnership | undefined): string | undefined => {
  if (!ownership || ownership.global || ownership.branches.size !== 1) return undefined;
  return ownership.branches.values().next().value;
};

const uniqueAttachedBranchOwner = (
  ownership: ProofOwnership | undefined,
): string | undefined => {
  if (!ownership || ownership.branches.size !== 1) return undefined;
  return ownership.branches.values().next().value;
};

const ownerIsActive = (
  ownership: ProofOwnership | undefined,
  branchId: string | undefined,
): boolean => Boolean(ownership && (
  ownership.global || (branchId !== undefined && ownership.branches.has(branchId))
));

interface PinCandidate {
  readonly branchId: string;
  readonly occurrence: number;
}

const proofPinCandidate = (
  index: BranchOwnershipIndex,
  kind: ProofKind,
  id: string,
): PinCandidate | undefined => {
  const attached = proofMap(index, kind, true).get(id);
  if (attached) {
    const branchId = uniqueAttachedBranchOwner(attached);
    return branchId === undefined
      ? undefined
      : { branchId, occurrence: attached.firstOccurrence };
  }
  const ownership = proofMap(index, kind, false).get(id);
  const branchId = uniqueBranchOwner(ownership);
  return branchId === undefined || ownership === undefined
    ? undefined
    : { branchId, occurrence: ownership.firstOccurrence };
};

const pinCandidates = (
  index: BranchOwnershipIndex,
  progress: RuneProofBranchProgressView,
): readonly PinCandidate[] => {
  const candidates: PinCandidate[] = [];
  progress.confirmedActionIds.forEach((actionId) => {
    const ownership = index.actions.get(actionId);
    const branchId = uniqueBranchOwner(ownership);
    if (branchId !== undefined && ownership !== undefined) {
      candidates.push({ branchId, occurrence: ownership.firstOccurrence });
    }
  });
  const addProofCandidates = (kind: ProofKind, ids: readonly string[]): void => {
    ids.forEach((id) => {
      const candidate = proofPinCandidate(index, kind, id);
      if (candidate) candidates.push(candidate);
    });
  };
  addProofCandidates('item', progress.confirmedItemKeys);
  addProofCandidates('manual', progress.manualConfirmationIds);
  addProofCandidates('checkpoint', progress.confirmedCheckpointIds);
  return candidates.sort((left, right) => (
    left.occurrence - right.occurrence || compareBranchIds(left.branchId, right.branchId)
  ));
};

export const resolveRuneProofBranch = (input: {
  readonly pack: RuneProofCompiledPack;
  readonly evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>;
  readonly progress: RuneProofBranchProgressView;
}): ResolvedRuneProofBranch => {
  const recommendation = rankRuneProofBranches(input).find(branch => branch.recommended);
  const recommendedBranchId = recommendation?.branchId;
  const selectedBranchId = input.progress.selectedBranchId;
  if (selectedBranchId !== undefined
    && input.pack.branches.some(branch => branch.id === selectedBranchId)) {
    return { branchId: selectedBranchId, recommendedBranchId, pinned: true };
  }

  const pinned = pinCandidates(
    buildBranchOwnershipIndex(input.pack),
    input.progress,
  )[0];
  if (pinned) {
    return { branchId: pinned.branchId, recommendedBranchId, pinned: true };
  }
  return {
    branchId: recommendedBranchId,
    recommendedBranchId,
    pinned: false,
  };
};

export function activeRuneProofConfirmations(input: {
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofBranchProgressView;
  readonly branchId?: string;
}): Readonly<{
  actionIds: ReadonlySet<string>;
  itemKeys: ReadonlySet<string>;
  manualIds: ReadonlySet<string>;
  checkpointIds: ReadonlySet<string>;
}> {
  const index = buildBranchOwnershipIndex(input.pack);
  const branchId = input.branchId ?? input.progress.selectedBranchId;
  return {
    actionIds: new Set(input.progress.confirmedActionIds.filter(
      id => ownerIsActive(index.actions.get(id), branchId),
    )),
    itemKeys: new Set(input.progress.confirmedItemKeys.filter(
      id => ownerIsActive(index.item.get(id), branchId),
    )),
    manualIds: new Set(input.progress.manualConfirmationIds.filter(
      id => ownerIsActive(index.manual.get(id), branchId),
    )),
    checkpointIds: new Set(input.progress.confirmedCheckpointIds.filter(
      id => ownerIsActive(index.checkpoint.get(id), branchId),
    )),
  };
}

export function withSelectedRuneProofBranch<T extends RuneProofBranchProgressView>(
  progress: T,
  branchId: string,
  pack: RuneProofCompiledPack,
  evaluations: Readonly<Record<string, RuneProofBranchEvaluation>>,
): Omit<T, 'selectedBranchId'> & { readonly selectedBranchId: string } {
  if (!pack.branches.some(branch => branch.id === branchId)) {
    throw new Error(`Unknown RuneProof branch: ${branchId}`);
  }
  const evaluation = evaluations[branchId];
  if (!evaluation) throw new Error(`RuneProof branch ${branchId} is missing an evaluation`);
  if (evaluation.state === 'NEEDS_REVIEW') {
    throw new Error(`RuneProof branch ${branchId} needs review before selection`);
  }
  const { selectedBranchId: _selectedBranchId, ...rest } = progress;
  return { ...rest, selectedBranchId: branchId };
}
