import { RUNE_PROOF_CANONICAL_AREA_IDS } from '../../data/runeProofCanonicalAreas';
import type { RuneProofCatalogueEntry } from '../../data/runeProofQuestCatalogue';
import { canonicalItemKey } from '../questRoutes/model';
import { evaluateRuneProofItemLedger } from './itemLedger';
import {
  runeProofFindingId,
  type RequirementExpression,
  type ReviewedLocationReference,
  type RuneProofAction,
  type RuneProofAtomicRequirement,
  type RuneProofBranch,
  type RuneProofCompileFinding,
  type RuneProofCompileResult,
  type RuneProofFindingCode,
  type RuneProofInitialItemRequirement,
  type RuneProofItemEffect,
  type RuneProofProgressMigration,
  type RuneProofQuestPack,
} from './packModel';
import { validateRequirementExpression } from './requirements';

export interface RuneProofPackCompileContext {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly expectedCatalogueRevision: string;
}

type FindingIdentity = Pick<
  RuneProofCompileFinding,
  'scope' | 'questId' | 'branchId' | 'actionId'
>;

interface ManualDeclaration {
  readonly id: string;
  readonly kind: 'REQUIREMENT' | 'COMBAT' | 'ACTION_COMPLETION';
  readonly prompt: string;
  readonly evidenceIds: readonly string[];
  readonly branchId?: string;
}

interface Ownership {
  readonly global: boolean;
  readonly branches: ReadonlySet<string>;
}

interface DeclarationIndex {
  readonly branchIds: ReadonlySet<string>;
  readonly actionOwners: ReadonlyMap<string, string | undefined>;
  readonly checkpointOwners: ReadonlyMap<string, string>;
  readonly manualDeclarations: ReadonlyMap<string, ManualDeclaration>;
  readonly manualOwners: ReadonlyMap<string, Ownership>;
  readonly itemOwners: ReadonlyMap<string, Ownership>;
}

const PACK_KEYS = [
  'schemaVersion', 'questId', 'revision', 'catalogueRevision', 'sources', 'evidence',
  'initialItems', 'preflight', 'branches', 'sharedActions', 'completion', 'migrations',
] as const;
const SOURCE_KEYS = [
  'id', 'kind', 'uri', 'revision', 'revisionTimestamp', 'reviewedAt', 'author',
  'methodology',
] as const;
const EVIDENCE_KEYS = ['id', 'sourceId', 'sourceLocator', 'decision'] as const;
const INITIAL_ITEM_KEYS = [
  'item', 'quantity', 'supplyPolicy', 'alternatives', 'note', 'evidenceIds',
] as const;
const ITEM_REF_KEYS = ['key', 'name'] as const;
const BRANCH_KEYS = [
  'id', 'label', 'requirements', 'rank', 'actions', 'checkpointIds', 'evidenceIds',
] as const;
const RANK_KEYS = ['localRoutePenalty', 'newUnlockCount', 'riskCost', 'tieBreak'] as const;
const ACTION_KEYS = [
  'id', 'sourceOrder', 'instruction', 'kind', 'dependsOn', 'requirements', 'itemEffects',
  'location', 'completion', 'preferredMethod', 'alternatives', 'combat', 'evidenceIds',
] as const;
const METHOD_KEYS = ['id', 'label', 'kind', 'evidenceIds'] as const;
const ALTERNATIVE_KEYS = [
  'id', 'label', 'kind', 'evidenceIds', 'requirements', 'location',
] as const;
const COMBAT_KEYS = [
  'id', 'encounter', 'phases', 'mandatoryMechanics', 'equipmentCapabilities',
  'recommendedSupplies', 'deathAndEscape', 'reentry', 'confirmationId', 'evidenceIds',
] as const;
const COMPLETION_KEYS = ['canonicalQuestId', 'branchActionIds', 'evidenceIds'] as const;
const MIGRATION_KEYS = [
  'id', 'fromRevision', 'actionIds', 'itemKeys', 'branchIds', 'manualConfirmationIds',
  'checkpointIds',
] as const;
const CHUNK_KEY = /^(?:0|[1-9]\d*|-[1-9]\d*),(?:0|[1-9]\d*|-[1-9]\d*)$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const WALKTHROUGH_ACTION_KINDS = new Set([
  'TALK_TO', 'ACQUIRE', 'USE_ITEM', 'INTERACT_OBJECT', 'KILL', 'TRAVEL', 'DIALOGUE',
  'INFORMATION',
]);
const METHOD_KINDS = new Set(['DIRECT_SOURCE', 'TRANSFORMATION', 'QUEST_ROUTE']);
const SOURCE_KINDS = new Set([
  'QUEST_DATA', 'WIKI_REVISION', 'CHUNK_PICKER', 'INDEPENDENT_REVIEW',
]);
const CANONICAL_AREAS = new Set(RUNE_PROOF_CANONICAL_AREA_IDS);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isNonblank = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
);

const nonnegativeInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
);

const denseArray = (value: unknown): value is readonly unknown[] => {
  if (!Array.isArray(value)) return false;
  const numericKeys = Object.getOwnPropertyNames(value)
    .filter(key => /^(?:0|[1-9]\d*)$/.test(key));
  if (numericKeys.length !== value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
};

const exactKeyErrors = (
  value: unknown,
  allowed: readonly string[],
  required: readonly string[] = allowed,
): readonly string[] => {
  if (!isRecord(value)) return ['must be an object'];
  const allowedSet = new Set(allowed);
  const unexpected = Reflect.ownKeys(value)
    .filter(key => typeof key !== 'string'
      || !allowedSet.has(key)
      || Object.getOwnPropertyDescriptor(value, key)?.enumerable !== true)
    .map(key => typeof key === 'symbol' ? key.toString() : key)
    .sort();
  const missing = required.filter(key => !Object.prototype.hasOwnProperty.call(value, key));
  return [
    ...(unexpected.length === 0 ? [] : [`has unexpected field(s): ${unexpected.join(', ')}`]),
    ...(missing.length === 0 ? [] : [`is missing field(s): ${missing.join(', ')}`]),
  ];
};

const safeEvidenceIds = (value: unknown): readonly string[] => (
  denseArray(value) ? value.filter(isNonblank) : []
);

const stableText = (value: string): string => value.trim().replace(/\s+/g, ' ');

const validTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
    return false;
  }
  const canonicalInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(value).toISOString() === canonicalInput;
};

const stableUri = (value: unknown): URL | undefined => {
  if (!isNonblank(value)) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
};

const addFinding = (
  findings: RuneProofCompileFinding[],
  identity: FindingIdentity,
  code: RuneProofFindingCode,
  discriminator: string,
  message: string,
  evidenceIds: readonly string[] = [],
  severity: RuneProofCompileFinding['severity'] = 'BLOCKING',
): void => {
  const completeIdentity = { ...identity, code };
  findings.push({
    id: runeProofFindingId(completeIdentity, discriminator),
    severity,
    ...completeIdentity,
    message,
    evidenceIds: [...evidenceIds],
  });
};

const packIdentity = (questId: string): FindingIdentity => ({ scope: 'PACK', questId });

const branchIdentity = (questId: string, branchId: string): FindingIdentity => ({
  scope: 'BRANCH', questId, branchId,
});

const actionIdentity = (
  questId: string,
  branchId: string,
  actionId: string,
): FindingIdentity => ({ scope: 'ACTION', questId, branchId, actionId });

const sharedIdentity = (questId: string, actionId: string): FindingIdentity => ({
  scope: 'PACK', questId, actionId,
});

const compareText = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const compareActions = (left: RuneProofAction, right: RuneProofAction): number => {
  const leftOrder = positiveInteger(left.sourceOrder)
    ? left.sourceOrder : Number.POSITIVE_INFINITY;
  const rightOrder = positiveInteger(right.sourceOrder)
    ? right.sourceOrder : Number.POSITIVE_INFINITY;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  const leftId = isNonblank(left.id) ? left.id : String(left.id);
  const rightId = isNonblank(right.id) ? right.id : String(right.id);
  return compareText(leftId, rightId);
};

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const normalizedFindings = (
  findings: readonly RuneProofCompileFinding[],
  questId: string,
): readonly RuneProofCompileFinding[] => {
  const byId = new Map<string, RuneProofCompileFinding>();
  const collisions = new Set<string>();
  findings.forEach(finding => {
    const existing = byId.get(finding.id);
    if (existing === undefined) {
      byId.set(finding.id, finding);
      return;
    }
    collisions.add(finding.id);
  });
  collisions.forEach(id => {
    const identity = packIdentity(questId);
    const code = 'DUPLICATE_ID' as const;
    const finding: RuneProofCompileFinding = {
      id: runeProofFindingId({ ...identity, code }, `finding:${id}`),
      severity: 'BLOCKING',
      ...identity,
      code,
      message: `Compiler findings collided on stable ID "${id}".`,
      evidenceIds: [],
    };
    byId.set(finding.id, finding);
  });
  return [...byId.values()].sort((left, right) => compareText(left.id, right.id));
};

const freezeResult = (
  value: RuneProofCompileResult,
  questId: string,
): RuneProofCompileResult => {
  const findings = normalizedFindings(value.findings, questId);
  const introducedPackFailure = findings.some(
    finding => finding.severity === 'BLOCKING' && finding.scope === 'PACK',
  );
  const result: RuneProofCompileResult = {
    ...(value.pack === undefined || introducedPackFailure
      ? {}
      : { pack: { ...value.pack, findings } }),
    findings,
    rejectedBranchIds: [...value.rejectedBranchIds],
  };
  return deepFreeze(structuredClone(result));
};

const hasPackBlockingFinding = (findings: readonly RuneProofCompileFinding[]): boolean => (
  findings.some(finding => finding.severity === 'BLOCKING' && finding.scope === 'PACK')
);

const validatePackIdentityAndExactKeys = (
  definition: RuneProofQuestPack,
  context: RuneProofPackCompileContext,
  questId: string,
  findings: RuneProofCompileFinding[],
): boolean => {
  const identity = packIdentity(questId);
  const keyErrors = exactKeyErrors(definition, PACK_KEYS);
  if (keyErrors.length > 0) {
    addFinding(findings, identity, 'IDENTITY_MISMATCH', 'pack:keys',
      `Pack ${keyErrors.join('; ')}.`);
  }
  if (!isRecord(definition)) return false;
  if (definition.schemaVersion !== 1) {
    addFinding(findings, identity, 'IDENTITY_MISMATCH', 'schemaVersion',
      'Pack schemaVersion must be exactly 1.');
  }
  if (!isNonblank(definition.questId) || definition.questId !== context.catalogue.questId) {
    addFinding(findings, identity, 'IDENTITY_MISMATCH', 'questId',
      'Pack questId must exactly match its catalogue entry.');
  }
  if (!isNonblank(definition.revision)) {
    addFinding(findings, identity, 'IDENTITY_MISMATCH', 'revision',
      'Pack revision must be nonblank.');
  }
  if (!isNonblank(definition.catalogueRevision)
    || definition.catalogueRevision !== context.expectedCatalogueRevision) {
    addFinding(findings, identity, 'IDENTITY_MISMATCH', 'catalogueRevision',
      'Pack catalogueRevision must exactly match the expected catalogue revision.');
  }
  const arrays: readonly [string, unknown, boolean][] = [
    ['sources', definition.sources, true],
    ['evidence', definition.evidence, true],
    ['initialItems', definition.initialItems, false],
    ['branches', definition.branches, true],
    ['sharedActions', definition.sharedActions, false],
    ['migrations', definition.migrations, false],
  ];
  arrays.forEach(([field, value, nonempty]) => {
    if (!denseArray(value) || (nonempty && value.length === 0)) {
      addFinding(findings, identity, field === 'sources' || field === 'evidence'
        ? 'SOURCE_MISMATCH' : 'IDENTITY_MISMATCH', `pack:${field}`,
      `${field} must be ${nonempty ? 'a nonempty' : 'a'} dense array.`);
    }
  });
  if (!isRecord(definition.completion)) {
    addFinding(findings, identity, 'CONFLICTING_COMPLETION', 'completion',
      'Pack completion metadata must be an object.');
  }
  return keyErrors.length === 0
    && denseArray(definition.sources)
    && denseArray(definition.evidence)
    && denseArray(definition.initialItems)
    && denseArray(definition.branches)
    && denseArray(definition.sharedActions)
    && denseArray(definition.migrations)
    && isRecord(definition.completion);
};

const validateEvidenceList = (
  value: unknown,
  evidenceIds: ReadonlySet<string>,
  identity: FindingIdentity,
  discriminator: string,
  label: string,
  findings: RuneProofCompileFinding[],
): void => {
  const ids = safeEvidenceIds(value);
  if (!denseArray(value) || ids.length === 0 || ids.length !== value.length) {
    addFinding(findings, identity, 'SOURCE_MISMATCH', `${discriminator}:evidence`,
      `${label} must carry at least one nonblank evidence ID.`, ids);
    return;
  }
  const missing = [...new Set(ids.filter(id => !evidenceIds.has(id)))].sort(compareText);
  if (missing.length > 0) {
    addFinding(findings, identity, 'SOURCE_MISMATCH', `${discriminator}:evidence-resolution`,
      `${label} references unresolved evidence: ${missing.join(', ')}.`, ids);
  }
};

const validatePackSources = (
  definition: RuneProofQuestPack,
  context: RuneProofPackCompileContext,
  questId: string,
  findings: RuneProofCompileFinding[],
): ReadonlySet<string> => {
  const identity = packIdentity(questId);
  const sourceIds = new Set<string>();
  const validSourceIds = new Set<string>();
  for (const sourceValue of definition.sources) {
    const source = sourceValue as unknown;
    const sourceRecord = isRecord(source) ? source : undefined;
    const id = isNonblank(sourceRecord?.id) ? sourceRecord.id : 'blank-source-id';
    const errors = exactKeyErrors(source, SOURCE_KEYS,
      SOURCE_KEYS.filter(key => key !== 'author' && key !== 'methodology'));
    if (!sourceRecord || errors.length > 0
      || !isNonblank(sourceRecord.id)
      || !SOURCE_KINDS.has(sourceRecord.kind as string)
      || !isNonblank(sourceRecord.uri)
      || stableUri(sourceRecord.uri) === undefined
      || !isNonblank(sourceRecord.revision)
      || !validTimestamp(sourceRecord.revisionTimestamp)
      || !validTimestamp(sourceRecord.reviewedAt)
      || (validTimestamp(sourceRecord.revisionTimestamp)
        && validTimestamp(sourceRecord.reviewedAt)
        && Date.parse(sourceRecord.reviewedAt) < Date.parse(sourceRecord.revisionTimestamp))
      || (sourceRecord.kind === 'INDEPENDENT_REVIEW'
        && (!isNonblank(sourceRecord.author) || !isNonblank(sourceRecord.methodology)))) {
      addFinding(findings, identity, 'SOURCE_MISMATCH', `source:${id}`,
        `Reviewed source "${id}" is malformed${errors.length ? `: ${errors.join('; ')}` : ''}.`);
    }
    if (isNonblank(sourceRecord?.id)) {
      if (sourceIds.has(sourceRecord.id)) {
        addFinding(findings, identity, 'DUPLICATE_ID', `source:${sourceRecord.id}`,
          `Reviewed source ID "${sourceRecord.id}" is duplicated.`);
      }
      sourceIds.add(sourceRecord.id);
    }
    if (sourceRecord?.kind === 'WIKI_REVISION' && isNonblank(sourceRecord.uri)) {
      const parsed = stableUri(sourceRecord.uri);
      if (parsed?.protocol !== 'https:' || parsed.hostname !== 'oldschool.runescape.wiki') {
        addFinding(findings, identity, 'SOURCE_MISMATCH', `source:${id}:wiki-uri`,
          `Wiki source "${id}" must use an absolute oldschool.runescape.wiki HTTPS URL.`);
      } else if (!isNonblank(sourceRecord.revision)
        || parsed.searchParams.get('oldid') !== sourceRecord.revision) {
        addFinding(findings, identity, 'STALE_EVIDENCE', `source:${id}:wiki-revision`,
          `Wiki source "${id}" is not pinned to its declared revision.`);
      }
    }
    if (sourceRecord?.kind === 'QUEST_DATA') {
      if (sourceRecord.revision !== context.catalogue.sourceRevision
        || sourceRecord.revisionTimestamp !== context.catalogue.sourceRevisionTimestamp) {
        addFinding(findings, identity, 'STALE_EVIDENCE', `source:${id}:catalogue-revision`,
          `Quest-data source "${id}" does not match the catalogue source revision.`);
      }
    }
    if (isNonblank(sourceRecord?.id)) validSourceIds.add(sourceRecord.id);
  }

  const evidenceIds = new Set<string>();
  for (const evidenceValue of definition.evidence) {
    const evidence = evidenceValue as unknown;
    const record = isRecord(evidence) ? evidence : undefined;
    const id = isNonblank(record?.id) ? record.id : 'blank-evidence-id';
    const errors = exactKeyErrors(evidence, EVIDENCE_KEYS);
    if (!record || errors.length > 0 || !isNonblank(record.id)
      || !isNonblank(record.sourceId) || !isNonblank(record.sourceLocator)
      || !isNonblank(record.decision) || !validSourceIds.has(record.sourceId as string)) {
      addFinding(findings, identity, 'SOURCE_MISMATCH', `evidence:${id}`,
        `Reviewed evidence "${id}" is malformed or does not resolve to a source${errors.length ? `: ${errors.join('; ')}` : ''}.`);
    }
    if (isNonblank(record?.id)) {
      if (evidenceIds.has(record.id)) {
        addFinding(findings, identity, 'DUPLICATE_ID', `evidence:${record.id}`,
          `Reviewed evidence ID "${record.id}" is duplicated.`);
      }
      evidenceIds.add(record.id);
    }
  }
  return evidenceIds;
};

const addOwner = (
  mutable: Map<string, { global: boolean; branches: Set<string> }>,
  id: string,
  branchId: string | undefined,
): void => {
  const owner = mutable.get(id) ?? { global: false, branches: new Set<string>() };
  if (branchId === undefined) owner.global = true;
  else owner.branches.add(branchId);
  mutable.set(id, owner);
};

const validateInitialItems = (
  definition: RuneProofQuestPack,
  evidenceIds: ReadonlySet<string>,
  questId: string,
  findings: RuneProofCompileFinding[],
): readonly RuneProofInitialItemRequirement[] => {
  const identity = packIdentity(questId);
  const owners = new Map<string, string>();
  const normalized: RuneProofInitialItemRequirement[] = [];
  for (const itemValue of definition.initialItems) {
    const item = itemValue as unknown;
    const record = isRecord(item) ? item : undefined;
    const root = isRecord(record?.item) ? record.item : undefined;
    const rootKey = isNonblank(root?.key) ? root.key : 'blank-item-key';
    const errors = exactKeyErrors(item, INITIAL_ITEM_KEYS,
      INITIAL_ITEM_KEYS.filter(key => key !== 'alternatives' && key !== 'note'));
    const rootErrors = exactKeyErrors(root, ITEM_REF_KEYS);
    let invalid = !record || errors.length > 0 || !root || rootErrors.length > 0
      || !isNonblank(root.key) || !isNonblank(root.name)
      || (isNonblank(root.key) && isNonblank(root.name)
        && root.key !== canonicalItemKey(root.name))
      || !positiveInteger(record.quantity)
      || (record.supplyPolicy !== 'PLAYER_OBTAINED'
        && record.supplyPolicy !== 'QUEST_PROVIDED')
      || (record.note !== undefined && !isNonblank(record.note));
    validateEvidenceList(record?.evidenceIds, evidenceIds, identity,
      `initial:${rootKey}`, `Initial item "${rootKey}"`, findings);
    if (isNonblank(root?.key)) {
      if (owners.has(root.key)) {
        addFinding(findings, identity, 'INVALID_PROOF_REFERENCE', `item-family:${root.key}`,
          `Canonical initial item root "${root.key}" is duplicated.`);
      } else {
        owners.set(root.key, root.key);
      }
    }
    const alternatives: { key: string; name: string }[] = [];
    if (record?.alternatives !== undefined && !denseArray(record.alternatives)) invalid = true;
    if (denseArray(record?.alternatives)) {
      for (const alternativeValue of record.alternatives) {
        const alternative = isRecord(alternativeValue) ? alternativeValue : undefined;
        const alternativeKey = isNonblank(alternative?.key)
          ? alternative.key : 'blank-alternative-key';
        if (!alternative || exactKeyErrors(alternative, ITEM_REF_KEYS).length > 0
          || !isNonblank(alternative.key) || !isNonblank(alternative.name)
          || (isNonblank(alternative.key) && isNonblank(alternative.name)
            && alternative.key !== canonicalItemKey(alternative.name))) {
          invalid = true;
          continue;
        }
        if (alternative.key === rootKey) {
          if (alternative.name !== root?.name) invalid = true;
          continue;
        }
        const existingOwner = owners.get(alternative.key);
        if (existingOwner !== undefined && existingOwner !== rootKey) {
          addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
            `item-family:${alternative.key}`,
          `Item proof key "${alternative.key}" is owned by both "${existingOwner}" and "${rootKey}".`);
        } else {
          owners.set(alternative.key, rootKey);
        }
        if (!alternatives.some(candidate => candidate.key === alternative.key)) {
          alternatives.push({ key: alternative.key, name: alternative.name });
        }
      }
    }
    if (invalid) {
      addFinding(findings, identity, 'INVALID_PROOF_REFERENCE', `initial:${rootKey}:shape`,
        `Initial item "${rootKey}" is malformed${errors.length ? `: ${errors.join('; ')}` : ''}.`,
      safeEvidenceIds(record?.evidenceIds));
      continue;
    }
    normalized.push({
      item: { key: root!.key as string, name: root!.name as string },
      quantity: record!.quantity as number,
      supplyPolicy: record!.supplyPolicy as RuneProofInitialItemRequirement['supplyPolicy'],
      ...(alternatives.length === 0 ? {} : { alternatives }),
      ...(record!.note === undefined ? {} : { note: record!.note as string }),
      evidenceIds: safeEvidenceIds(record!.evidenceIds),
    });
  }
  return normalized;
};

const canonicalFamilyMap = (
  initialItems: readonly RuneProofInitialItemRequirement[],
): ReadonlyMap<string, string> => {
  const aliases = new Map<string, string>();
  initialItems.forEach(item => {
    aliases.set(item.item.key, item.item.key);
    item.alternatives?.forEach(alternative => aliases.set(alternative.key, item.item.key));
  });
  return aliases;
};

const initialQuantities = (
  initialItems: readonly RuneProofInitialItemRequirement[],
): Map<string, number> => {
  const quantities = new Map<string, number>();
  initialItems.forEach(item => {
    if (item.supplyPolicy === 'PLAYER_OBTAINED' && positiveInteger(item.quantity)) {
      quantities.set(item.item.key, (quantities.get(item.item.key) ?? 0) + item.quantity);
    }
  });
  return quantities;
};

const validateStringArray = (
  value: unknown,
  allowEmpty: boolean,
): boolean => denseArray(value)
  && (allowEmpty || value.length > 0)
  && value.every(isNonblank);

const validateLocation = (
  location: unknown,
  evidenceIds: ReadonlySet<string>,
  identity: FindingIdentity,
  discriminator: string,
  findings: RuneProofCompileFinding[],
): void => {
  const record = isRecord(location) ? location : undefined;
  const kind = record?.kind;
  const allowed = kind === 'SURFACE'
    ? ['kind', 'label', 'chunks', 'plane', 'evidenceIds']
    : kind === 'INSTANCE'
      ? ['kind', 'label', 'instanceId', 'entranceChunks', 'plane', 'evidenceIds']
      : [];
  const required = allowed;
  const chunks = kind === 'SURFACE' ? record?.chunks : record?.entranceChunks;
  const invalidChunks = !denseArray(chunks) || chunks.length === 0
    || !chunks.every(chunk => typeof chunk === 'string' && CHUNK_KEY.test(chunk))
    || new Set(chunks).size !== chunks.length;
  if (!record || allowed.length === 0 || exactKeyErrors(record, allowed, required).length > 0
    || !isNonblank(record.label) || invalidChunks
    || typeof record.plane !== 'number' || !Number.isFinite(record.plane)
    || !Number.isInteger(record.plane)
    || (kind === 'INSTANCE' && !isNonblank(record.instanceId))) {
    addFinding(findings, identity, 'INVALID_LOCATION', `${discriminator}:location`,
      `${discriminator} has an invalid reviewed location.`, safeEvidenceIds(record?.evidenceIds));
  }
  validateEvidenceList(record?.evidenceIds, evidenceIds, identity,
    `${discriminator}:location`, `${discriminator} location`, findings);
};

const atomicRequirements = (expression: unknown): readonly Record<string, unknown>[] => {
  if (!isRecord(expression)) return [];
  if (expression.kind === 'ALL' || expression.kind === 'ANY') {
    return denseArray(expression.requirements)
      ? expression.requirements.flatMap(atomicRequirements)
      : [];
  }
  return [expression];
};

const anyNodes = (expression: unknown): readonly Record<string, unknown>[] => {
  if (!isRecord(expression)) return [];
  if (expression.kind !== 'ALL' && expression.kind !== 'ANY') return [];
  const children = denseArray(expression.requirements) ? expression.requirements : [];
  return [
    ...(expression.kind === 'ANY' ? [expression] : []),
    ...children.flatMap(anyNodes),
  ];
};

const validateRequirementSemantics = (
  expression: unknown,
  available: ReadonlyMap<string, number>,
  aliases: ReadonlyMap<string, string>,
  evidenceIds: ReadonlySet<string>,
  declarationIndex: Pick<DeclarationIndex, 'branchIds' | 'checkpointOwners'>,
  identity: FindingIdentity,
  discriminator: string,
  findings: RuneProofCompileFinding[],
): void => {
  const validation = validateRequirementExpression(expression);
  if (!validation.valid) {
    addFinding(findings, identity, 'INVALID_REQUIREMENT_REFERENCE',
      `${discriminator}:shape`, `${discriminator} requirement is invalid: ${validation.errors.join('; ')}.`);
    if (validation.errors.some(error => error.includes('.evidenceIds'))) {
      addFinding(findings, identity, 'SOURCE_MISMATCH', `${discriminator}:evidence-shape`,
        `${discriminator} requirement evidence is malformed or empty.`);
    }
    return;
  }
  const atoms = atomicRequirements(expression);
  atoms.forEach(atom => {
    const atomId = isNonblank(atom.id) ? atom.id : `${discriminator}:blank-requirement-id`;
    validateEvidenceList(atom.evidenceIds, evidenceIds, identity, `requirement:${atomId}`,
      `Requirement "${atomId}"`, findings);
    if (atom.kind === 'UNRESOLVED_EVIDENCE') {
      addFinding(findings, identity, 'UNRESOLVED_REQUIREMENT', `requirement:${atomId}`,
        `Requirement "${atomId}" contains unresolved evidence.`, safeEvidenceIds(atom.evidenceIds));
    } else if (atom.kind === 'REGION_ACCESS' && (!isNonblank(atom.regionId)
      || !CANONICAL_AREAS.has(atom.regionId))) {
      addFinding(findings, identity, 'INVALID_REQUIREMENT_REFERENCE',
        `requirement:${atomId}:region`, `Requirement "${atomId}" references a noncanonical region.`,
      safeEvidenceIds(atom.evidenceIds));
    } else if (atom.kind === 'BRANCH_STATE') {
      const branchExists = isNonblank(atom.branchId)
        && declarationIndex.branchIds.has(atom.branchId);
      const checkpointOwner = atom.checkpointId === undefined
        ? undefined : declarationIndex.checkpointOwners.get(atom.checkpointId as string);
      if (!branchExists || (atom.checkpointId !== undefined && checkpointOwner !== atom.branchId)) {
        addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
          `requirement:${atomId}:branch-state`,
        `Requirement "${atomId}" does not resolve to an exact branch/checkpoint pair.`,
        safeEvidenceIds(atom.evidenceIds));
      }
    } else if (atom.kind === 'TEMPORARY_BOOST') {
      const sources = denseArray(atom.boostSourceIds) ? atom.boostSourceIds : [];
      const canonical = sources.every(source => isNonblank(source)
        && canonicalItemKey(source) === source);
      const unique = new Set(sources).size === sources.length;
      if (sources.length === 0 || !canonical || !unique) {
        addFinding(findings, identity, 'INVALID_REQUIREMENT_REFERENCE',
          `requirement:${atomId}:boost-sources`,
        `Requirement "${atomId}" needs unique canonical boost-source item IDs.`,
        safeEvidenceIds(atom.evidenceIds));
      } else if (!sources.some(source => {
        const canonicalKey = aliases.get(source as string) ?? source as string;
        return (available.get(canonicalKey) ?? 0) > 0;
      })) {
        addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
          `requirement:${atomId}:boost-supply`,
        `Requirement "${atomId}" has no reviewed boost source available at this gate.`,
        safeEvidenceIds(atom.evidenceIds));
      }
    }
    const itemRequirement = atom.kind === 'ITEM'
      ? atom
      : atom.kind === 'TRANSPORT_ACCESS' && isRecord(atom.fare)
        ? atom.fare
        : undefined;
    if (itemRequirement) {
      const { itemKey, quantity } = itemRequirement;
      if (isNonblank(itemKey) && positiveInteger(quantity)) {
        const canonicalKey = aliases.get(itemKey) ?? itemKey;
        if (canonicalItemKey(itemKey) !== itemKey
          || (available.get(canonicalKey) ?? 0) < quantity) {
          addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
            `requirement:${atomId}:item:${itemKey}`,
          `Requirement "${atomId}" needs ${String(quantity)} × ${itemKey}, which is not available at this gate.`,
          safeEvidenceIds(atom.evidenceIds));
        }
      }
    }
  });
  anyNodes(expression).forEach(any => {
    const descendants = denseArray(any.requirements)
      ? any.requirements.flatMap(atomicRequirements)
      : [];
    if (descendants.some(atom => atom.kind === 'MANUAL_CONFIRMATION')
      && !descendants.every(atom => atom.kind === 'MANUAL_CONFIRMATION')) {
      addFinding(findings, identity, 'INVALID_REQUIREMENT_REFERENCE',
        `${discriminator}:mixed-manual-any`,
      `${discriminator} mixes manual and deterministic descendants beneath ANY.`);
    }
  });
};

const completionErrors = (completion: unknown): readonly string[] => {
  if (!isRecord(completion) || !isNonblank(completion.kind)) return ['completion must be an object'];
  const keys = completion.kind === 'ACTION_CONFIRMED' ? ['kind']
    : completion.kind === 'MANUAL' ? ['kind', 'confirmationId']
      : completion.kind === 'ITEM_CONFIRMED' ? ['kind', 'itemKey']
        : completion.kind === 'BRANCH_CHECKPOINT' ? ['kind', 'checkpointId']
          : completion.kind === 'CANONICAL_QUEST_COMPLETED' ? ['kind', 'questId']
            : [];
  if (keys.length === 0) return ['completion kind is unknown'];
  const errors = [...exactKeyErrors(completion, keys)];
  if (completion.kind === 'MANUAL' && !isNonblank(completion.confirmationId)) {
    errors.push('confirmationId must be nonblank');
  }
  if (completion.kind === 'ITEM_CONFIRMED' && !isNonblank(completion.itemKey)) {
    errors.push('itemKey must be nonblank');
  }
  if (completion.kind === 'BRANCH_CHECKPOINT' && !isNonblank(completion.checkpointId)) {
    errors.push('checkpointId must be nonblank');
  }
  if (completion.kind === 'CANONICAL_QUEST_COMPLETED' && !isNonblank(completion.questId)) {
    errors.push('questId must be nonblank');
  }
  return errors;
};

const validateItemEffects = (
  effects: unknown,
  aliases: ReadonlyMap<string, string>,
  identity: FindingIdentity,
  discriminator: string,
  findings: RuneProofCompileFinding[],
): readonly RuneProofItemEffect[] => {
  if (!denseArray(effects)) {
    addFinding(findings, identity, 'BROKEN_ITEM_LEDGER', `${discriminator}:item-effects`,
      `${discriminator} itemEffects must be a dense array.`);
    return [];
  }
  const valid: RuneProofItemEffect[] = [];
  effects.forEach(effectValue => {
    const effect = isRecord(effectValue) ? effectValue : undefined;
    const itemKey = isNonblank(effect?.itemKey) ? effect.itemKey : 'blank-item-key';
    const kind = effect?.kind;
    const allowed = kind === 'PRODUCE' ? ['kind', 'itemKey', 'quantity', 'from']
      : kind === 'LEND' ? ['kind', 'itemKey', 'quantity', 'replacementItemKey']
        : ['kind', 'itemKey', 'quantity'];
    let invalid = !effect
      || !['ACQUIRE', 'PRODUCE', 'CONSUME', 'RETAIN', 'RETURN', 'LEND', 'REUSE',
        'QUEST_PROVIDED'].includes(kind as string)
      || exactKeyErrors(effect, allowed,
        kind === 'LEND' ? allowed.filter(key => key !== 'replacementItemKey') : allowed).length > 0
      || !isNonblank(effect.itemKey) || canonicalItemKey(effect.itemKey as string) !== effect.itemKey
      || !positiveInteger(effect.quantity);
    if (isNonblank(effect?.itemKey)) {
      const family = aliases.get(effect.itemKey);
      if (family !== undefined && family !== effect.itemKey) invalid = true;
    }
    if (kind === 'PRODUCE') {
      if (!denseArray(effect?.from)) invalid = true;
      else effect.from.forEach(inputValue => {
        const input = isRecord(inputValue) ? inputValue : undefined;
        if (!input || exactKeyErrors(input, ['itemKey', 'quantity']).length > 0
          || !isNonblank(input.itemKey) || canonicalItemKey(input.itemKey) !== input.itemKey
          || !positiveInteger(input.quantity)
          || (aliases.has(input.itemKey) && aliases.get(input.itemKey) !== input.itemKey)) {
          invalid = true;
        }
      });
    }
    if (kind === 'LEND' && effect?.replacementItemKey !== undefined
      && (!isNonblank(effect.replacementItemKey)
        || canonicalItemKey(effect.replacementItemKey) !== effect.replacementItemKey
        || (aliases.has(effect.replacementItemKey)
          && aliases.get(effect.replacementItemKey) !== effect.replacementItemKey))) {
      invalid = true;
    }
    if (invalid) {
      addFinding(findings, identity, 'BROKEN_ITEM_LEDGER',
        `${discriminator}:item-effect:${itemKey}`,
      `${discriminator} has a malformed or noncanonical item effect for "${itemKey}".`);
    } else {
      valid.push(effectValue as RuneProofItemEffect);
    }
  });
  return valid;
};

const applyOptimisticEffects = (
  opening: ReadonlyMap<string, number>,
  effects: readonly RuneProofItemEffect[],
  aliases: ReadonlyMap<string, string>,
): { readonly quantities: Map<string, number>; readonly issue?: string } => {
  const quantities = new Map(opening);
  const canonical = (key: string): string => aliases.get(key) ?? key;
  const add = (key: string, quantity: number): void => {
    const resolved = canonical(key);
    quantities.set(resolved, (quantities.get(resolved) ?? 0) + quantity);
  };
  const subtract = (key: string, quantity: number): boolean => {
    const resolved = canonical(key);
    const available = quantities.get(resolved) ?? 0;
    if (available < quantity) return false;
    if (available === quantity) quantities.delete(resolved);
    else quantities.set(resolved, available - quantity);
    return true;
  };
  for (const effect of effects) {
    if (!positiveInteger(effect.quantity)) return { quantities, issue: effect.itemKey };
    if (effect.kind === 'ACQUIRE' || effect.kind === 'QUEST_PROVIDED') {
      add(effect.itemKey, effect.quantity);
    } else if (effect.kind === 'CONSUME' || effect.kind === 'RETURN') {
      if (!subtract(effect.itemKey, effect.quantity)) return { quantities, issue: effect.itemKey };
    } else if (effect.kind === 'RETAIN' || effect.kind === 'REUSE') {
      if ((opening.get(canonical(effect.itemKey)) ?? 0) < effect.quantity) {
        return { quantities, issue: effect.itemKey };
      }
    } else if (effect.kind === 'LEND') {
      if (!subtract(effect.itemKey, effect.quantity)) return { quantities, issue: effect.itemKey };
      if (effect.replacementItemKey) add(effect.replacementItemKey, effect.quantity);
    } else {
      for (const input of effect.from) {
        if (!subtract(input.itemKey, input.quantity)) {
          return { quantities, issue: input.itemKey };
        }
      }
      add(effect.itemKey, effect.quantity);
    }
  }
  return { quantities };
};

const validateMethod = (
  method: unknown,
  alternative: boolean,
  available: ReadonlyMap<string, number>,
  aliases: ReadonlyMap<string, string>,
  evidenceIds: ReadonlySet<string>,
  declarationIndex: DeclarationIndex,
  identity: FindingIdentity,
  actionId: string,
  findings: RuneProofCompileFinding[],
): string | undefined => {
  const record = isRecord(method) ? method : undefined;
  const id = isNonblank(record?.id) ? record.id : 'blank-method-id';
  const keys = alternative ? ALTERNATIVE_KEYS : METHOD_KEYS;
  const required = alternative
    ? ALTERNATIVE_KEYS.filter(key => key !== 'location') : METHOD_KEYS;
  if (!record || exactKeyErrors(record, keys, required).length > 0
    || !isNonblank(record.id) || !isNonblank(record.label)
    || !METHOD_KINDS.has(record.kind as string)) {
    addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
      `action:${actionId}:method:${id}:shape`, `Action "${actionId}" has a malformed method "${id}".`,
    safeEvidenceIds(record?.evidenceIds));
  }
  validateEvidenceList(record?.evidenceIds, evidenceIds, identity,
    `action:${actionId}:method:${id}`, `Method "${id}"`, findings);
  if (alternative && record) {
    validateRequirementSemantics(record.requirements, available, aliases, evidenceIds,
      declarationIndex, identity, `alternative:${id}`, findings);
    if (record.location !== undefined) {
      validateLocation(record.location, evidenceIds, identity,
        `alternative:${id}`, findings);
    }
  }
  return isNonblank(record?.id) ? record.id : undefined;
};

const validateCombat = (
  combat: unknown,
  evidenceIds: ReadonlySet<string>,
  identity: FindingIdentity,
  actionId: string,
  findings: RuneProofCompileFinding[],
): void => {
  const record = isRecord(combat) ? combat : undefined;
  const id = isNonblank(record?.id) ? record.id : 'blank-combat-id';
  const missingConfirmation = !isNonblank(record?.confirmationId)
    || !denseArray(record?.evidenceIds) || record.evidenceIds.length === 0;
  const malformed = !record || exactKeyErrors(record, COMBAT_KEYS).length > 0
    || !isNonblank(record.id) || !isNonblank(record.encounter)
    || !validateStringArray(record.phases, true)
    || !validateStringArray(record.mandatoryMechanics, false)
    || !validateStringArray(record.equipmentCapabilities, true)
    || !validateStringArray(record.recommendedSupplies, true)
    || !isNonblank(record.deathAndEscape) || !isNonblank(record.reentry);
  if (missingConfirmation || malformed) {
    addFinding(findings, identity, 'MISSING_COMBAT_CONFIRMATION',
      `action:${actionId}:combat:${id}`,
    `Combat guidance "${id}" needs complete reviewed copy and explicit manual confirmation.`,
    safeEvidenceIds(record?.evidenceIds));
  }
  validateEvidenceList(record?.evidenceIds, evidenceIds, identity,
    `action:${actionId}:combat:${id}`, `Combat guidance "${id}"`, findings);
};

const validateActionRecord = (
  actionValue: unknown,
  branchId: string | undefined,
  available: ReadonlyMap<string, number>,
  aliases: ReadonlyMap<string, string>,
  evidenceIds: ReadonlySet<string>,
  declarationIndex: DeclarationIndex,
  routeProofKeys: ReadonlySet<string>,
  questId: string,
  findings: RuneProofCompileFinding[],
): { readonly action?: RuneProofAction; readonly effects: readonly RuneProofItemEffect[] } => {
  const action = isRecord(actionValue) ? actionValue : undefined;
  const actionId = isNonblank(action?.id) ? action.id : 'blank-action-id';
  const identity = branchId === undefined
    ? sharedIdentity(questId, actionId)
    : actionIdentity(questId, branchId, actionId);
  const errors = exactKeyErrors(action, ACTION_KEYS,
    ACTION_KEYS.filter(key => key !== 'preferredMethod' && key !== 'combat'));
  if (!action || errors.length > 0 || !isNonblank(action.id)
    || !positiveInteger(action.sourceOrder) || !isNonblank(action.instruction)
    || !WALKTHROUGH_ACTION_KINDS.has(action.kind as string)
    || !denseArray(action.dependsOn) || !action.dependsOn.every(isNonblank)
    || !denseArray(action.alternatives)) {
    addFinding(findings, identity,
      !positiveInteger(action?.sourceOrder) ? 'INVALID_ORDER' : 'INVALID_PROOF_REFERENCE',
      `action:${actionId}:shape`, `Action "${actionId}" is malformed${errors.length ? `: ${errors.join('; ')}` : ''}.`,
    safeEvidenceIds(action?.evidenceIds));
  }
  validateEvidenceList(action?.evidenceIds, evidenceIds, identity,
    `action:${actionId}`, `Action "${actionId}"`, findings);
  validateLocation(action?.location, evidenceIds, identity, `action:${actionId}`, findings);
  validateRequirementSemantics(action?.requirements, available, aliases, evidenceIds,
    declarationIndex, identity, `action:${actionId}`, findings);
  const effects = validateItemEffects(action?.itemEffects, aliases, identity,
    `action:${actionId}`, findings);

  const methodIds: string[] = [];
  if (action?.preferredMethod !== undefined) {
    const id = validateMethod(action.preferredMethod, false, available, aliases, evidenceIds,
      declarationIndex, identity, actionId, findings);
    if (id) methodIds.push(id);
  }
  if (denseArray(action?.alternatives)) {
    action.alternatives.forEach(alternative => {
      const id = validateMethod(alternative, true, available, aliases, evidenceIds,
        declarationIndex, identity, actionId, findings);
      if (id) methodIds.push(id);
    });
  }
  const duplicateMethods = [...new Set(methodIds.filter(
    (id, index) => methodIds.indexOf(id) !== index,
  ))].sort(compareText);
  duplicateMethods.forEach(id => addFinding(findings, identity, 'DUPLICATE_ID',
    `action:${actionId}:method:${id}`,
  `Action "${actionId}" repeats method ID "${id}".`));

  if (action?.combat !== undefined) {
    validateCombat(action.combat, evidenceIds, identity, actionId, findings);
  }
  const completion = action?.completion;
  const completionShape = completionErrors(completion);
  if (completionShape.length > 0) {
    addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
      `action:${actionId}:completion`,
    `Action "${actionId}" has invalid completion metadata: ${completionShape.join('; ')}.`);
  } else if (isRecord(completion)) {
    if (completion.kind === 'BRANCH_CHECKPOINT') {
      const owner = declarationIndex.checkpointOwners.get(completion.checkpointId as string);
      if (branchId === undefined || owner !== branchId) {
        addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
          `action:${actionId}:checkpoint:${String(completion.checkpointId)}`,
        `Action "${actionId}" does not target a checkpoint owned by its branch.`);
      }
    } else if (completion.kind === 'ITEM_CONFIRMED') {
      const key = completion.itemKey as string;
      if (!routeProofKeys.has(key)) {
        addFinding(findings, identity, 'INVALID_PROOF_REFERENCE',
          `action:${actionId}:item:${key}`,
        `Action "${actionId}" completion item "${key}" does not resolve to route proof.`);
      }
    } else if (completion.kind === 'CANONICAL_QUEST_COMPLETED'
      && completion.questId !== questId) {
      addFinding(findings, identity, 'CONFLICTING_COMPLETION',
        `action:${actionId}:quest:${String(completion.questId)}`,
      `Action "${actionId}" completes a different canonical quest.`);
    }
  }
  return {
    action: actionValue as RuneProofAction,
    effects,
  };
};

const collectManualAtoms = (
  expression: unknown,
  branchId: string | undefined,
): readonly ManualDeclaration[] => {
  if (!validateRequirementExpression(expression).valid) return [];
  return atomicRequirements(expression)
    .filter(atom => atom.kind === 'MANUAL_CONFIRMATION'
      && isNonblank(atom.confirmationId) && isNonblank(atom.prompt))
    .map(atom => ({
      id: atom.confirmationId as string,
      kind: 'REQUIREMENT' as const,
      prompt: stableText(atom.prompt as string),
      evidenceIds: [...safeEvidenceIds(atom.evidenceIds)].sort(compareText),
      branchId,
    }));
};

const collectManualDeclarations = (
  definition: RuneProofQuestPack,
  questId: string,
  findings: RuneProofCompileFinding[],
): Readonly<{
  declarations: ReadonlyMap<string, ManualDeclaration>;
  owners: ReadonlyMap<string, Ownership>;
}> => {
  const declarations: ManualDeclaration[] = [
    ...collectManualAtoms(definition.preflight, undefined),
  ];
  const collectAction = (actionValue: unknown, branchId: string | undefined): void => {
    if (!isRecord(actionValue)) return;
    declarations.push(...collectManualAtoms(actionValue.requirements, branchId));
    if (denseArray(actionValue.alternatives)) {
      actionValue.alternatives.forEach(alternative => {
        if (isRecord(alternative)) {
          declarations.push(...collectManualAtoms(alternative.requirements, branchId));
        }
      });
    }
    if (isRecord(actionValue.combat) && isNonblank(actionValue.combat.confirmationId)) {
      declarations.push({
        id: actionValue.combat.confirmationId,
        kind: 'COMBAT',
        prompt: 'Acknowledge the reviewed combat guidance.',
        evidenceIds: [...safeEvidenceIds(actionValue.combat.evidenceIds)].sort(compareText),
        branchId,
      });
    }
    if (isRecord(actionValue.completion) && actionValue.completion.kind === 'MANUAL'
      && isNonblank(actionValue.completion.confirmationId)
      && isNonblank(actionValue.instruction)) {
      declarations.push({
        id: actionValue.completion.confirmationId,
        kind: 'ACTION_COMPLETION',
        prompt: stableText(actionValue.instruction),
        evidenceIds: [...safeEvidenceIds(actionValue.evidenceIds)].sort(compareText),
        branchId,
      });
    }
  };
  definition.sharedActions.forEach(action => collectAction(action, undefined));
  definition.branches.forEach(branchValue => {
    if (!isRecord(branchValue)) return;
    const branchId = isNonblank(branchValue.id) ? branchValue.id : undefined;
    declarations.push(...collectManualAtoms(branchValue.requirements, branchId));
    if (denseArray(branchValue.actions)) {
      branchValue.actions.forEach(action => collectAction(action, branchId));
    }
  });
  const byId = new Map<string, ManualDeclaration>();
  const mutableOwners = new Map<string, { global: boolean; branches: Set<string> }>();
  declarations.forEach(declaration => {
    addOwner(mutableOwners, declaration.id, declaration.branchId);
    const existing = byId.get(declaration.id);
    if (existing === undefined) {
      byId.set(declaration.id, declaration);
      return;
    }
    const same = existing.kind === declaration.kind
      && existing.prompt === declaration.prompt
      && JSON.stringify(existing.evidenceIds) === JSON.stringify(declaration.evidenceIds);
    if (!same) {
      addFinding(findings, packIdentity(questId), 'DUPLICATE_ID',
        `manual:${declaration.id}`,
      `Manual confirmation ID "${declaration.id}" has conflicting declaration semantics.`);
    }
  });
  const owners = new Map<string, Ownership>();
  mutableOwners.forEach((ownership, id) => owners.set(id, {
    global: ownership.global,
    branches: ownership.branches,
  }));
  return { declarations: byId, owners };
};

const buildDeclarations = (
  definition: RuneProofQuestPack,
  initialItems: readonly RuneProofInitialItemRequirement[],
  questId: string,
  findings: RuneProofCompileFinding[],
): DeclarationIndex => {
  const actionOwners = new Map<string, string | undefined>();
  const checkpointOwners = new Map<string, string>();
  const itemOwners = new Map<string, { global: boolean; branches: Set<string> }>();
  initialItems.forEach(item => {
    addOwner(itemOwners, item.item.key, undefined);
    item.alternatives?.forEach(alternative => addOwner(itemOwners, alternative.key, undefined));
  });
  const branchIds = new Set<string>();
  definition.branches.forEach(branchValue => {
    if (!isRecord(branchValue) || !isNonblank(branchValue.id)) return;
    if (branchIds.has(branchValue.id)) {
      addFinding(findings, packIdentity(questId), 'DUPLICATE_ID',
        `branch:${branchValue.id}`, `Branch ID "${branchValue.id}" is duplicated.`);
    }
    branchIds.add(branchValue.id);
  });
  const addAction = (actionValue: unknown, branchId: string | undefined): void => {
    if (!isRecord(actionValue) || !isNonblank(actionValue.id)) return;
    if (actionOwners.has(actionValue.id)) {
      addFinding(findings, packIdentity(questId), 'DUPLICATE_ID',
        `action:${actionValue.id}`, `Action ID "${actionValue.id}" is duplicated.`);
    } else {
      actionOwners.set(actionValue.id, branchId);
    }
    if (denseArray(actionValue.itemEffects)) {
      actionValue.itemEffects.forEach(effectValue => {
        if (!isRecord(effectValue)) return;
        if (isNonblank(effectValue.itemKey)) addOwner(itemOwners, effectValue.itemKey, branchId);
        if (effectValue.kind === 'PRODUCE' && denseArray(effectValue.from)) {
          effectValue.from.forEach(input => {
            if (isRecord(input) && isNonblank(input.itemKey)) {
              addOwner(itemOwners, input.itemKey, branchId);
            }
          });
        }
        if (effectValue.kind === 'LEND' && isNonblank(effectValue.replacementItemKey)) {
          addOwner(itemOwners, effectValue.replacementItemKey, branchId);
        }
      });
    }
  };
  definition.sharedActions.forEach(action => addAction(action, undefined));
  definition.branches.forEach(branchValue => {
    if (!isRecord(branchValue)) return;
    const branchId = isNonblank(branchValue.id) ? branchValue.id : 'blank-branch-id';
    if (denseArray(branchValue.checkpointIds)) {
      branchValue.checkpointIds.forEach(checkpointId => {
        if (!isNonblank(checkpointId)) return;
        if (checkpointOwners.has(checkpointId)) {
          addFinding(findings, packIdentity(questId), 'DUPLICATE_ID',
            `checkpoint:${checkpointId}`, `Checkpoint ID "${checkpointId}" is duplicated.`);
        } else {
          checkpointOwners.set(checkpointId, branchId);
        }
      });
    }
    if (denseArray(branchValue.actions)) {
      branchValue.actions.forEach(action => addAction(action, branchId));
    }
  });
  const manual = collectManualDeclarations(definition, questId, findings);
  const immutableOwners = new Map<string, Ownership>();
  itemOwners.forEach((ownership, id) => immutableOwners.set(id, {
    global: ownership.global,
    branches: ownership.branches,
  }));
  return {
    branchIds,
    actionOwners,
    checkpointOwners,
    manualDeclarations: manual.declarations,
    manualOwners: manual.owners,
    itemOwners: immutableOwners,
  };
};

const validateCompletionMetadata = (
  definition: RuneProofQuestPack,
  evidenceIds: ReadonlySet<string>,
  questId: string,
  findings: RuneProofCompileFinding[],
): void => {
  const completion = definition.completion as unknown;
  const identity = packIdentity(questId);
  const errors = exactKeyErrors(completion, COMPLETION_KEYS);
  if (!isRecord(completion) || errors.length > 0) {
    addFinding(findings, identity, 'CONFLICTING_COMPLETION', 'completion:shape',
      `Completion metadata is malformed${errors.length ? `: ${errors.join('; ')}` : ''}.`);
    return;
  }
  if (completion.canonicalQuestId !== questId) {
    addFinding(findings, identity, 'CONFLICTING_COMPLETION', 'completion:questId',
      'Completion canonicalQuestId must equal the pack questId.');
  }
  validateEvidenceList(completion.evidenceIds, evidenceIds, identity,
    'completion', 'Completion metadata', findings);
  if (!isRecord(completion.branchActionIds)) {
    addFinding(findings, identity, 'CONFLICTING_COMPLETION', 'completion:branchActionIds',
      'Completion branchActionIds must be an object.');
    return;
  }
  const uniqueBranchIds = definition.branches
    .map(branch => isRecord(branch) && isNonblank(branch.id) ? branch.id : undefined)
    .filter((id): id is string => id !== undefined);
  const keys = Object.keys(completion.branchActionIds).sort(compareText);
  const expected = [...new Set(uniqueBranchIds)].sort(compareText);
  const expectedSet = new Set(expected);
  const unidentifiableBranchCount = definition.branches.length - uniqueBranchIds.length;
  const unmatchedKeyCount = keys.filter(key => !expectedSet.has(key)).length;
  if (keys.length !== definition.branches.length
    || expected.some(branchId => !keys.includes(branchId))
    || unmatchedKeyCount !== unidentifiableBranchCount) {
    addFinding(findings, identity, 'CONFLICTING_COMPLETION', 'completion:branch-keys',
      'Completion must contain exactly one action mapping per original branch.');
  }
  Object.entries(completion.branchActionIds).forEach(([branchId, actionId]) => {
    if (!isNonblank(branchId) || !isNonblank(actionId)) {
      addFinding(findings, identity, 'CONFLICTING_COMPLETION',
        `completion:branch:${branchId || 'blank'}`,
      'Completion branch/action IDs must be nonblank.');
    }
  });
};

const validateMigrationShape = (
  definition: RuneProofQuestPack,
  questId: string,
  findings: RuneProofCompileFinding[],
): void => {
  const ids = new Set<string>();
  const revisions = new Set<string>();
  definition.migrations.forEach(migrationValue => {
    const migration = isRecord(migrationValue) ? migrationValue : undefined;
    const id = isNonblank(migration?.id) ? migration.id : 'blank-migration-id';
    const errors = exactKeyErrors(migration, MIGRATION_KEYS);
    let invalid = !migration || errors.length > 0 || !isNonblank(migration.id)
      || !isNonblank(migration.fromRevision)
      || migration.fromRevision === definition.revision;
    if (isNonblank(migration?.id)) {
      if (ids.has(migration.id)) invalid = true;
      ids.add(migration.id);
    }
    if (isNonblank(migration?.fromRevision)) {
      if (revisions.has(migration.fromRevision)) invalid = true;
      revisions.add(migration.fromRevision);
    }
    for (const field of [
      'actionIds', 'itemKeys', 'branchIds', 'manualConfirmationIds', 'checkpointIds',
    ] as const) {
      const mapping = migration?.[field];
      if (!isRecord(mapping)) {
        invalid = true;
        continue;
      }
      Object.entries(mapping).forEach(([source, destination]) => {
        if (!isNonblank(source) || !isNonblank(destination) || source === destination) invalid = true;
        if (field === 'itemKeys'
          && (canonicalItemKey(source) !== source || canonicalItemKey(destination) !== destination)) {
          invalid = true;
        }
      });
    }
    if (invalid) {
      addFinding(findings, packIdentity(questId), 'INVALID_MIGRATION',
        `migration:${id}`, `Migration "${id}" has invalid identity or map shape.`);
    }
  });
};

const routeProofKeys = (
  initialItems: readonly RuneProofInitialItemRequirement[],
  actions: readonly RuneProofAction[],
): ReadonlySet<string> => {
  const keys = new Set<string>();
  initialItems.forEach(item => {
    keys.add(item.item.key);
    item.alternatives?.forEach(alternative => keys.add(alternative.key));
  });
  actions.forEach(action => {
    const effects = isRecord(action) && denseArray(action.itemEffects)
      ? action.itemEffects : [];
    effects.forEach(effectValue => {
      if (!isRecord(effectValue)) return;
      if (isNonblank(effectValue.itemKey)) keys.add(effectValue.itemKey);
      if (effectValue.kind === 'PRODUCE' && denseArray(effectValue.from)) {
        effectValue.from.forEach(input => {
          if (isRecord(input) && isNonblank(input.itemKey)) keys.add(input.itemKey);
        });
      }
      if (effectValue.kind === 'LEND' && isNonblank(effectValue.replacementItemKey)) {
        keys.add(effectValue.replacementItemKey);
      }
    });
  });
  return keys;
};

const validateSharedGraph = (
  sharedActions: readonly RuneProofAction[],
  questId: string,
  findings: RuneProofCompileFinding[],
): void => {
  const byId = new Map(sharedActions
    .filter(action => isNonblank(action.id))
    .map(action => [action.id, action]));
  const sourceOrders = new Map<number, string[]>();
  sharedActions.forEach(action => {
    if (!positiveInteger(action.sourceOrder)) return;
    const ids = sourceOrders.get(action.sourceOrder) ?? [];
    ids.push(action.id);
    sourceOrders.set(action.sourceOrder, ids);
  });
  sourceOrders.forEach((ids, order) => {
    if (ids.length > 1) {
      addFinding(findings, packIdentity(questId), 'INVALID_ORDER',
        `shared:sourceOrder:${String(order)}`,
      `Shared actions repeat sourceOrder ${String(order)} for ${ids.sort(compareText).join(', ')}.`);
    }
  });
  sharedActions.forEach(action => {
    if (!denseArray(action.dependsOn)) return;
    action.dependsOn.forEach(dependencyId => {
      const dependency = byId.get(dependencyId);
      if (dependency && positiveInteger(action.sourceOrder)
        && positiveInteger(dependency.sourceOrder)
        && dependency.sourceOrder >= action.sourceOrder) {
        addFinding(findings, sharedIdentity(questId, action.id), 'INVALID_ORDER',
          `action:${action.id}:forward:${dependencyId}`,
        `Shared action "${action.id}" depends on non-earlier action "${dependencyId}".`);
      }
    });
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycle: string[] | undefined;
  const visit = (actionId: string, path: readonly string[]): void => {
    if (cycle || visited.has(actionId)) return;
    if (visiting.has(actionId)) {
      const start = path.indexOf(actionId);
      cycle = [...path.slice(start), actionId];
      return;
    }
    visiting.add(actionId);
    const action = byId.get(actionId);
    if (action && denseArray(action.dependsOn)) {
      action.dependsOn.filter(id => byId.has(id)).forEach(id => visit(id, [...path, actionId]));
    }
    visiting.delete(actionId);
    visited.add(actionId);
  };
  [...byId.keys()].sort(compareText).forEach(id => visit(id, []));
  if (cycle) {
    const cycleIds = [...new Set(cycle)].sort(compareText);
    addFinding(findings, packIdentity(questId), 'DEPENDENCY_CYCLE',
      `shared:cycle:${cycleIds.join('|')}`,
    `Shared actions contain a dependency cycle involving ${cycleIds.join(', ')}.`);
  }
};

const validateSharedActions = (
  definition: RuneProofQuestPack,
  initialItems: readonly RuneProofInitialItemRequirement[],
  aliases: ReadonlyMap<string, string>,
  evidenceIds: ReadonlySet<string>,
  declarations: DeclarationIndex,
  questId: string,
  findings: RuneProofCompileFinding[],
): void => {
  definition.sharedActions.forEach(action => {
    if (!isRecord(action)) {
      validateActionRecord(action, undefined, initialQuantities(initialItems), aliases,
        evidenceIds, declarations, routeProofKeys(initialItems, []), questId, findings);
    }
  });
  const sharedActions = definition.sharedActions.filter(
    (action): action is RuneProofAction => isRecord(action),
  );
  const proofKeys = routeProofKeys(initialItems, sharedActions);
  let quantities = initialQuantities(initialItems);
  const sorted = [...sharedActions].sort(compareActions);
  sorted.forEach(action => {
    const validated = validateActionRecord(action, undefined, quantities, aliases, evidenceIds,
      declarations, proofKeys, questId, findings);
    const applied = applyOptimisticEffects(quantities, validated.effects, aliases);
    if (applied.issue) {
      addFinding(findings, sharedIdentity(questId, action.id), 'BROKEN_ITEM_LEDGER',
        `action:${action.id}:item:${applied.issue}`,
      `Shared action "${action.id}" cannot apply reviewed item effect "${applied.issue}".`);
    } else {
      quantities = applied.quantities;
    }
  });
  const sharedIds = new Set(sharedActions.map(action => action.id));
  sharedActions.forEach(action => {
    if (!denseArray(action.dependsOn)) return;
    action.dependsOn.forEach(dependencyId => {
      if (!sharedIds.has(dependencyId)) {
        addFinding(findings, sharedIdentity(questId, action.id), 'DANGLING_DEPENDENCY',
          `action:${action.id}:dependency:${dependencyId}`,
        `Shared action "${action.id}" depends on a missing or branch-local action "${dependencyId}".`);
      }
    });
  });
  validateSharedGraph(sharedActions, questId, findings);
};

const validateBranchGraph = (
  branch: RuneProofBranch,
  route: readonly RuneProofAction[],
  declarations: DeclarationIndex,
  questId: string,
  findings: RuneProofCompileFinding[],
): void => {
  const identity = branchIdentity(questId, branch.id);
  const byId = new Map(route.map(action => [action.id, action]));
  const sourceOrders = new Map<number, string[]>();
  route.forEach(action => {
    if (!positiveInteger(action.sourceOrder)) {
      addFinding(findings, actionIdentity(questId, branch.id, action.id), 'INVALID_ORDER',
        `action:${action.id}:sourceOrder`,
      `Action "${action.id}" sourceOrder must be a finite positive integer.`);
      return;
    }
    const ids = sourceOrders.get(action.sourceOrder) ?? [];
    ids.push(action.id);
    sourceOrders.set(action.sourceOrder, ids);
  });
  sourceOrders.forEach((ids, order) => {
    if (ids.length > 1) {
      addFinding(findings, identity, 'INVALID_ORDER', `sourceOrder:${String(order)}`,
        `Merged route repeats sourceOrder ${String(order)} for ${ids.sort(compareText).join(', ')}.`);
    }
  });
  route.forEach(action => {
    if (!denseArray(action.dependsOn)) return;
    const repeated = [...new Set(action.dependsOn.filter(
      (id, index) => action.dependsOn.indexOf(id) !== index,
    ))].sort(compareText);
    repeated.forEach(dependencyId => addFinding(findings,
      actionIdentity(questId, branch.id, action.id), 'DUPLICATE_ID',
      `action:${action.id}:dependency:${dependencyId}`,
      `Action "${action.id}" repeats dependency "${dependencyId}".`));
    action.dependsOn.forEach(dependencyId => {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        const owner = declarations.actionOwners.get(dependencyId);
        addFinding(findings, actionIdentity(questId, branch.id, action.id),
          'DANGLING_DEPENDENCY', `action:${action.id}:dependency:${dependencyId}`,
        owner === undefined
          ? `Action "${action.id}" has dangling dependency "${dependencyId}".`
          : `Action "${action.id}" depends on action "${dependencyId}" from another branch.`);
      } else if (positiveInteger(action.sourceOrder) && positiveInteger(dependency.sourceOrder)
        && dependency.sourceOrder >= action.sourceOrder) {
        addFinding(findings, actionIdentity(questId, branch.id, action.id), 'INVALID_ORDER',
          `action:${action.id}:forward:${dependencyId}`,
        `Action "${action.id}" depends on non-earlier action "${dependencyId}".`);
      }
    });
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycle: string[] | undefined;
  const visit = (actionId: string, path: readonly string[]): void => {
    if (cycle || visited.has(actionId)) return;
    if (visiting.has(actionId)) {
      const start = path.indexOf(actionId);
      cycle = [...path.slice(start), actionId];
      return;
    }
    visiting.add(actionId);
    const action = byId.get(actionId);
    if (action && denseArray(action.dependsOn)) {
      action.dependsOn.filter(id => byId.has(id)).forEach(id => visit(id, [...path, actionId]));
    }
    visiting.delete(actionId);
    visited.add(actionId);
  };
  [...byId.keys()].sort(compareText).forEach(id => visit(id, []));
  if (cycle) {
    const cycleIds = [...new Set(cycle)].sort(compareText);
    addFinding(findings, identity, 'DEPENDENCY_CYCLE', `cycle:${cycleIds.join('|')}`,
      `Merged route contains a dependency cycle involving ${cycleIds.join(', ')}.`);
  }
};

const validateBranchCompletion = (
  definition: RuneProofQuestPack,
  branch: RuneProofBranch,
  route: readonly RuneProofAction[],
  questId: string,
  findings: RuneProofCompileFinding[],
): void => {
  const identity = branchIdentity(questId, branch.id);
  const mappedId = definition.completion.branchActionIds[branch.id];
  const byId = new Map(route.map(action => [action.id, action]));
  const canonical = route.filter(action => (
    isRecord(action.completion) && action.completion.kind === 'CANONICAL_QUEST_COMPLETED'
  ));
  const mapped = byId.get(mappedId);
  if (!isNonblank(mappedId) || !mapped || canonical.length !== 1
    || mapped.id !== canonical[0]?.id
    || !isRecord(mapped.completion)
    || mapped.completion.kind !== 'CANONICAL_QUEST_COMPLETED'
    || mapped.completion.questId !== questId) {
    addFinding(findings, identity, 'CONFLICTING_COMPLETION',
      `completion:${isNonblank(mappedId) ? mappedId : 'missing'}`,
    `Branch "${branch.id}" must map to its single canonical quest-completion action.`);
    return;
  }
  if (route.some(action => denseArray(action.dependsOn)
    && action.dependsOn.includes(mapped.id))) {
    addFinding(findings, identity, 'UNREACHABLE_COMPLETION',
      `completion:${mapped.id}:terminal`,
    `Branch completion action "${mapped.id}" must be terminal.`);
  }
  const ancestors = new Set<string>();
  const visit = (actionId: string): void => {
    if (ancestors.has(actionId)) return;
    ancestors.add(actionId);
    const action = byId.get(actionId);
    if (action && denseArray(action.dependsOn)) {
      action.dependsOn.forEach(dependencyId => {
        if (byId.has(dependencyId)) visit(dependencyId);
      });
    }
  };
  visit(mapped.id);
  route.filter(action => !ancestors.has(action.id)).forEach(action => {
    addFinding(findings, actionIdentity(questId, branch.id, action.id),
      'UNREACHABLE_COMPLETION', `action:${action.id}:completion:${mapped.id}`,
    `Action "${action.id}" is not on the dependency path to branch completion.`);
  });
};

const validateBranch = (
  definition: RuneProofQuestPack,
  branchValue: unknown,
  initialItems: readonly RuneProofInitialItemRequirement[],
  aliases: ReadonlyMap<string, string>,
  evidenceIds: ReadonlySet<string>,
  declarations: DeclarationIndex,
  questId: string,
): readonly RuneProofCompileFinding[] => {
  const findings: RuneProofCompileFinding[] = [];
  const branch = isRecord(branchValue) ? branchValue : undefined;
  const branchId = isNonblank(branch?.id) ? branch.id : 'blank-branch-id';
  const identity = branchIdentity(questId, branchId);
  const errors = exactKeyErrors(branch, BRANCH_KEYS);
  if (!branch || errors.length > 0 || !isNonblank(branch.id) || !isNonblank(branch.label)
    || !denseArray(branch.actions) || branch.actions.length === 0
    || !denseArray(branch.checkpointIds) || !branch.checkpointIds.every(isNonblank)
    || !isRecord(branch.rank)) {
    addFinding(findings, identity, 'INVALID_PROOF_REFERENCE', `branch:${branchId}:shape`,
      `Branch "${branchId}" is malformed${errors.length ? `: ${errors.join('; ')}` : ''}.`,
    safeEvidenceIds(branch?.evidenceIds));
  }
  validateEvidenceList(branch?.evidenceIds, evidenceIds, identity,
    `branch:${branchId}`, `Branch "${branchId}"`, findings);
  const rank = isRecord(branch?.rank) ? branch.rank : undefined;
  if (!rank || exactKeyErrors(rank, RANK_KEYS).length > 0
    || !RANK_KEYS.every(key => nonnegativeInteger(rank[key]))) {
    addFinding(findings, identity, 'INVALID_RANK', `branch:${branchId}:rank`,
      `Branch "${branchId}" rank components must be finite nonnegative integers.`);
  }
  let quantities = initialQuantities(initialItems);
  validateRequirementSemantics(branch?.requirements, quantities, aliases, evidenceIds,
    declarations, identity, `branch:${branchId}`, findings);

  const rawBranchActions = denseArray(branch?.actions) ? branch.actions : [];
  rawBranchActions.forEach(action => {
    if (!isRecord(action)) {
      validateActionRecord(action, branchId, quantities, aliases, evidenceIds,
        declarations, routeProofKeys(initialItems, []), questId, findings);
    }
  });
  const branchActions = rawBranchActions
    .filter((action): action is RuneProofAction => isRecord(action));
  const sharedActions = definition.sharedActions.filter(
    (action): action is RuneProofAction => isRecord(action),
  );
  const route = [...sharedActions, ...branchActions].sort(compareActions);
  const proofKeys = routeProofKeys(initialItems, route);
  const validEffectsByAction = new Map<string, readonly RuneProofItemEffect[]>();
  route.forEach(action => {
    const actionOwner = declarations.actionOwners.get(action.id);
    if (actionOwner === undefined) {
      const sharedEffects = denseArray(action.itemEffects)
        ? action.itemEffects.filter((effect): effect is RuneProofItemEffect => isRecord(effect))
        : [];
      validEffectsByAction.set(action.id, sharedEffects);
      const appliedShared = applyOptimisticEffects(quantities, sharedEffects, aliases);
      if (!appliedShared.issue) quantities = appliedShared.quantities;
      return;
    }
    const validated = validateActionRecord(action, branchId, quantities, aliases, evidenceIds,
      declarations, proofKeys, questId, findings);
    validEffectsByAction.set(action.id, validated.effects);
    const applied = applyOptimisticEffects(quantities, validated.effects, aliases);
    if (!applied.issue) quantities = applied.quantities;
  });

  if (branchValue && isRecord(branchValue)) {
    validateBranchGraph(branchValue as unknown as RuneProofBranch, route,
      declarations, questId, findings);
    validateBranchCompletion(definition, branchValue as unknown as RuneProofBranch,
      route, questId, findings);
    const ledger = evaluateRuneProofItemLedger({
      questId,
      branchId,
      initialItems,
      actions: route.map(action => ({
        id: isNonblank(action.id) ? action.id : 'blank-action-id',
        sourceOrder: positiveInteger(action.sourceOrder) ? action.sourceOrder : 1,
        itemEffects: validEffectsByAction.get(action.id) ?? [],
      })),
    });
    findings.push(...ledger.findings);
  }
  return findings;
};

const acceptedOwnership = (
  ownership: Ownership | undefined,
  acceptedBranchIds: ReadonlySet<string>,
): { readonly exists: boolean; readonly ambiguous: boolean; readonly rejectedOnly: boolean } => {
  if (!ownership) return { exists: false, ambiguous: false, rejectedOnly: false };
  const accepted = [...ownership.branches].filter(id => acceptedBranchIds.has(id));
  return {
    exists: ownership.global || accepted.length > 0,
    ambiguous: !ownership.global && accepted.length > 1,
    rejectedOnly: !ownership.global && accepted.length === 0 && ownership.branches.size > 0,
  };
};

const pruneAndValidateMigrations = (
  definition: RuneProofQuestPack,
  branches: readonly RuneProofBranch[],
  declarations: DeclarationIndex,
  questId: string,
  findings: RuneProofCompileFinding[],
): readonly RuneProofProgressMigration[] => {
  const acceptedBranchIds = new Set(branches.map(branch => branch.id));
  const acceptedActions = new Set<string>();
  definition.sharedActions.forEach(action => acceptedActions.add(action.id));
  branches.forEach(branch => branch.actions.forEach(action => acceptedActions.add(action.id)));
  const acceptedCheckpoints = new Set(branches.flatMap(branch => [...branch.checkpointIds]));
  const result: RuneProofProgressMigration[] = [];
  definition.migrations.forEach(migration => {
    const next: Record<string, Record<string, string>> = {};
    for (const field of [
      'actionIds', 'itemKeys', 'branchIds', 'manualConfirmationIds', 'checkpointIds',
    ] as const) {
      const output = Object.create(null) as Record<string, string>;
      Object.entries(migration[field]).forEach(([source, destination]) => {
        let exists = false;
        let ambiguous = false;
        let rejectedOnly = false;
        if (field === 'actionIds') {
          exists = acceptedActions.has(destination);
          const owner = declarations.actionOwners.get(destination);
          rejectedOnly = owner !== undefined && !acceptedBranchIds.has(owner);
        } else if (field === 'branchIds') {
          exists = acceptedBranchIds.has(destination);
          rejectedOnly = definition.branches.some(branch => (
            isRecord(branch) && branch.id === destination
          ));
        } else if (field === 'checkpointIds') {
          exists = acceptedCheckpoints.has(destination);
          const owner = declarations.checkpointOwners.get(destination);
          rejectedOnly = owner !== undefined && !acceptedBranchIds.has(owner);
        } else if (field === 'manualConfirmationIds') {
          const ownership = acceptedOwnership(
            declarations.manualOwners.get(destination), acceptedBranchIds,
          );
          ({ exists, ambiguous, rejectedOnly } = ownership);
          ambiguous = false;
        } else {
          ({ exists, ambiguous, rejectedOnly } = acceptedOwnership(
            declarations.itemOwners.get(destination), acceptedBranchIds));
        }
        if (rejectedOnly && !exists) return;
        if (!exists || ambiguous) {
          addFinding(findings, packIdentity(questId), 'INVALID_MIGRATION',
            `migration:${migration.id}:${field}:${source}`,
          `Migration "${migration.id}" ${field} destination "${destination}" is unresolved or ambiguous.`);
          return;
        }
        output[source] = destination;
      });
      next[field] = output;
    }
    result.push({
      id: migration.id,
      fromRevision: migration.fromRevision,
      actionIds: next.actionIds,
      itemKeys: next.itemKeys,
      branchIds: next.branchIds,
      manualConfirmationIds: next.manualConfirmationIds,
      checkpointIds: next.checkpointIds,
    });
  });
  return result;
};

export const compileRuneProofQuestPack = (
  definition: RuneProofQuestPack,
  context: RuneProofPackCompileContext,
): RuneProofCompileResult => {
  const questId = isRecord(definition) && isNonblank(definition.questId)
    ? definition.questId : context.catalogue.questId;
  const findings: RuneProofCompileFinding[] = [];
  const shapeUsable = validatePackIdentityAndExactKeys(
    definition, context, questId, findings,
  );
  if (!shapeUsable) return freezeResult({ findings, rejectedBranchIds: [] }, questId);

  const evidenceIds = validatePackSources(definition, context, questId, findings);
  const initialItems = validateInitialItems(definition, evidenceIds, questId, findings);
  const aliases = canonicalFamilyMap(initialItems);
  const declarations = buildDeclarations(definition, initialItems, questId, findings);
  validateCompletionMetadata(definition, evidenceIds, questId, findings);
  validateMigrationShape(definition, questId, findings);
  validateRequirementSemantics(
    definition.preflight, initialQuantities(initialItems), aliases, evidenceIds, declarations,
    packIdentity(questId), 'pack:preflight', findings,
  );
  validateSharedActions(definition, initialItems, aliases, evidenceIds, declarations,
    questId, findings);
  if (hasPackBlockingFinding(findings)) {
    return freezeResult({ findings, rejectedBranchIds: [] }, questId);
  }

  const rejectedBranchIds: string[] = [];
  const branches = definition.branches.filter((branch): branch is RuneProofBranch => {
    const branchFindings = validateBranch(definition, branch, initialItems, aliases,
      evidenceIds, declarations, questId);
    findings.push(...branchFindings);
    if (branchFindings.some(finding => finding.severity === 'BLOCKING')) {
      rejectedBranchIds.push(isRecord(branch) && isNonblank(branch.id)
        ? branch.id : 'blank-branch-id');
      return false;
    }
    return isRecord(branch);
  });

  if (branches.length === 0) {
    addFinding(findings, packIdentity(questId), 'UNREACHABLE_COMPLETION',
      'branches:all-rejected', 'Every reviewed branch was rejected.');
    return freezeResult({ findings, rejectedBranchIds }, questId);
  }

  const acceptedBranchIds = new Set(branches.map(branch => branch.id));
  const migrations = pruneAndValidateMigrations(
    definition, branches, declarations, questId, findings,
  );
  if (hasPackBlockingFinding(findings)) {
    return freezeResult({ findings, rejectedBranchIds }, questId);
  }
  return freezeResult({
    pack: {
      ...definition,
      catalogue: context.catalogue,
      initialItems,
      branches,
      migrations,
      completion: {
        ...definition.completion,
        branchActionIds: Object.fromEntries(
          Object.entries(definition.completion.branchActionIds)
            .filter(([branchId]) => acceptedBranchIds.has(branchId)),
        ),
      },
      findings,
    },
    findings,
    rejectedBranchIds,
  }, questId);
};
