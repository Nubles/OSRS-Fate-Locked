import { ACTIVITY_ACCESS_AREAS } from '../../data/activityAccess';
import { ACTIVITY_REGIONS } from '../../data/activityRegions';
import { ACTIVITY_REQUIREMENTS } from '../../data/activityRequirements';
import { DIARY_DATA } from '../../data/diaryData';
import {
  ARCANA_LIST, BOSSES_LIST, FARMING_PATCH_LIST, GUILDS_LIST,
  MINIGAMES_LIST, MOBILITY_LIST, POH_LIST, STORAGE_LIST,
} from '../../data/items';
import {
  QUEST_DATA,
  type ItemRequirement,
  type QuestData,
  type QuestLocationRequirement,
  type QuestRequirementOption,
} from '../../data/questData';
import {
  questRequirementFingerprint,
  type QuestRequirementAuditEntry,
} from '../../data/questRequirementAudit';
import diarySource from '../../data/sources/achievement-diary-tasks.json';
import questAuditSource from '../../data/sources/quest-requirement-audit.json';
import {
  assertRequirementExpr, factId, normalizeId,
  type Coverage, type FactKind, type FactRef, type RequirementExpr,
} from './model';

export type GoalKind = 'ITEM' | 'QUEST' | 'DIARY' | 'ACTIVITY';
export interface CompiledGoal {
  id: string;
  kind: GoalKind;
  label: string;
  requirement: RequirementExpr;
  coverage: Coverage;
  provenanceIds: string[];
  sourceVersion: string;
}
export interface CanonicalItemIdentity {
  readonly id: string;
  readonly label: string;
}
export interface GoalLocationRequirement {
  readonly id: string;
  readonly label: string;
}
export interface StructuredRequirement {
  readonly skills?: Readonly<Record<string, number>>;
  readonly quests?: readonly string[];
  readonly items?: readonly ItemRequirement[];
  readonly capabilities?: readonly string[];
  readonly locations?: readonly GoalLocationRequirement[];
}
export interface StructuredGoalDefinition extends StructuredRequirement {
  readonly id: string;
  readonly label: string;
  readonly alternatives?: readonly StructuredRequirement[];
  readonly unstructuredEvidence?: readonly string[];
}
export interface ProofGradeGoalAudit {
  readonly status: Coverage;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly requirementFingerprint: string;
}
export interface CompiledGoalEvaluationInput {
  readonly goalId: string;
  readonly requirement: RequirementExpr;
  readonly coverage: Coverage;
  readonly sourceVersion: string;
}export interface ProductionActivityGoalOptions {
  readonly reverseCatalogsForTest?: boolean;
}

export function compileItemGoal(
  identity: CanonicalItemIdentity,
  quantity: number,
): CompiledGoal {
  const label = exact(identity.label, 'item label');
  if (identity.id !== factId('ITEM', label)) {
    throw new Error(`Invalid canonical item identity: ${identity.id}`);
  }
  positive(quantity, 'Item goal quantity');
  return finish(identity.id, 'ITEM', label, fact('ITEM', label, quantity),
    'VERIFIED', [`goal-selection:${identity.id}@${quantity}`], { identity, quantity });
}

export function compileQuestGoal(
  quest: QuestData,
  audit?: QuestRequirementAuditEntry,
): CompiledGoal {
  validateQuest(quest);
  if (audit) validateAudit(audit);
  const terms = structuredTerms({
    skills: quest.skills,
    quests: quest.prereqs,
    items: quest.items,
    capabilities: quest.capabilities,
    locations: quest.locations,
  });
  if (quest.combatLevel !== undefined) {
    terms.push(fact('SKILL_LEVEL', 'Combat', positive(
      quest.combatLevel, `${quest.id} combat level`,
    )));
  }
  if (quest.itemAlternatives !== undefined) {
    terms.push(itemAlternatives(quest.itemAlternatives, `${quest.id} item alternatives`));
  }
  if (quest.oneOf !== undefined) {
    terms.push(questAlternatives(quest.oneOf, `${quest.id} alternatives`));
  }
  const fingerprint = questRequirementFingerprint(quest);
  const exactAudit = audit?.id === quest.id
    && audit.kind === quest.kind
    && audit.status === 'verified'
    && audit.accessPolicy === quest.accessPolicy
    && audit.requirementFingerprint === fingerprint
    && auditLocationsMatch(quest, audit);
  const exactLocations = quest.accessPolicy !== 'regions'
    && (quest.locations?.length ?? 0) > 0;
  const coverage: Coverage = exactAudit && exactLocations
    && (quest.requirementCoverage ?? 'VERIFIED') === 'VERIFIED'
    && !quest.manualRequirements?.length ? 'VERIFIED' : 'UNKNOWN';
  const provenance = [
    `quest-data:${normalizeId(quest.id)}:${fingerprintOf(fingerprint)}`,
    audit
      ? `quest-audit:${normalizeId(audit.id)}:wiki-${audit.source.revision}:chunk-${audit.chunkSourceCommit}`
      : `quest-audit:${normalizeId(quest.id)}:missing`,
  ];
  if (quest.manualRequirements?.length) {
    provenance.push(`unstructured:quest-manual:${normalizeId(quest.id)}:${
      fingerprintOf(stableJson(quest.manualRequirements))}`);
  }
  return finish(`quest:${normalizeId(quest.id)}`, 'QUEST', quest.name,
    all(terms), coverage, provenance, { quest, audit: audit ?? null, fingerprint });
}

export function compileQuestGoals(
  quests: readonly QuestData[],
  audits: readonly QuestRequirementAuditEntry[],
): CompiledGoal[] {
  const questById = unique(quests, value => value.id, 'quest');
  const auditById = unique(audits, value => value.id, 'quest audit');
  validateCycles([...questById.values()]);
  return freeze([...questById.values()].sort((a, b) => cmp(a.id, b.id))
    .map(value => compileQuestGoal(value, auditById.get(value.id))));
}

export function compileStructuredGoal(
  kind: 'DIARY' | 'ACTIVITY',
  definition: StructuredGoalDefinition,
  audit?: ProofGradeGoalAudit,
): CompiledGoal {
  const id = exact(definition.id, `${kind} id`);
  const label = exact(definition.label, `${kind} label`);
  const terms = structuredTerms(definition);
  if (definition.alternatives !== undefined) {
    if (!definition.alternatives.length) throw new Error(`${kind} alternatives must not be empty`);
    terms.push(any(definition.alternatives.map((value, index) => {
      const branch = structuredTerms(value);
      if (!branch.length) throw new Error(` alternatives[${index}] is empty`);
      return all(branch);
    }), ` alternatives`));
  }
  const fingerprint = JSON.stringify(definition);
  const exactAudit = audit?.requirementFingerprint === fingerprint;
  if (audit) {
    exact(audit.sourceId, `${kind} audit source`);
    exact(audit.sourceVersion, `${kind} audit version`);
  }
  const coverage: Coverage = exactAudit && (definition.locations?.length ?? 0) > 0
    && !definition.unstructuredEvidence?.length
    ? audit?.status === 'VERIFIED' ? 'VERIFIED'
      : audit?.status === 'PARTIAL' ? 'PARTIAL' : 'UNKNOWN'
    : 'UNKNOWN';
  const provenance = [
    `${kind.toLowerCase()}-data:${normalizeId(id)}:${fingerprintOf(stableJson(definition))}`,
    audit
      ? `${kind.toLowerCase()}-audit:${normalizeId(audit.sourceId)}:${normalizeId(audit.sourceVersion)}`
      : `${kind.toLowerCase()}-audit:missing`,
  ];
  if (definition.unstructuredEvidence?.length) {
    validateLabels(definition.unstructuredEvidence, `${kind} unstructured evidence`);
    provenance.push(`unstructured:${kind.toLowerCase()}:${normalizeId(id)}:${
      fingerprintOf(stableJson(definition.unstructuredEvidence))}`);
  }
  return finish(`${kind.toLowerCase()}:${normalizeId(id)}`, kind, label,
    all(terms), coverage, provenance, { definition, audit: audit ?? null });
}

export function toGoalEvaluationInput(goal: CompiledGoal): CompiledGoalEvaluationInput {
  exact(goal.id, 'compiled goal id');
  exact(goal.sourceVersion, 'compiled goal sourceVersion');
  if (!['VERIFIED', 'PARTIAL', 'UNKNOWN'].includes(goal.coverage)) {
    throw new Error('Invalid compiled goal coverage');
  }
  assertRequirementExpr(goal.requirement);
  return freeze({
    goalId: goal.id,
    requirement: goal.requirement,
    coverage: goal.coverage,
    sourceVersion: goal.sourceVersion,
  });
}
export function compileProductionQuestGoals(): CompiledGoal[] {
  return compileQuestGoals(
    Object.values(QUEST_DATA),
    questAuditSource.entries as QuestRequirementAuditEntry[],
  );
}

export function compileProductionDiaryGoals(): CompiledGoal[] {
  return freeze(Object.values(DIARY_DATA).sort((a, b) => cmp(a.id, b.id)).map(diary =>
    compileStructuredGoal('DIARY', {
      id: diary.id,
      label: diary.id,
      skills: diary.skills,
      quests: diary.quests,
      unstructuredEvidence: [`No proof-grade task-location audit for ${diary.id}`],
    }, {
      status: 'UNKNOWN',
      sourceId: 'achievement-diary-tasks',
      sourceVersion: `wiki-${diarySource.source.revision}`,
      requirementFingerprint: 'not-proof-grade',
    })));
}

export function compileProductionActivityGoals(
  options: ProductionActivityGoalOptions = {},
): CompiledGoal[] {
  const catalogs: readonly (readonly string[])[] = [
    BOSSES_LIST, MINIGAMES_LIST, GUILDS_LIST, MOBILITY_LIST,
    ARCANA_LIST, POH_LIST, STORAGE_LIST, FARMING_PATCH_LIST,
  ];
  const labels = options.reverseCatalogsForTest
    ? [...catalogs].reverse().flatMap(value => [...value].reverse())
    : catalogs.flatMap(value => [...value]);
  const identities = new Map<string, string>();
  labels.forEach(label => {
    const canonical = normalizeId(exact(label, 'activity label'));
    const previous = identities.get(canonical);
    if (previous !== undefined && previous !== label) {
      throw new Error(`Conflicting activity identity ${canonical}`);
    }
    identities.set(canonical, label);
  });
  return freeze([...identities.values()].sort(cmp).map(label => {
    const requirement = ACTIVITY_REQUIREMENTS[label];
    const access = ACTIVITY_ACCESS_AREAS[label];
    const region = ACTIVITY_REGIONS[label];
    return compileStructuredGoal('ACTIVITY', {
      id: label,
      label,
      skills: requirement?.skills,
      quests: requirement?.quests,
      unstructuredEvidence: canonicalEvidence([
        'No exact proof-grade activity prerequisite and location audit',
        ...(requirement?.manualRequirements ?? []),
        ...(requirement?.note ? [requirement.note] : []),
        ...(requirement?.requiredAreas ?? []),
        ...(access ?? []),
        ...(region ? [region] : []),
      ]),
    }, {
      status: 'UNKNOWN',
      sourceId: 'activity-requirements',
      sourceVersion: fingerprintOf(stableJson({ requirement, access, region })),
      requirementFingerprint: 'not-proof-grade',
    });
  }));
}

function questAlternatives(
  values: readonly QuestRequirementOption[],
  context: string,
): RequirementExpr {
  if (!values.length) throw new Error(`${context} must not be empty`);
  return any(values.map((value, index) => {
    const unverifiedRegionGate = value.regions?.length && !value.locations?.length
      ? [fact('CAPABILITY', `Unverified requirement ${context} ${index + 1}`)]
      : [];
    const branch = [...unverifiedRegionGate, ...structuredTerms({
      skills: value.skills,
      quests: value.quests,
      items: value.items,
      capabilities: [...(value.capabilities ?? []), ...(value.guilds ?? [])],
      locations: value.locations,
    })];
    if (!branch.length) throw new Error(`[${index}] is empty`);
    return all(branch);
  }), context);
}

function itemAlternatives(
  values: readonly (readonly ItemRequirement[])[],
  context: string,
): RequirementExpr {
  if (!values.length) throw new Error(`${context} must not be empty`);
  return any(values.map((items, index) => {
    if (!items.length) throw new Error(`${context}[${index}] must not be empty`);
    return all(compileItems(items, `${context}[${index}]`));
  }), context);
}

function structuredTerms(value: StructuredRequirement & {
  readonly locations?: readonly (GoalLocationRequirement | QuestLocationRequirement)[];
}): RequirementExpr[] {
  return [
    ...quantities(value.skills ?? {}, 'SKILL_LEVEL', 'skill'),
    ...labels(value.quests ?? [], 'QUEST', 'quest'),
    ...compileItems(value.items ?? [], 'items'),
    ...labels(value.capabilities ?? [], 'CAPABILITY', 'capability'),
    ...locations(value.locations ?? []),
  ];
}

function quantities(
  values: Readonly<Record<string, number>>,
  kind: FactKind,
  context: string,
): RequirementExpr[] {
  const seen = new Set<string>();
  return Object.entries(values).map(([label, quantity]) => {
    const id = factId(kind, exact(label, context));
    if (seen.has(id)) throw new Error(`Duplicate ${context}: ${label}`);
    seen.add(id);
    return fact(kind, label, positive(quantity, `${context} ${label}`));
  });
}

function labels(
  values: readonly string[],
  kind: FactKind,
  context: string,
): RequirementExpr[] {
  const seen = new Set<string>();
  return values.map(label => {
    const id = factId(kind, exact(label, context));
    if (seen.has(id)) throw new Error(`Duplicate ${context}: ${label}`);
    seen.add(id);
    return fact(kind, label);
  });
}

function compileItems(values: readonly ItemRequirement[], context: string): RequirementExpr[] {
  const seen = new Set<string>();
  return values.map((value, index) => {
    if (typeof value?.consumed !== 'boolean') {
      throw new Error(`${context}[${index}] consumed must be boolean`);
    }
    const label = exact(value.item, `${context}[${index}] item`);
    const id = factId('ITEM', label);
    if (seen.has(id)) throw new Error(`Duplicate item in ${context}: ${label}`);
    seen.add(id);
    return fact('ITEM', label, positive(value.quantity, `${context}[${index}] quantity`));
  });
}

function locations(
  values: readonly (GoalLocationRequirement | QuestLocationRequirement)[],
): RequirementExpr[] {
  const seen = new Map<string, string>();
  return values.map(value => {
    const label = exact(value.label, 'location label');
    const canonicalId = exact(value.id, 'location id');
    if (normalizeId(canonicalId) !== canonicalId) {
      throw new Error(`Location ${canonicalId} is not a canonical id`);
    }
    if (seen.has(value.id)) {
      throw new Error(`${seen.get(value.id) === label ? 'Duplicate' : 'Conflicting'} location ${value.id}`);
    }
    seen.set(value.id, label);
    return fact('LOCATION', normalizeId(label) === canonicalId ? label : canonicalId);
  });
}

function validateQuest(quest: QuestData): void {
  exact(quest.id, 'quest id');
  exact(quest.name, 'quest name');
  if (!['quest', 'miniquest'].includes(quest.kind)) throw new Error(`Invalid quest kind`);
  if (!['regions', 'locations', 'regions-and-locations'].includes(quest.accessPolicy)) {
    throw new Error(`Invalid quest access policy`);
  }
  labels(quest.prereqs, 'QUEST', `${quest.id} prerequisite`);
  quantities(quest.skills, 'SKILL_LEVEL', `${quest.id} skill`);
  compileItems(quest.items ?? [], `${quest.id} items`);
  locations(quest.locations ?? []);
  if (quest.manualRequirements) validateLabels(
    quest.manualRequirements, `${quest.id} manual requirement`,
  );
}

function auditLocationsMatch(
  quest: QuestData,
  audit: QuestRequirementAuditEntry,
): boolean {
  const locations = quest.locations ?? [];
  if (!locations.length || audit.chunkEvidence.length !== locations.length) return false;
  const matches = (location: QuestLocationRequirement, evidence: QuestRequirementAuditEntry['chunkEvidence'][number]) =>
    evidence.place === location.label
    && location.chunkOptions.some(option =>
      evidence.chunkId === `${option.cx},${option.cy}`,
    );
  return locations.every(location => audit.chunkEvidence.some(evidence => matches(location, evidence)))
    && audit.chunkEvidence.every(evidence => locations.some(location => matches(location, evidence)));
}
function validateAudit(audit: QuestRequirementAuditEntry): void {
  exact(audit.id, 'quest audit id');
  if (!['verified', 'verified-with-notes', 'unresolved'].includes(audit.status)) {
    throw new Error(`Invalid quest audit status`);
  }
  positive(audit.source.revision, 'quest audit revision');
  exact(audit.source.url, 'quest audit URL');
  exact(audit.chunkSourceCommit, 'chunk source commit');
  exact(audit.requirementFingerprint, 'quest audit fingerprint');
}

function validateCycles(quests: readonly QuestData[]): void {
  const byId = new Map(quests.map(value => [normalizeId(value.id), value]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (value: QuestData, path: readonly string[]): void => {
    const id = normalizeId(value.id);
    if (visiting.has(id)) {
      throw new Error(`Unsupported quest prerequisite cycle: ${[...path, value.id].join(' -> ')}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const dependencies = [
      ...value.prereqs,
      ...(value.oneOf ?? []).flatMap(option => option.quests ?? []),
    ];
    dependencies.forEach(name => {
      const child = byId.get(normalizeId(name));
      if (child) visit(child, [...path, value.id]);
    });
    visiting.delete(id);
    visited.add(id);
  };
  quests.forEach(value => visit(value, []));
}

function unique<T>(
  values: readonly T[],
  idFor: (value: T) => string,
  context: string,
): Map<string, T> {
  const result = new Map<string, T>();
  const canonical = new Map<string, string>();
  values.forEach(value => {
    const id = exact(idFor(value), `${context} id`);
    const key = normalizeId(id);
    if (canonical.has(key)) {
      throw new Error(`Duplicate ${context} id: ${canonical.get(key)} / ${id}`);
    }
    canonical.set(key, id);
    result.set(id, value);
  });
  return result;
}

function canonicalEvidence(values: readonly string[]): string[] {
  const result = new Map<string, string>();
  values.forEach(value => {
    const key = normalizeId(exact(value, 'production evidence'));
    const previous = result.get(key);
    if (previous === undefined || cmp(value, previous) < 0) result.set(key, value);
  });
  return [...result.values()].sort(cmp);
}

function validateLabels(values: readonly string[], context: string): void {
  const seen = new Set<string>();
  values.forEach(value => {
    const key = normalizeId(exact(value, context));
    if (seen.has(key)) throw new Error(`Duplicate ${context}: ${value}`);
    seen.add(key);
  });
}

function fact(kind: FactKind, label: string, quantity?: number): RequirementExpr {
  const ref: FactRef = {
    id: factId(kind, label), kind, label,
    ...(quantity === undefined || quantity === 1 ? {} : { quantity }),
  };
  return { op: 'FACT', fact: ref };
}
function all(terms: readonly RequirementExpr[]): RequirementExpr {
  return { op: 'ALL', terms: [...terms].sort(exprCmp) };
}
function any(terms: readonly RequirementExpr[], context: string): RequirementExpr {
  const ordered = [...terms].sort(exprCmp);
  const ids = ordered.map(stableJson);
  if (new Set(ids).size !== ids.length) throw new Error(`Duplicate definition in ${context}`);
  return { op: 'ANY', terms: ordered };
}
function exprCmp(a: RequirementExpr, b: RequirementExpr): number {
  const rank = { ANY: 0, ALL: 1, FACT: 2 } as const;
  return rank[a.op] - rank[b.op] || cmp(stableJson(a), stableJson(b));
}

function finish(
  id: string,
  kind: GoalKind,
  label: string,
  requirement: RequirementExpr,
  coverage: Coverage,
  provenance: readonly string[],
  sourceInput: unknown,
): CompiledGoal {
  assertRequirementExpr(requirement);
  const provenanceIds = [...new Set(provenance)].map(value => exact(value, 'provenance id')).sort(cmp);
  if (provenanceIds.length !== provenance.length) throw new Error(`Duplicate provenance for ${id}`);
  return freeze({
    id, kind, label, requirement, coverage, provenanceIds,
    sourceVersion: `runeproof-goal-compiler-v1:${fingerprintOf(stableJson({ kind, sourceInput }))}`,
  });
}

function exact(value: unknown, context: string): string {
  if (typeof value !== 'string' || !value || value !== value.trim() || !normalizeId(value)) {
    throw new Error(`${context} must be a non-empty canonical string`);
  }
  return value;
}
function positive(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${context} must be a positive integer`);
  }
  return value;
}
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => cmp(a, b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function fingerprintOf(value: string): string {
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ (code + index), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
