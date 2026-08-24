export type RuneProofPackLifecycle =
  | 'DRAFT'
  | 'PREVIEW_VALIDATED'
  | 'MILESTONE_APPROVED'
  | 'PUBLIC_APPROVED';

export interface RuneProofPackRelease {
  readonly questId: string;
  readonly packRevision: string;
  readonly catalogueRevision: string;
  readonly lifecycle: RuneProofPackLifecycle;
}

export interface RuneProofPackHeader {
  readonly questId: string;
  readonly packRevision: string;
  readonly catalogueRevision: string;
}

export interface RuneProofReleaseValidationContext {
  readonly target: 'PREVIEW' | 'PUBLIC';
  readonly catalogueRevision: string;
  readonly packRevisions: ReadonlyMap<string, string>;
}

export interface RuneProofPackReleaseSnapshot {
  readonly schemaVersion: 1;
  readonly catalogueRevision: string;
  readonly entries: readonly RuneProofPackRelease[];
}

const RELEASE_KEYS = [
  'questId',
  'packRevision',
  'catalogueRevision',
  'lifecycle',
] as const;
const SNAPSHOT_KEYS = ['schemaVersion', 'catalogueRevision', 'entries'] as const;
const LIFECYCLES = new Set<RuneProofPackLifecycle>([
  'DRAFT',
  'PREVIEW_VALIDATED',
  'MILESTONE_APPROVED',
  'PUBLIC_APPROVED',
]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(message);
};

const assertExactKeys = (
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void => {
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter(key => !expected.has(key));
  assert(unexpected.length === 0, `${label} has unexpected field(s): ${unexpected.join(', ')}`);
  const missing = keys.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  assert(missing.length === 0, `${label} is missing field(s): ${missing.join(', ')}`);
};

const assertDenseArray = (value: readonly unknown[], label: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    assert(Object.prototype.hasOwnProperty.call(value, index), `${label} must be a dense array`);
  }
};

const assertNonBlank: (
  value: unknown,
  label: string,
) => asserts value is string = (
  value: unknown,
  label: string,
): asserts value is string => {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} must be nonblank`);
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const validateRuneProofPackReleaseManifest = (
  value: unknown,
  context: RuneProofReleaseValidationContext,
): readonly RuneProofPackRelease[] => {
  assert(Array.isArray(value), 'RuneProof release manifest must be an array');
  assertDenseArray(value, 'RuneProof release manifest');
  assertNonBlank(context.catalogueRevision, 'RuneProof catalogue revision');

  const seenQuestIds = new Set<string>();
  const releases = value.map((entry, index): RuneProofPackRelease => {
    const label = `RuneProof release manifest[${index}]`;
    assert(isRecord(entry), `${label} must be an object`);
    assertExactKeys(entry, RELEASE_KEYS, label);
    assertNonBlank(entry.questId, `${label}.questId`);
    assertNonBlank(entry.packRevision, `${label}.packRevision`);
    assertNonBlank(entry.catalogueRevision, `${label}.catalogueRevision`);
    assert(typeof entry.lifecycle === 'string' && LIFECYCLES.has(
      entry.lifecycle as RuneProofPackLifecycle,
    ), `${label}.lifecycle is invalid`);
    const lifecycle = entry.lifecycle as RuneProofPackLifecycle;

    assert(!seenQuestIds.has(entry.questId),
      `RuneProof release manifest has duplicate quest ID: ${entry.questId}`);
    seenQuestIds.add(entry.questId);
    assert(entry.catalogueRevision === context.catalogueRevision,
      `${entry.questId} catalogue revision does not match the active catalogue revision`);

    const compiledRevision = context.packRevisions.get(entry.questId);
    assert(compiledRevision !== undefined,
      `${entry.questId} has no compiled pack in the ${context.target} catalogue`);
    assert(compiledRevision === entry.packRevision,
      `${entry.questId} release does not match compiled pack revision`);

    if (context.target === 'PUBLIC') {
      assert(lifecycle === 'PUBLIC_APPROVED',
        `PUBLIC requires PUBLIC_APPROVED for ${entry.questId}`);
    } else {
      assert(lifecycle !== 'DRAFT', `PREVIEW does not admit DRAFT for ${entry.questId}`);
    }

    return {
      questId: entry.questId,
      packRevision: entry.packRevision,
      catalogueRevision: entry.catalogueRevision,
      lifecycle,
    };
  });

  return deepFreeze(releases);
};

export const validateRuneProofPackReleaseSnapshot = (
  value: unknown,
  context: RuneProofReleaseValidationContext,
): RuneProofPackReleaseSnapshot => {
  assert(isRecord(value), 'RuneProof release snapshot must be an object');
  assertExactKeys(value, SNAPSHOT_KEYS, 'RuneProof release snapshot');
  assert(value.schemaVersion === 1, 'RuneProof release snapshot schemaVersion must be 1');
  assert(value.catalogueRevision === context.catalogueRevision,
    'RuneProof release snapshot catalogue revision does not match the active catalogue revision');
  const entries = validateRuneProofPackReleaseManifest(value.entries, context);
  return deepFreeze({
    schemaVersion: 1,
    catalogueRevision: context.catalogueRevision,
    entries,
  });
};
