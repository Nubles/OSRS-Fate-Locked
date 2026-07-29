import { validateLocationNodes, type LocationNodeSource } from './locationGraph';
import {
  assertRequirementExpr,
  factId,
  normalizeId,
  type AcquisitionRule,
  type Coverage,
  type RequirementExpr,
  type SourceKind,
} from './model';

export type AcquisitionSourceFamily =
  | 'SHOP'
  | 'DROP'
  | 'SPAWN'
  | 'PRODUCTION'
  | 'RESOURCE_ENGINE';

export interface AcquisitionChunkEntry {
  m?: [string, number, number?][];
  s?: string[];
  i?: string[];
}

export interface AcquisitionTaskUnlocks {
  Shops?: Record<string, Record<string, string[]>>;
  Monsters?: Record<string, Record<string, string[]>>;
  Spawns?: Record<string, Record<string, string[]>>;
}

export interface AcquisitionTransformEvent {
  category: string;
  sourceKey: string;
  targetKeys: string[];
  terminal: boolean;
  disposition: string;
}

export interface AuditedProductionRecipe {
  output: string;
  outputQuantity: number;
  sourceHost: string;
  locationId: string;
  inputs: Record<string, number>;
  requirements: RequirementExpr;
  repeatability: AcquisitionRule['repeatability'];
  probability: number | null;
  coverage: Coverage;
  provenanceIds: string[];
}

export interface ReviewedAcquisitionSource {
  output: string;
  sourceKind: SourceKind;
  sourceHost: string;
  regions: string[];
  locationId?: string;
  outputQuantity?: number;
  requirements?: RequirementExpr;
  repeatability?: AcquisitionRule['repeatability'];
  probability?: number | null;
  coverage: Coverage;
  provenanceIds: string[];
}

export interface AcquisitionCompilerInput {
  sourceVersion: string;
  sourceCommit: string;
  locationNodes: LocationNodeSource[];
  chunks: Record<string, AcquisitionChunkEntry>;
  shopItems: Record<string, string[]>;
  drops: Record<string, string[]>;
  taskUnlocks: AcquisitionTaskUnlocks;
  questIds: string[];
  transformEvents: AcquisitionTransformEvent[];
  productionRecipes: AuditedProductionRecipe[];
  reviewedSources: ReviewedAcquisitionSource[];
}

export type UnresolvedAcquisitionReason =
  | 'REGION_ONLY_LOCATION'
  | 'UNKNOWN_LOCATION'
  | 'INCOMPLETE_METADATA'
  | 'CONFLICTING_RULE_ID'
  | 'CONFLICTING_OUTPUT_ID'
  | 'NO_PROOF_GRADE_LOCATION';

export interface UnresolvedAcquisitionSource {
  id: string;
  output: string;
  sourceKind: SourceKind;
  sourceHost: string;
  regions: string[];
  coverage: Coverage;
  reason: UnresolvedAcquisitionReason;
  provenanceIds: string[];
}

export interface SourceFamilyAccounting {
  ruleCount: number;
  unresolvedCount: number;
  ruleIds: string[];
  unresolvedIds: string[];
  coverage: Coverage;
}

export interface RuneProofSourceDocument {
  schemaVersion: 1;
  sourceVersion: string;
  counts: { rules: number; unresolvedSources: number };
  acquisitionCoverage: Coverage;
  sourceFamilyCoverage: Record<AcquisitionSourceFamily, Coverage>;
  sourceFamilyAccounting: Record<AcquisitionSourceFamily, SourceFamilyAccounting>;
  rules: AcquisitionRule[];
  unresolvedSources: UnresolvedAcquisitionSource[];
}

export interface AcquisitionIndex {
  rulesById: ReadonlyMap<string, AcquisitionRule>;
  rulesByOutput: ReadonlyMap<string, readonly AcquisitionRule[]>;
  rulesByLocation: ReadonlyMap<string, readonly AcquisitionRule[]>;
  unresolvedByOutput: ReadonlyMap<string, readonly UnresolvedAcquisitionSource[]>;
  acquisitionCoverage: Coverage;
  sourceFamilyCoverage: Readonly<Record<AcquisitionSourceFamily, Coverage>>;
}

const SOURCE_FAMILIES: readonly AcquisitionSourceFamily[] = [
  'DROP',
  'PRODUCTION',
  'RESOURCE_ENGINE',
  'SHOP',
  'SPAWN',
];
const SOURCE_KINDS = new Set<SourceKind>([
  'SHOP', 'DROP', 'SPAWN', 'PRODUCTION', 'GATHERING', 'QUEST_REWARD',
  'MINIGAME', 'PICKPOCKET', 'CLUE',
]);

export function compileAcquisitionSources(
  input: AcquisitionCompilerInput,
): RuneProofSourceDocument {
  const rules = new Map<string, AcquisitionRule>();
  const unresolved: UnresolvedAcquisitionSource[] = [];
  const outputLabels = new Map<string, string>();
  const ambiguousOutputs = new Set<string>();
  const conflictingRuleIds = new Set<string>();
  const questIds = new Set(input.questIds);
  const validatedLocations = validateLocationNodes(input.locationNodes);
  const locations = validatedLocations.nodes;
  const transformProvenance = buildTransformProvenance(input.transformEvents);

  for (const candidate of buildRawCandidates(input, transformProvenance)) {
    const exactLocations = candidate.regionIds
      .map(regionId => ({
        regionId,
        location: validatedLocations.surfaceNodes.get(surfaceChunkForRegionId(regionId)),
      }))
      .filter((entry): entry is { regionId: number; location: LocationNodeSource } =>
        Boolean(entry.location));

    if (exactLocations.length !== 1) {
      unresolved.push(unresolvedRawCandidate(candidate));
      continue;
    }

    for (const { regionId, location } of exactLocations) {
      const taskRequirements = candidate.sourceKind === 'SHOP'
        ? input.taskUnlocks.Shops?.[candidate.sourceHost]?.[String(regionId)] ?? []
        : candidate.sourceKind === 'DROP'
          ? input.taskUnlocks.Monsters?.[candidate.sourceHost]?.[String(regionId)] ?? []
          : input.taskUnlocks.Spawns?.[candidate.output]?.[String(regionId)] ?? [];
      addRule(rules, unresolved, outputLabels, ambiguousOutputs, conflictingRuleIds, {
        id: acquisitionRuleId(
          candidate.output, candidate.sourceKind, candidate.sourceHost, location.id,
        ),
        output: itemFact(candidate.output),
        outputQuantity: 1,
        sourceKind: candidate.sourceKind,
        sourceLabel: candidate.sourceHost,
        locationId: location.id,
        requirements: requirementsFor(taskRequirements, questIds),
        repeatability: 'UNKNOWN',
        probability: null,
        coverage: combineCoverage('PARTIAL', location.coverage),
        provenanceIds: candidate.provenanceIds,
      });
    }
  }
  for (const recipe of [...input.productionRecipes].sort(productionOrder)) {
    const location = locations.get(recipe.locationId);
    if (!location) {
      unresolved.push(unresolvedProduction(recipe, 'UNKNOWN_LOCATION'));
      continue;
    }
    if (!validProductionRecipe(recipe) || location.coverage !== 'VERIFIED') {
      unresolved.push(unresolvedProduction(recipe, 'INCOMPLETE_METADATA'));
      continue;
    }

    const inputTerms: RequirementExpr[] = Object.entries(recipe.inputs)
      .sort(([left], [right]) => compareText(left, right))
      .map(([label, quantity]) => ({
        op: 'FACT',
        fact: { ...itemFact(label), quantity },
      }));
    const explicit = canonicalRequirement(recipe.requirements);
    const terms = explicit.op === 'ALL' && explicit.terms.length === 0
      ? inputTerms
      : [...inputTerms, explicit];
    addRule(rules, unresolved, outputLabels, ambiguousOutputs, conflictingRuleIds, {
      id: acquisitionRuleId(
        recipe.output,
        'PRODUCTION',
        recipe.sourceHost,
        recipe.locationId,
      ),
      output: itemFact(recipe.output),
      outputQuantity: recipe.outputQuantity,
      sourceKind: 'PRODUCTION',
      sourceLabel: recipe.sourceHost,
      locationId: recipe.locationId,
      requirements: { op: 'ALL', terms },
      repeatability: recipe.repeatability,
      probability: recipe.probability,
      coverage: combineCoverage(recipe.coverage, location.coverage),
      provenanceIds: sortedUnique(recipe.provenanceIds),
    });
  }

  for (const source of [...input.reviewedSources].sort(reviewedOrder)) {
    if (!validReviewedDescriptor(source)) {
      throw new Error('Invalid reviewed acquisition source descriptor');
    }
    if (source.regions.includes('Any')) {
      unresolved.push(unresolvedReviewed(source, 'REGION_ONLY_LOCATION'));
      continue;
    }
    if (!source.locationId) {
      unresolved.push(unresolvedReviewed(source, 'REGION_ONLY_LOCATION'));
      continue;
    }
    const location = locations.get(source.locationId);
    if (!location) {
      unresolved.push(unresolvedReviewed(source, 'UNKNOWN_LOCATION'));
      continue;
    }
    if (source.sourceKind === 'PRODUCTION' || !validReviewedSource(source)) {
      unresolved.push(unresolvedReviewed(source, 'INCOMPLETE_METADATA'));
      continue;
    }
    addRule(rules, unresolved, outputLabels, ambiguousOutputs, conflictingRuleIds, {
      id: acquisitionRuleId(
        source.output,
        source.sourceKind,
        source.sourceHost,
        source.locationId,
      ),
      output: itemFact(source.output),
      outputQuantity: source.outputQuantity,
      sourceKind: source.sourceKind,
      sourceLabel: source.sourceHost,
      locationId: source.locationId,
      requirements: canonicalRequirement(source.requirements),
      repeatability: source.repeatability,
      probability: source.probability,
      coverage: combineCoverage(source.coverage, location.coverage),
      provenanceIds: sortedUnique(source.provenanceIds),
    });
  }

  const emittedRules = [...rules.values()].sort(byId);
  const unresolvedSources = dedupeUnresolved(unresolved);
  const sourceFamilyAccounting = familyAccounting(emittedRules, unresolvedSources);
  const sourceFamilyCoverage = Object.fromEntries(SOURCE_FAMILIES.map(family => [
    family, sourceFamilyAccounting[family].coverage,
  ])) as Record<AcquisitionSourceFamily, Coverage>;

  return {
    schemaVersion: 1,
    sourceVersion: input.sourceVersion,
    counts: { rules: emittedRules.length, unresolvedSources: unresolvedSources.length },
    acquisitionCoverage: overallCoverage(sourceFamilyCoverage, unresolvedSources),
    sourceFamilyCoverage,
    sourceFamilyAccounting,
    rules: emittedRules,
    unresolvedSources,
  };
}

export function buildAcquisitionIndex(
  document: RuneProofSourceDocument,
): AcquisitionIndex {
  const rules = [...document.rules].sort(byId);
  return {
    rulesById: new Map(rules.map(rule => [rule.id, rule])),
    rulesByOutput: groupBy(rules, rule => rule.output.id),
    rulesByLocation: groupBy(rules, rule => rule.locationId),
    unresolvedByOutput: groupBy(
      [...document.unresolvedSources].sort(byId),
      source => factId('ITEM', source.output),
    ),
    acquisitionCoverage: document.acquisitionCoverage,
    sourceFamilyCoverage: Object.freeze({ ...document.sourceFamilyCoverage }),
  };
}

function addRule(
  rules: Map<string, AcquisitionRule>,
  unresolved: UnresolvedAcquisitionSource[],
  outputLabels: Map<string, string>,
  ambiguousOutputs: Set<string>,
  conflictingRuleIds: Set<string>,
  rule: AcquisitionRule,
): void {
  const outputId = rule.output.id;
  const establishedLabel = outputLabels.get(outputId);
  if (ambiguousOutputs.has(outputId)
    || (establishedLabel !== undefined && establishedLabel !== rule.output.label)) {
    if (!ambiguousOutputs.has(outputId)) {
      ambiguousOutputs.add(outputId);
      for (const existingRule of [...rules.values()]) {
        if (existingRule.output.id === outputId) {
          rules.delete(existingRule.id);
          unresolved.push(unresolvedRule(existingRule, 'CONFLICTING_OUTPUT_ID'));
        }
      }
    }
    unresolved.push(unresolvedRule(rule, 'CONFLICTING_OUTPUT_ID'));
    return;
  }
  outputLabels.set(outputId, rule.output.label);

  if (conflictingRuleIds.has(rule.id)) {
    unresolved.push(unresolvedRule(rule, 'CONFLICTING_RULE_ID'));
    return;
  }

  const existing = rules.get(rule.id);
  if (!existing) {
    rules.set(rule.id, canonicalRule(rule));
    return;
  }
  if (JSON.stringify(existing) === JSON.stringify(canonicalRule(rule))) return;
  conflictingRuleIds.add(rule.id);
  unresolved.push(unresolvedRule(existing, 'CONFLICTING_RULE_ID'));
  unresolved.push(unresolvedRule(rule, 'CONFLICTING_RULE_ID'));
  rules.delete(rule.id);
}

function unresolvedRule(
  rule: AcquisitionRule,
  reason: 'CONFLICTING_RULE_ID' | 'CONFLICTING_OUTPUT_ID',
): UnresolvedAcquisitionSource {
  return {
    id: `unresolved:${normalizeId(rule.id)}:${normalizeId(reason)}:${
      stableFingerprint([JSON.stringify(canonicalRule(rule))])
    }`,
    output: rule.output.label,
    sourceKind: rule.sourceKind,
    sourceHost: rule.sourceLabel,
    regions: [],
    coverage: 'UNKNOWN',
    reason,
    provenanceIds: sortedUnique(rule.provenanceIds),
  };
}
function canonicalRule(rule: AcquisitionRule): AcquisitionRule {
  return {
    id: rule.id,
    output: { ...rule.output },
    outputQuantity: rule.outputQuantity,
    sourceKind: rule.sourceKind,
    sourceLabel: rule.sourceLabel,
    locationId: rule.locationId,
    requirements: canonicalRequirement(rule.requirements),
    repeatability: rule.repeatability,
    probability: rule.probability,
    coverage: rule.coverage,
    provenanceIds: sortedUnique(rule.provenanceIds),
  };
}

function canonicalUnresolved(
  source: UnresolvedAcquisitionSource,
): UnresolvedAcquisitionSource {
  return {
    id: source.id,
    output: source.output,
    sourceKind: source.sourceKind,
    sourceHost: source.sourceHost,
    regions: sortedUnique(source.regions),
    coverage: source.coverage,
    reason: source.reason,
    provenanceIds: sortedUnique(source.provenanceIds),
  };
}

function acquisitionRuleId(
  output: string,
  sourceKind: SourceKind,
  sourceHost: string,
  locationId: string,
): string {
  return `acq:${normalizeId(factId('ITEM', output))}:${[
    sourceKind,
    sourceHost,
    locationId,
  ].map(normalizeId).join('-')}:${stableFingerprint([
    output, sourceKind, sourceHost, locationId,
  ])}`;
}

function itemFact(label: string): AcquisitionRule['output'] {
  return { id: factId('ITEM', label), kind: 'ITEM', label };
}

function requirementsFor(
  requirements: readonly string[],
  questIds: ReadonlySet<string>,
): RequirementExpr {
  return {
    op: 'ALL',
    terms: sortedUnique(requirements).map(label => ({
      op: 'FACT',
      fact: {
        id: factId(questIds.has(label) ? 'QUEST' : 'UNLOCK', label),
        kind: questIds.has(label) ? 'QUEST' : 'UNLOCK',
        label,
      },
    })),
  };
}

function canonicalRequirement(expression: RequirementExpr): RequirementExpr {
  assertRequirementExpr(expression);
  if (expression.op === 'FACT') return { op: 'FACT', fact: { ...expression.fact } };
  return {
    op: expression.op,
    terms: expression.terms
      .map(canonicalRequirement)
      .sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right))),
  };
}

function validProductionRecipe(recipe: AuditedProductionRecipe): boolean {
  if (!positiveInteger(recipe.outputQuantity)
    || !nonEmpty(recipe.output)
    || !nonEmpty(recipe.sourceHost)
    || !validProbability(recipe.probability)
    || (recipe.repeatability !== 'REPEATABLE' && recipe.repeatability !== 'ONE_TIME')
    || recipe.coverage !== 'VERIFIED'
    || !validProvenance(recipe.provenanceIds)
    || !isRecord(recipe.inputs)
    || Object.keys(recipe.inputs).length === 0
    || !Object.entries(recipe.inputs).every(([label, quantity]) =>
      nonEmpty(label) && positiveInteger(quantity))) return false;
  try {
    assertRequirementExpr(recipe.requirements);
    return true;
  } catch {
    return false;
  }
}

function validReviewedDescriptor(source: ReviewedAcquisitionSource): boolean {
  return nonEmpty(source.output)
    && SOURCE_KINDS.has(source.sourceKind)
    && nonEmpty(source.sourceHost)
    && Array.isArray(source.regions)
    && source.regions.every(nonEmpty)
    && validCoverage(source.coverage)
    && validProvenance(source.provenanceIds);
}
function validReviewedSource(
  source: ReviewedAcquisitionSource,
): source is ReviewedAcquisitionSource & Required<Pick<
  ReviewedAcquisitionSource,
  'outputQuantity' | 'requirements' | 'repeatability' | 'probability' | 'locationId'
>> {
  if (!validReviewedDescriptor(source)
    || !source.locationId
    || !positiveInteger(source.outputQuantity)
    || !validRepeatability(source.repeatability)
    || !validProbability(source.probability)
    || !validProvenance(source.provenanceIds)) return false;
  try {
    assertRequirementExpr(source.requirements);
    return true;
  } catch {
    return false;
  }
}

function unresolvedProduction(
  recipe: AuditedProductionRecipe,
  reason: UnresolvedAcquisitionReason,
): UnresolvedAcquisitionSource {
  return {
    id: unresolvedId(recipe.output, 'PRODUCTION', recipe.sourceHost, recipe.provenanceIds),
    output: recipe.output,
    sourceKind: 'PRODUCTION',
    sourceHost: recipe.sourceHost,
    regions: [],
    coverage: unresolvedCoverage(recipe.coverage),
    reason,
    provenanceIds: sortedUnique(recipe.provenanceIds),
  };
}

function unresolvedReviewed(
  source: ReviewedAcquisitionSource,
  reason: UnresolvedAcquisitionReason,
): UnresolvedAcquisitionSource {
  return {
    id: unresolvedId(
      source.output,
      source.sourceKind,
      source.sourceHost,
      source.provenanceIds,
    ),
    output: source.output,
    sourceKind: source.sourceKind,
    sourceHost: source.sourceHost,
    regions: sortedUnique(source.regions),
    coverage: unresolvedCoverage(source.coverage),
    reason,
    provenanceIds: sortedUnique(source.provenanceIds),
  };
}

function unresolvedId(
  output: string,
  sourceKind: SourceKind,
  sourceHost: string,
  provenanceIds: readonly string[],
): string {
  const identity = [
    output, sourceKind, sourceHost, ...sortedUnique(provenanceIds),
  ];
  return `unresolved:${identity.map(normalizeId).join('-')}:${stableFingerprint(identity)}`;
}

interface RawAcquisitionCandidate {
  output: string;
  sourceKind: 'SHOP' | 'DROP' | 'SPAWN';
  sourceHost: string;
  regionIds: number[];
  provenanceIds: string[];
}

function buildRawCandidates(
  input: AcquisitionCompilerInput,
  transformProvenance: ReadonlyMap<string, string[]>,
): RawAcquisitionCandidate[] {
  const shopRegions = new Map<string, Set<number>>();
  const dropRegions = new Map<string, Set<number>>();
  const spawnRegions = new Map<string, Set<number>>();
  for (const [regionKey, chunk] of Object.entries(input.chunks)) {
    const regionId = Number(regionKey);
    if (!Number.isSafeInteger(regionId) || regionId < 0) continue;
    for (const host of sortedUnique(chunk.s ?? [])) addRegion(shopRegions, host, regionId);
    for (const [host] of chunk.m ?? []) addRegion(dropRegions, host, regionId);
    for (const output of sortedUnique(chunk.i ?? [])) addRegion(spawnRegions, output, regionId);
  }

  const candidates: RawAcquisitionCandidate[] = [];
  for (const [sourceHost, outputs] of Object.entries(input.shopItems)) {
    for (const output of sortedUnique(outputs)) {
      candidates.push(rawCandidate(
        output, 'SHOP', sourceHost, shopRegions.get(sourceHost),
        transformProvenance.get(`shopItems\u0000${sourceHost}`) ?? [],
      ));
    }
  }
  for (const [sourceHost, outputs] of Object.entries(input.drops)) {
    for (const output of sortedUnique(outputs)) {
      candidates.push(rawCandidate(
        output, 'DROP', sourceHost, dropRegions.get(sourceHost),
        transformProvenance.get(`drops\u0000${sourceHost}`) ?? [],
      ));
    }
  }
  for (const [output, regions] of spawnRegions) {
    candidates.push(rawCandidate(
      output, 'SPAWN', `${output} floor spawn`, regions, [],
    ));
  }
  return candidates.sort((left, right) => compareText(
    `${left.sourceKind}\u0000${left.sourceHost}\u0000${left.output}`,
    `${right.sourceKind}\u0000${right.sourceHost}\u0000${right.output}`,
  ));
}

function addRegion(
  regionsByHost: Map<string, Set<number>>,
  host: string,
  regionId: number,
): void {
  regionsByHost.set(host, new Set([...(regionsByHost.get(host) ?? []), regionId]));
}

function rawCandidate(
  output: string,
  sourceKind: RawAcquisitionCandidate['sourceKind'],
  sourceHost: string,
  regions: ReadonlySet<number> | undefined,
  provenanceIds: readonly string[],
): RawAcquisitionCandidate {
  const regionIds = [...(regions ?? [])].sort((left, right) => left - right);
  return {
    output,
    sourceKind,
    sourceHost,
    regionIds,
    provenanceIds: sortedUnique([
      ...regionIds.map(regionId => `chunk:${regionId}`),
      ...provenanceIds,
    ]),
  };
}

function unresolvedRawCandidate(
  candidate: RawAcquisitionCandidate,
): UnresolvedAcquisitionSource {
  return {
    id: unresolvedId(
      candidate.output, candidate.sourceKind, candidate.sourceHost,
      candidate.provenanceIds,
    ),
    output: candidate.output,
    sourceKind: candidate.sourceKind,
    sourceHost: candidate.sourceHost,
    regions: candidate.regionIds.map(surfaceChunkForRegionId),
    coverage: 'UNKNOWN',
    reason: 'NO_PROOF_GRADE_LOCATION',
    provenanceIds: candidate.provenanceIds,
  };
}

function surfaceChunkForRegionId(regionId: number): string {
  return `${Math.floor(regionId / 256)},${regionId % 256}`;
}

function dedupeUnresolved(
  unresolved: readonly UnresolvedAcquisitionSource[],
): UnresolvedAcquisitionSource[] {
  const byEvidence = new Map<string, UnresolvedAcquisitionSource>();
  for (const source of unresolved.map(canonicalUnresolved)) {
    byEvidence.set(JSON.stringify(source), source);
  }
  return [...byEvidence.values()].sort(byId);
}
function buildTransformProvenance(
  events: readonly AcquisitionTransformEvent[],
): Map<string, string[]> {
  const byTarget = new Map<string, string[]>();
  for (const event of events) {
    if (!event.terminal
      || (event.category !== 'shopItems' && event.category !== 'drops')) continue;
    const provenance = `transform:${event.category}:${event.sourceKey}`;
    for (const target of event.targetKeys) {
      const key = `${event.category}\u0000${target}`;
      const values = byTarget.get(key) ?? [];
      values.push(provenance);
      byTarget.set(key, sortedUnique(values));
    }
  }
  return byTarget;
}

function familyAccounting(
  rules: readonly AcquisitionRule[],
  unresolved: readonly UnresolvedAcquisitionSource[],
): Record<AcquisitionSourceFamily, SourceFamilyAccounting> {
  const result = {} as Record<AcquisitionSourceFamily, SourceFamilyAccounting>;
  for (const family of SOURCE_FAMILIES) {
    const familyRules = rules.filter(rule => belongsToFamily(rule, family));
    const familyUnresolved = unresolved.filter(source => belongsToFamily(source, family));
    const ruleIds = familyRules.map(rule => rule.id);
    const unresolvedIds = familyUnresolved.map(source => source.id);
    let coverage: Coverage;
    if (ruleIds.length === 0 && unresolvedIds.length === 0) {
      coverage = 'UNKNOWN';
    } else if (familyUnresolved.some(source => source.coverage === 'UNKNOWN')
      || familyRules.some(rule => rule.coverage === 'UNKNOWN')) {
      coverage = 'UNKNOWN';
    } else if (familyUnresolved.length > 0
      || familyRules.some(rule => rule.coverage === 'PARTIAL')) {
      coverage = 'PARTIAL';
    } else {
      coverage = 'VERIFIED';
    }
    result[family] = {
      ruleCount: ruleIds.length,
      unresolvedCount: unresolvedIds.length,
      ruleIds,
      unresolvedIds,
      coverage,
    };
  }
  return result;
}

function belongsToFamily(
  source: Pick<AcquisitionRule, 'sourceKind' | 'provenanceIds'>
    | Pick<UnresolvedAcquisitionSource, 'sourceKind' | 'provenanceIds'>,
  family: AcquisitionSourceFamily,
): boolean {
  return family === 'RESOURCE_ENGINE'
    ? source.provenanceIds.some(provenance => provenance.startsWith('resource-map:'))
    : source.sourceKind === family;
}
function overallCoverage(
  families: Readonly<Record<AcquisitionSourceFamily, Coverage>>,
  unresolved: readonly UnresolvedAcquisitionSource[],
): Coverage {
  const values = Object.values(families);
  if (unresolved.length > 0) return 'PARTIAL';
  if (values.every(value => value === 'VERIFIED')) return 'VERIFIED';
  return values.every(value => value === 'UNKNOWN') ? 'UNKNOWN' : 'PARTIAL';
}

function unresolvedCoverage(coverage: Coverage): Coverage {
  return coverage === 'UNKNOWN' ? 'UNKNOWN' : 'PARTIAL';
}
function combineCoverage(left: Coverage, right: Coverage): Coverage {
  if (left === 'UNKNOWN' || right === 'UNKNOWN') return 'UNKNOWN';
  if (left === 'PARTIAL' || right === 'PARTIAL') return 'PARTIAL';
  return 'VERIFIED';
}

function groupBy<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): ReadonlyMap<string, readonly T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const key = keyFor(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return new Map(
    [...groups.entries()]
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, group]) => [key, group]),
  );
}

function productionOrder(
  left: AuditedProductionRecipe,
  right: AuditedProductionRecipe,
): number {
  return compareText(
    `${left.output}\u0000${left.sourceHost}\u0000${left.locationId}`,
    `${right.output}\u0000${right.sourceHost}\u0000${right.locationId}`,
  );
}

function reviewedOrder(
  left: ReviewedAcquisitionSource,
  right: ReviewedAcquisitionSource,
): number {
  return compareText(
    `${left.output}\u0000${left.sourceKind}\u0000${left.sourceHost}`,
    `${right.output}\u0000${right.sourceKind}\u0000${right.sourceHost}`,
  );
}

function byId<T extends { id: string }>(left: T, right: T): number {
  return compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function stableFingerprint(values: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const value of values.join('\u0000')) {
    hash ^= value.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validProbability(value: unknown): value is number | null {
  return value === null
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
}

function validRepeatability(
  value: unknown,
): value is AcquisitionRule['repeatability'] {
  return value === 'REPEATABLE' || value === 'ONE_TIME' || value === 'UNKNOWN';
}

function validCoverage(value: unknown): value is Coverage {
  return value === 'VERIFIED' || value === 'PARTIAL' || value === 'UNKNOWN';
}

function validProvenance(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty);
}
