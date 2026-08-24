import type {
  RequirementExpression,
  RuneProofAtomicRequirement,
  RuneProofProofState,
} from './packModel';

export interface RuneProofRequirementSnapshot {
  readonly completedQuestIds: ReadonlySet<string>;
  readonly questPoints: number;
  readonly levels: Readonly<Record<string, number>>;
  readonly combatLevel: number;
  readonly regions: ReadonlySet<string>;
  readonly chunks: ReadonlySet<string>;
  readonly canonicalUnlocks: Readonly<{
    equipment: ReadonlySet<string>;
    mobility: ReadonlySet<string>;
    arcana: ReadonlySet<string>;
    housing: ReadonlySet<string>;
    guilds: ReadonlySet<string>;
    merchants: ReadonlySet<string>;
    minigames: ReadonlySet<string>;
    bosses: ReadonlySet<string>;
    storage: ReadonlySet<string>;
    farming: ReadonlySet<string>;
    slayer: ReadonlySet<string>;
    banks: ReadonlySet<string>;
    diaries: ReadonlySet<string>;
    combatAchievements: ReadonlySet<string>;
    tasks: ReadonlySet<string>;
    collectionItems: ReadonlySet<string>;
  }>;
  readonly transportIds: ReadonlySet<string>;
  readonly availableBoostSourceIds?: ReadonlySet<string>;
  readonly itemQuantities?: Readonly<Record<string, number>>;
  readonly itemAliases?: Readonly<Record<string, string>>;
  readonly confirmedManualIds: ReadonlySet<string>;
  readonly selectedBranchId?: string;
  readonly branchCheckpointIds: ReadonlySet<string>;
  readonly observedCanonicalCompletion: boolean;
}

export interface RuneProofRequirementResult {
  readonly state: RuneProofProofState;
  readonly blockerIds: readonly string[];
  readonly manualConfirmationIds: readonly string[];
  readonly unresolvedEvidenceIds: readonly string[];
  readonly reasons: readonly string[];
  readonly unblockActions: readonly string[];
  readonly advisories: readonly string[];
}

export interface RuneProofRequirementValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const MAX_EXPRESSION_DEPTH = 32;
const MAX_EXPRESSION_NODES = 2_048;
const CHUNK_KEY = /^(?:0|[1-9]\d*|-[1-9]\d*),(?:0|[1-9]\d*|-[1-9]\d*)$/;

const ATOMIC_KEYS = {
  QUEST_COMPLETED: ['kind', 'id', 'evidenceIds', 'questId'],
  QUEST_POINTS: ['kind', 'id', 'evidenceIds', 'points'],
  SKILL_LEVEL: ['kind', 'id', 'evidenceIds', 'skill', 'level'],
  TEMPORARY_BOOST: [
    'kind', 'id', 'evidenceIds', 'skill', 'baseLevel', 'targetLevel',
    'boostSourceIds', 'timingPolicy',
  ],
  COMBAT_LEVEL: ['kind', 'id', 'evidenceIds', 'level'],
  REGION_ACCESS: ['kind', 'id', 'evidenceIds', 'regionId'],
  CHUNK_ACCESS: ['kind', 'id', 'evidenceIds', 'chunk', 'plane'],
  TRANSPORT_ACCESS: [
    'kind', 'id', 'evidenceIds', 'transportId', 'origin', 'destination', 'oneWay', 'fare',
  ],
  INSTANCE_ACCESS: [
    'kind', 'id', 'evidenceIds', 'instanceId', 'entranceChunks', 'plane',
  ],
  ITEM: ['kind', 'id', 'evidenceIds', 'itemKey', 'quantity'],
  CANONICAL_UNLOCK: ['kind', 'id', 'evidenceIds', 'unlockType', 'unlockId'],
  BRANCH_STATE: ['kind', 'id', 'evidenceIds', 'branchId', 'checkpointId'],
  MANUAL_CONFIRMATION: ['kind', 'id', 'evidenceIds', 'confirmationId', 'prompt'],
  UNRESOLVED_EVIDENCE: ['kind', 'id', 'evidenceIds', 'evidenceId', 'reason'],
} as const;

type AtomicKind = keyof typeof ATOMIC_KEYS;

const CANONICAL_UNLOCK_TYPES = new Set([
  'EQUIPMENT', 'MOBILITY', 'ARCANA', 'HOUSING', 'GUILD', 'MERCHANT', 'MINIGAME',
  'BOSS', 'STORAGE', 'FARMING', 'SLAYER', 'BANK', 'DIARY', 'COMBAT_ACHIEVEMENT',
  'TASK', 'COLLECTION_ITEM',
]);

const TIMING_POLICIES = new Set(['QUEST_START', 'ACTION_WINDOW', 'MANUAL_TIMING']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hasDenseIndexes = (value: readonly unknown[]): boolean => {
  const ownNumericKeys = Object.getOwnPropertyNames(value)
    .filter(key => /^(?:0|[1-9]\d*)$/.test(key));
  if (ownNumericKeys.length !== value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

const isNonblank = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const isPositiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
);

const rejectUnexpectedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  errors: string[],
): void => {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(value).filter(key => !allowed.has(key));
  if (unexpected.length > 0) {
    errors.push(`${path} has unexpected field(s): ${unexpected.join(', ')}`);
  }
};

const requireNonblank = (
  value: unknown,
  path: string,
  errors: string[],
): void => {
  if (!isNonblank(value)) errors.push(`${path} must be a nonblank string`);
};

const requirePositiveInteger = (
  value: unknown,
  path: string,
  errors: string[],
): void => {
  if (!isPositiveInteger(value)) errors.push(`${path} must be a positive integer`);
};

const requireInteger = (
  value: unknown,
  path: string,
  errors: string[],
): void => {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    errors.push(`${path} must be an integer`);
  }
};

const requireCanonicalChunk = (
  value: unknown,
  path: string,
  errors: string[],
): void => {
  if (typeof value !== 'string' || !CHUNK_KEY.test(value)) {
    errors.push(`${path} must be a canonical cx,cy chunk key`);
  }
};

const requireNonblankStringArray = (
  value: unknown,
  path: string,
  errors: string[],
  allowEmpty = false,
): void => {
  if (!Array.isArray(value) || !hasDenseIndexes(value)) {
    errors.push(`${path} must be a dense array`);
    return;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${path} must not be empty`);
    return;
  }
  value.forEach((entry, index) => requireNonblank(entry, `${path}[${index}]`, errors));
};

const validateAtomicBase = (
  value: Record<string, unknown>,
  path: string,
  errors: string[],
): void => {
  requireNonblank(value.id, `${path}.id`, errors);
  requireNonblankStringArray(value.evidenceIds, `${path}.evidenceIds`, errors);
};

const atomicRequirementErrors = (
  value: Record<string, unknown>,
  path: string,
): string[] => {
  const errors: string[] = [];
  const kind = value.kind;
  if (typeof kind !== 'string' || !Object.hasOwn(ATOMIC_KEYS, kind)) {
    errors.push(`${path}.kind is unknown`);
    validateAtomicBase(value, path, errors);
    rejectUnexpectedKeys(value, ['kind', 'id', 'evidenceIds'], path, errors);
    return errors;
  }

  validateAtomicBase(value, path, errors);
  rejectUnexpectedKeys(value, ATOMIC_KEYS[kind as AtomicKind], path, errors);

  switch (kind as AtomicKind) {
    case 'QUEST_COMPLETED':
      requireNonblank(value.questId, `${path}.questId`, errors);
      break;
    case 'QUEST_POINTS':
      requirePositiveInteger(value.points, `${path}.points`, errors);
      break;
    case 'SKILL_LEVEL':
      requireNonblank(value.skill, `${path}.skill`, errors);
      requirePositiveInteger(value.level, `${path}.level`, errors);
      break;
    case 'TEMPORARY_BOOST':
      requireNonblank(value.skill, `${path}.skill`, errors);
      requirePositiveInteger(value.baseLevel, `${path}.baseLevel`, errors);
      requirePositiveInteger(value.targetLevel, `${path}.targetLevel`, errors);
      requireNonblankStringArray(value.boostSourceIds, `${path}.boostSourceIds`, errors);
      if (!TIMING_POLICIES.has(value.timingPolicy as string)) {
        errors.push(`${path}.timingPolicy is unknown`);
      }
      break;
    case 'COMBAT_LEVEL':
      requirePositiveInteger(value.level, `${path}.level`, errors);
      break;
    case 'REGION_ACCESS':
      requireNonblank(value.regionId, `${path}.regionId`, errors);
      break;
    case 'CHUNK_ACCESS':
      requireCanonicalChunk(value.chunk, `${path}.chunk`, errors);
      requireInteger(value.plane, `${path}.plane`, errors);
      break;
    case 'TRANSPORT_ACCESS':
      requireNonblank(value.transportId, `${path}.transportId`, errors);
      requireCanonicalChunk(value.origin, `${path}.origin`, errors);
      requireCanonicalChunk(value.destination, `${path}.destination`, errors);
      if (typeof value.oneWay !== 'boolean') errors.push(`${path}.oneWay must be a boolean`);
      if (value.fare !== undefined) {
        if (!isRecord(value.fare)) {
          errors.push(`${path}.fare must be an object`);
        } else {
          rejectUnexpectedKeys(value.fare, ['itemKey', 'quantity'], `${path}.fare`, errors);
          requireNonblank(value.fare.itemKey, `${path}.fare.itemKey`, errors);
          requirePositiveInteger(value.fare.quantity, `${path}.fare.quantity`, errors);
        }
      }
      break;
    case 'INSTANCE_ACCESS':
      requireNonblank(value.instanceId, `${path}.instanceId`, errors);
      requireNonblankStringArray(value.entranceChunks, `${path}.entranceChunks`, errors);
      if (Array.isArray(value.entranceChunks) && hasDenseIndexes(value.entranceChunks)) {
        value.entranceChunks.forEach((chunk, index) => (
          requireCanonicalChunk(chunk, `${path}.entranceChunks[${index}]`, errors)
        ));
      }
      requireInteger(value.plane, `${path}.plane`, errors);
      break;
    case 'ITEM':
      requireNonblank(value.itemKey, `${path}.itemKey`, errors);
      requirePositiveInteger(value.quantity, `${path}.quantity`, errors);
      break;
    case 'CANONICAL_UNLOCK':
      if (!CANONICAL_UNLOCK_TYPES.has(value.unlockType as string)) {
        errors.push(`${path}.unlockType is unknown`);
      }
      requireNonblank(value.unlockId, `${path}.unlockId`, errors);
      break;
    case 'BRANCH_STATE':
      requireNonblank(value.branchId, `${path}.branchId`, errors);
      if (value.checkpointId !== undefined) {
        requireNonblank(value.checkpointId, `${path}.checkpointId`, errors);
      }
      break;
    case 'MANUAL_CONFIRMATION':
      requireNonblank(value.confirmationId, `${path}.confirmationId`, errors);
      requireNonblank(value.prompt, `${path}.prompt`, errors);
      break;
    case 'UNRESOLVED_EVIDENCE':
      requireNonblank(value.evidenceId, `${path}.evidenceId`, errors);
      requireNonblank(value.reason, `${path}.reason`, errors);
      break;
  }
  return errors;
};

export const validateRequirementExpression = (
  expression: unknown,
): RuneProofRequirementValidation => {
  const errors: string[] = [];
  let nodes = 0;
  let nodeLimitReached = false;

  const visit = (value: unknown, depth: number, path: string): void => {
    if (nodeLimitReached) return;
    nodes += 1;
    if (nodes > MAX_EXPRESSION_NODES) {
      errors.push(`requirement expression exceeds ${MAX_EXPRESSION_NODES} nodes`);
      nodeLimitReached = true;
      return;
    }
    if (depth > MAX_EXPRESSION_DEPTH) {
      errors.push(`${path} exceeds depth ${MAX_EXPRESSION_DEPTH}`);
      return;
    }
    if (!isRecord(value) || typeof value.kind !== 'string') {
      errors.push(`${path} must be a requirement object`);
      return;
    }
    if (value.kind === 'ALL' || value.kind === 'ANY') {
      rejectUnexpectedKeys(value, ['kind', 'requirements'], path, errors);
      if (!Array.isArray(value.requirements) || !hasDenseIndexes(value.requirements)) {
        errors.push(`${path}.requirements must be a dense array`);
        return;
      }
      if (value.kind === 'ANY' && value.requirements.length === 0) {
        errors.push(`${path}.requirements must not be empty for ANY`);
        return;
      }
      for (let index = 0;
        index < value.requirements.length && !nodeLimitReached;
        index += 1) {
        visit(value.requirements[index], depth + 1, `${path}.requirements[${index}]`);
      }
      return;
    }
    errors.push(...atomicRequirementErrors(value, path));
  };

  visit(expression, 0, '$');
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
};

const stableUnique = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  return values.filter(value => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const result = (
  state: RuneProofProofState,
  fields: Partial<Omit<RuneProofRequirementResult, 'state'>> = {},
): RuneProofRequirementResult => ({
  state,
  blockerIds: fields.blockerIds ?? [],
  manualConfirmationIds: fields.manualConfirmationIds ?? [],
  unresolvedEvidenceIds: fields.unresolvedEvidenceIds ?? [],
  reasons: fields.reasons ?? [],
  unblockActions: fields.unblockActions ?? [],
  advisories: fields.advisories ?? [],
});

const ready = (advisories: readonly string[] = []): RuneProofRequirementResult => (
  result('READY', { advisories })
);

const blocked = (
  requirement: RuneProofAtomicRequirement,
  reason: string,
  unblockAction: string,
  advisories: readonly string[] = [],
): RuneProofRequirementResult => result('BLOCKED', {
  blockerIds: [requirement.id],
  reasons: [reason],
  unblockActions: [unblockAction],
  advisories,
});

const confirm = (
  requirement: RuneProofAtomicRequirement,
  reason: string,
  unblockAction = `Confirm: ${reason}`,
  advisories: readonly string[] = [],
): RuneProofRequirementResult => result('CONFIRM', {
  manualConfirmationIds: [requirement.id],
  reasons: [reason],
  unblockActions: [unblockAction],
  advisories,
});

const needsReview = (
  unresolvedEvidenceId: string,
  reason: string,
): RuneProofRequirementResult => result('NEEDS_REVIEW', {
  unresolvedEvidenceIds: [unresolvedEvidenceId],
  reasons: [reason],
});

const oneWayAdvisories = (
  requirement: Extract<RuneProofAtomicRequirement, { kind: 'TRANSPORT_ACCESS' }>,
): readonly string[] => requirement.oneWay
  ? [`Transport ${requirement.transportId} is one-way from ${requirement.origin} to ${requirement.destination}; review a separate return route.`]
  : [];

const canonicalItemKey = (
  itemKey: string,
  aliases: Readonly<Record<string, string>> | undefined,
): string => aliases?.[itemKey] ?? itemKey;

const canonicalUnlockSet = (
  requirement: Extract<RuneProofAtomicRequirement, { kind: 'CANONICAL_UNLOCK' }>,
  snapshot: RuneProofRequirementSnapshot,
): ReadonlySet<string> => {
  switch (requirement.unlockType) {
    case 'EQUIPMENT': return snapshot.canonicalUnlocks.equipment;
    case 'MOBILITY': return snapshot.canonicalUnlocks.mobility;
    case 'ARCANA': return snapshot.canonicalUnlocks.arcana;
    case 'HOUSING': return snapshot.canonicalUnlocks.housing;
    case 'GUILD': return snapshot.canonicalUnlocks.guilds;
    case 'MERCHANT': return snapshot.canonicalUnlocks.merchants;
    case 'MINIGAME': return snapshot.canonicalUnlocks.minigames;
    case 'BOSS': return snapshot.canonicalUnlocks.bosses;
    case 'STORAGE': return snapshot.canonicalUnlocks.storage;
    case 'FARMING': return snapshot.canonicalUnlocks.farming;
    case 'SLAYER': return snapshot.canonicalUnlocks.slayer;
    case 'BANK': return snapshot.canonicalUnlocks.banks;
    case 'DIARY': return snapshot.canonicalUnlocks.diaries;
    case 'COMBAT_ACHIEVEMENT': return snapshot.canonicalUnlocks.combatAchievements;
    case 'TASK': return snapshot.canonicalUnlocks.tasks;
    case 'COLLECTION_ITEM': return snapshot.canonicalUnlocks.collectionItems;
  }
};

const evaluateAtomicRequirement = (
  requirement: RuneProofAtomicRequirement,
  snapshot: RuneProofRequirementSnapshot,
): RuneProofRequirementResult => {
  switch (requirement.kind) {
    case 'QUEST_COMPLETED':
      return snapshot.completedQuestIds.has(requirement.questId)
        ? ready()
        : blocked(
          requirement,
          `Requires quest completion: ${requirement.questId}.`,
          `Complete ${requirement.questId}.`,
        );
    case 'QUEST_POINTS': {
      if (snapshot.questPoints >= requirement.points) return ready();
      const deficit = requirement.points - snapshot.questPoints;
      return blocked(
        requirement,
        `Requires ${requirement.points} Quest Points; current total is ${snapshot.questPoints}.`,
        `Earn ${deficit} more Quest ${deficit === 1 ? 'Point' : 'Points'}.`,
      );
    }
    case 'SKILL_LEVEL': {
      if (!Object.hasOwn(snapshot.levels, requirement.skill)) {
        return needsReview(
          requirement.id,
          `No canonical level evidence is available for ${requirement.skill}.`,
        );
      }
      const current = snapshot.levels[requirement.skill];
      return current >= requirement.level
        ? ready()
        : blocked(
          requirement,
          `Requires ${requirement.skill} ${requirement.level}; effective level is ${current}.`,
          `Raise ${requirement.skill} to ${requirement.level}.`,
        );
    }
    case 'TEMPORARY_BOOST': {
      if (!Object.hasOwn(snapshot.levels, requirement.skill)) {
        return needsReview(
          requirement.id,
          `No canonical level evidence is available for ${requirement.skill}.`,
        );
      }
      const current = snapshot.levels[requirement.skill];
      if (current >= requirement.targetLevel) return ready();
      if (current < requirement.baseLevel) {
        return blocked(
          requirement,
          `Requires base ${requirement.skill} ${requirement.baseLevel}; effective level is ${current}.`,
          `Raise ${requirement.skill} to ${requirement.baseLevel}.`,
        );
      }
      if (snapshot.availableBoostSourceIds === undefined) {
        const reason = `Confirm a reviewed boost source is available for ${requirement.skill} ${requirement.targetLevel}.`;
        return confirm(requirement, reason);
      }
      if (!requirement.boostSourceIds.some(sourceId => snapshot.availableBoostSourceIds!.has(sourceId))) {
        return blocked(
          requirement,
          `Requires a reviewed boost source for ${requirement.skill} ${requirement.targetLevel}.`,
          `Obtain one of: ${requirement.boostSourceIds.join(', ')}.`,
        );
      }
      if (requirement.timingPolicy === 'MANUAL_TIMING') {
        const reason = `Confirm the reviewed ${requirement.skill} boost to ${requirement.targetLevel} at the required timing.`;
        return confirm(requirement, reason);
      }
      return confirm(
        requirement,
        `Confirm the reviewed ${requirement.skill} boost to ${requirement.targetLevel} at the required timing.`,
      );
    }
    case 'COMBAT_LEVEL':
      return snapshot.combatLevel >= requirement.level
        ? ready()
        : blocked(
          requirement,
          `Requires combat level ${requirement.level}; current level is ${snapshot.combatLevel}.`,
          `Raise combat level to ${requirement.level}.`,
        );
    case 'REGION_ACCESS':
      return snapshot.regions.has(requirement.regionId)
        ? ready()
        : blocked(
          requirement,
          `Requires access to ${requirement.regionId}.`,
          `Unlock or reach ${requirement.regionId}.`,
        );
    case 'CHUNK_ACCESS':
      return snapshot.chunks.has(requirement.chunk)
        ? ready()
        : blocked(
          requirement,
          `Requires chunk ${requirement.chunk} on plane ${requirement.plane}.`,
          `Unlock chunk ${requirement.chunk}.`,
        );
    case 'TRANSPORT_ACCESS': {
      const advisories = oneWayAdvisories(requirement);
      if (!snapshot.chunks.has(requirement.origin)) {
        return blocked(
          requirement,
          `Requires access to transport origin ${requirement.origin}.`,
          `Unlock chunk ${requirement.origin}.`,
        );
      }
      if (!snapshot.transportIds.has(requirement.transportId)) {
        return blocked(
          requirement,
          `Requires transport ${requirement.transportId}.`,
          `Unlock transport ${requirement.transportId}.`,
        );
      }
      if (requirement.fare === undefined) return ready(advisories);
      if (snapshot.itemQuantities === undefined) {
        const reason = `Confirm ${requirement.fare.quantity} × ${requirement.fare.itemKey} is available for transport ${requirement.transportId}.`;
        return confirm(requirement, reason, `Confirm: ${reason}`, advisories);
      }
      const key = canonicalItemKey(requirement.fare.itemKey, snapshot.itemAliases);
      const current = snapshot.itemQuantities[key] ?? 0;
      return current >= requirement.fare.quantity
        ? ready(advisories)
        : blocked(
          requirement,
          `Requires ${requirement.fare.quantity} × ${requirement.fare.itemKey} for transport ${requirement.transportId}; confirmed ${current}.`,
          `Confirm or obtain ${requirement.fare.quantity} × ${requirement.fare.itemKey}.`,
        );
    }
    case 'INSTANCE_ACCESS':
      return requirement.entranceChunks.some(chunk => snapshot.chunks.has(chunk))
        ? ready()
        : blocked(
          requirement,
          `Requires a reachable entrance to ${requirement.instanceId}.`,
          `Unlock one reviewed entrance chunk: ${requirement.entranceChunks.join(', ')}.`,
        );
    case 'ITEM': {
      if (snapshot.itemQuantities === undefined) {
        const reason = `Confirm you have ${requirement.quantity} × ${requirement.itemKey}.`;
        return confirm(requirement, reason);
      }
      const key = canonicalItemKey(requirement.itemKey, snapshot.itemAliases);
      const current = snapshot.itemQuantities[key] ?? 0;
      return current >= requirement.quantity
        ? ready()
        : blocked(
          requirement,
          `Requires ${requirement.quantity} × ${requirement.itemKey}; confirmed ${current}.`,
          `Confirm or obtain ${requirement.quantity} × ${requirement.itemKey}.`,
        );
    }
    case 'CANONICAL_UNLOCK':
      return canonicalUnlockSet(requirement, snapshot).has(requirement.unlockId)
        ? ready()
        : blocked(
          requirement,
          `Requires ${requirement.unlockType} unlock ${requirement.unlockId}.`,
          `Unlock ${requirement.unlockId}.`,
        );
    case 'BRANCH_STATE': {
      const checkpointReady = requirement.checkpointId === undefined
        || snapshot.branchCheckpointIds.has(requirement.checkpointId);
      if (snapshot.selectedBranchId === requirement.branchId && checkpointReady) return ready();
      const checkpointSuffix = requirement.checkpointId === undefined
        ? ''
        : ` at checkpoint ${requirement.checkpointId}`;
      const checkpointInstruction = requirement.checkpointId === undefined
        ? ''
        : ` and reach checkpoint ${requirement.checkpointId}`;
      return blocked(
        requirement,
        `Requires route ${requirement.branchId}${checkpointSuffix}.`,
        `Select route ${requirement.branchId}${checkpointInstruction}.`,
      );
    }
    case 'MANUAL_CONFIRMATION':
      return snapshot.confirmedManualIds.has(requirement.confirmationId)
        ? ready()
        : result('CONFIRM', {
          manualConfirmationIds: [requirement.confirmationId],
          reasons: [requirement.prompt],
          unblockActions: [`Confirm: ${requirement.prompt}`],
        });
    case 'UNRESOLVED_EVIDENCE':
      return needsReview(requirement.evidenceId, requirement.reason);
  }
};

const mergeAll = (
  children: readonly RuneProofRequirementResult[],
): RuneProofRequirementResult => {
  const nonReady = children.filter(child => child.state !== 'READY');
  const state: RuneProofProofState = nonReady.some(child => child.state === 'NEEDS_REVIEW')
    ? 'NEEDS_REVIEW'
    : nonReady.some(child => child.state === 'BLOCKED')
      ? 'BLOCKED'
      : nonReady.some(child => child.state === 'CONFIRM')
        ? 'CONFIRM'
        : 'READY';
  return result(state, {
    blockerIds: stableUnique(nonReady.flatMap(child => child.blockerIds)),
    manualConfirmationIds: stableUnique(nonReady.flatMap(child => child.manualConfirmationIds)),
    unresolvedEvidenceIds: stableUnique(nonReady.flatMap(child => child.unresolvedEvidenceIds)),
    reasons: stableUnique(nonReady.flatMap(child => child.reasons)),
    unblockActions: stableUnique(nonReady.flatMap(child => child.unblockActions)),
    advisories: stableUnique(children.flatMap(child => child.advisories)),
  });
};

const selectAny = (
  children: readonly RuneProofRequirementResult[],
): RuneProofRequirementResult => {
  const readyChild = children.find(child => child.state === 'READY');
  if (readyChild !== undefined) return readyChild;
  const confirmChild = children.find(child => child.state === 'CONFIRM');
  if (confirmChild !== undefined) return confirmChild;
  if (children.every(child => child.state === 'BLOCKED')) return children[0];
  return children.find(child => child.state === 'NEEDS_REVIEW')!;
};

const evaluateValidatedExpression = (
  expression: RequirementExpression,
  snapshot: RuneProofRequirementSnapshot,
): RuneProofRequirementResult => {
  if (expression.kind === 'ALL') {
    return mergeAll(expression.requirements.map(child => (
      evaluateValidatedExpression(child, snapshot)
    )));
  }
  if (expression.kind === 'ANY') {
    return selectAny(expression.requirements.map(child => (
      evaluateValidatedExpression(child, snapshot)
    )));
  }
  return evaluateAtomicRequirement(expression, snapshot);
};

export const evaluateRequirementExpression = (
  expression: RequirementExpression,
  snapshot: RuneProofRequirementSnapshot,
): RuneProofRequirementResult => {
  if (snapshot.observedCanonicalCompletion) return result('COMPLETE');
  const validation = validateRequirementExpression(expression);
  if (!validation.valid) {
    return result('NEEDS_REVIEW', {
      unresolvedEvidenceIds: ['validation:requirement-expression'],
      reasons: validation.errors,
    });
  }
  return evaluateValidatedExpression(expression, snapshot);
};
