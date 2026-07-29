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

export type AcquisitionProvenanceKind =
  | 'CHUNK'
  | 'TRANSFORM'
  | 'RESOURCE_MAP'
  | 'RECIPE_AUDIT'
  | 'LOCATION'
  | 'UNKNOWN';

export interface AcquisitionRuleProvenancePayload {
  type: 'RULE';
  output: string;
  outputQuantity: number;
  sourceKind: SourceKind;
  sourceLabel: string;
  locationId: string;
  requirements: RequirementExpr;
  repeatability: AcquisitionRule['repeatability'];
  probability: number | null;
  declaredCoverage: Coverage;
  sourceIds: string[];
}

export interface AcquisitionUnresolvedProvenancePayload {
  type: 'UNRESOLVED';
  output: string;
  sourceKind: SourceKind;
  sourceLabel: string;
  regions: string[];
  reason: UnresolvedAcquisitionReason;
  declaredCoverage: Coverage;
  sourceIds: string[];
}

export type AcquisitionProvenancePayload =
  | AcquisitionRuleProvenancePayload
  | AcquisitionUnresolvedProvenancePayload;

export interface AcquisitionProvenanceEntry {
  id: string;
  kind: AcquisitionProvenanceKind;
  coverage: Coverage;
  ruleIds: string[];
  unresolvedIds: string[];
  locationId?: string;
  surfaceChunk?: string;
  parentId?: string | null;
  payload?: AcquisitionProvenancePayload;
}
export interface TrustedAcquisitionSourceEntry {
  id: string;
  kind: 'RESOURCE_MAP' | 'RECIPE_AUDIT';
  coverage: Coverage;
  provenanceIds: string[];
}

export interface TrustedAcquisitionSourceCatalog {
  schemaVersion: 1;
  sourceVersion: string;
  entries: TrustedAcquisitionSourceEntry[];
}

export interface AcquisitionCompilerArtifacts {
  document: RuneProofSourceDocument;
  trustedCatalog: TrustedAcquisitionSourceCatalog;
}

export interface RuneProofSourceDocument {
  schemaVersion: 1;
  sourceVersion: string;
  counts: { rules: number; unresolvedSources: number };
  acquisitionCoverage: Coverage;
  sourceFamilyCoverage: Record<AcquisitionSourceFamily, Coverage>;
  sourceFamilyAccounting: Record<AcquisitionSourceFamily, SourceFamilyAccounting>;
  provenanceCatalog: AcquisitionProvenanceEntry[];
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
  return compileAcquisitionArtifacts(input).document;
}

export function compileAcquisitionArtifacts(
  input: AcquisitionCompilerInput,
): AcquisitionCompilerArtifacts {
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
    const locationBindings = candidate.regionIds.map(regionId => ({
      regionId,
      location: validatedLocations.surfaceNodes.get(surfaceChunkForRegionId(regionId)),
    }));
    const exactLocations = locationBindings
      .filter((entry): entry is { regionId: number; location: LocationNodeSource } =>
        Boolean(entry.location));
    const unresolvedRegionIds = locationBindings
      .filter(entry => !entry.location).map(entry => entry.regionId);

    if (candidate.regionIds.length === 0 || unresolvedRegionIds.length > 0) {
      unresolved.push(unresolvedRawCandidate(candidate, unresolvedRegionIds));
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
        provenanceIds: sortedUnique([
          ...candidate.provenanceIds, 'chunk:' + regionId,
          'location:' + location.id,
        ]),
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
      coverage: combineAllCoverage([
        recipe.coverage, location.coverage,
        recognizedProvenanceCoverage(recipe.provenanceIds, 'recipe-audit:', recipe.coverage),
      ]),
      provenanceIds: sortedUnique([
        ...recipe.provenanceIds, 'location:' + location.id,
      ]),
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
      coverage: combineAllCoverage([
        source.coverage, location.coverage,
        recognizedProvenanceCoverage(source.provenanceIds, 'resource-map:', source.coverage),
      ]),
      provenanceIds: sortedUnique([
        ...source.provenanceIds, 'location:' + location.id,
      ]),
    });
  }

  const trustedRawSources = buildTrustedRawSources(input);
  const provenancePayloads = new Map<string, AcquisitionProvenancePayload>();
  const emittedRules = [...rules.values()].sort(byId).map(rule =>
    canonicalizeRuleSourceProvenance(rule, provenancePayloads, trustedRawSources));
  const unresolvedSources = dedupeUnresolved(unresolved).map(source =>
    canonicalizeUnresolvedSourceProvenance(
      source, provenancePayloads, trustedRawSources,
    ));
  const sourceFamilyAccounting = familyAccounting(emittedRules, unresolvedSources);
  const sourceFamilyCoverage = Object.fromEntries(SOURCE_FAMILIES.map(family => [
    family, sourceFamilyAccounting[family].coverage,
  ])) as Record<AcquisitionSourceFamily, Coverage>;
  const provenanceCatalog = buildProvenanceCatalog(
    locations, emittedRules, unresolvedSources, provenancePayloads,
  );

  const documentCoverage = provenanceCatalog.some(entry => entry.kind === 'UNKNOWN')
    ? 'UNKNOWN' : overallCoverage(sourceFamilyCoverage, unresolvedSources);
  const contents = {
    schemaVersion: 1 as const,
    counts: { rules: emittedRules.length, unresolvedSources: unresolvedSources.length },
    acquisitionCoverage: documentCoverage,
    sourceFamilyCoverage,
    sourceFamilyAccounting,
    provenanceCatalog,
    rules: emittedRules,
    unresolvedSources,
  };
  const document = {
    ...contents,
    sourceVersion: `sha256-${sha256HexSync(canonicalDocumentJson(contents))}`,
  };
  return {
    document,
    trustedCatalog: buildTrustedAcquisitionSourceCatalog(
      trustedRawSources, provenancePayloads,
    ),
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

interface TrustedRawAcquisitionSource {
  id: string;
  kind: 'RESOURCE_MAP' | 'RECIPE_AUDIT';
  coverage: Coverage;
}

function buildTrustedRawSources(
  input: AcquisitionCompilerInput,
): Map<string, TrustedRawAcquisitionSource> {
  const result = new Map<string, TrustedRawAcquisitionSource>();
  const add = (
    id: string,
    kind: TrustedRawAcquisitionSource['kind'],
    coverage: Coverage,
  ) => {
    const expectedPrefix = kind === 'RECIPE_AUDIT' ? 'recipe-audit:' : 'resource-map:';
    if (!id.startsWith(expectedPrefix)) return;
    const existing = result.get(id);
    if (existing && existing.kind !== kind) {
      throw new Error(`Conflicting trusted acquisition source kind for ${id}`);
    }
    result.set(id, {
      id,
      kind,
      coverage: combineCoverage(existing?.coverage ?? 'VERIFIED', coverage),
    });
  };
  for (const recipe of input.productionRecipes) {
    for (const id of sortedUnique(recipe.provenanceIds)) {
      add(id, 'RECIPE_AUDIT', validCoverage(recipe.coverage) ? recipe.coverage : 'UNKNOWN');
    }
  }
  for (const source of input.reviewedSources) {
    for (const id of sortedUnique(source.provenanceIds)) {
      add(id, 'RESOURCE_MAP', validCoverage(source.coverage) ? source.coverage : 'UNKNOWN');
    }
  }
  return result;
}

function trustedSourceCoverage(
  sourceIds: readonly string[],
  expectedKind: TrustedRawAcquisitionSource['kind'],
  trustedSources: ReadonlyMap<string, TrustedRawAcquisitionSource>,
): Coverage {
  let coverage: Coverage = 'VERIFIED';
  for (const id of sourceIds) {
    const trusted = trustedSources.get(id);
    if (!trusted || trusted.kind !== expectedKind) return 'UNKNOWN';
    coverage = combineCoverage(coverage, trusted.coverage);
  }
  return coverage;
}

function buildTrustedAcquisitionSourceCatalog(
  trustedSources: ReadonlyMap<string, TrustedRawAcquisitionSource>,
  payloads: ReadonlyMap<string, AcquisitionProvenancePayload>,
): TrustedAcquisitionSourceCatalog {
  const provenanceByRawId = new Map<string, string[]>();
  for (const [provenanceId, payload] of payloads) {
    for (const rawId of payload.sourceIds) {
      const trusted = trustedSources.get(rawId);
      const kind = provenanceId.startsWith('recipe-audit:')
        ? 'RECIPE_AUDIT' : 'RESOURCE_MAP';
      if (!trusted || trusted.kind !== kind) continue;
      provenanceByRawId.set(rawId, sortedUnique([
        ...(provenanceByRawId.get(rawId) ?? []), provenanceId,
      ]));
    }
  }
  const entries = [...trustedSources.values()]
    .filter(source => (provenanceByRawId.get(source.id)?.length ?? 0) > 0)
    .sort((left, right) => compareText(left.id, right.id))
    .map(source => ({
      id: source.id,
      kind: source.kind,
      coverage: source.coverage,
      provenanceIds: provenanceByRawId.get(source.id)!,
    }));
  const contents = { schemaVersion: 1 as const, entries };
  return {
    ...contents,
    sourceVersion: `sha256-${sha256HexSync(canonicalDocumentJson(contents))}`,
  };
}

function canonicalizeRuleSourceProvenance(
  rule: AcquisitionRule,
  payloads: Map<string, AcquisitionProvenancePayload>,
  trustedSources: ReadonlyMap<string, TrustedRawAcquisitionSource>,
): AcquisitionRule {
  const recipeIds = rule.provenanceIds.filter(id => id.startsWith('recipe-audit:'));
  const resourceIds = rule.provenanceIds.filter(id => id.startsWith('resource-map:'));
  const prefix = recipeIds.length > 0 ? 'recipe-audit:' : 'resource-map:';
  const sourceIds = sortedUnique(recipeIds.length > 0 ? recipeIds : resourceIds);
  if (sourceIds.length === 0) return canonicalRule(rule);
  const payload: AcquisitionRuleProvenancePayload = {
    type: 'RULE',
    output: rule.output.label,
    outputQuantity: rule.outputQuantity,
    sourceKind: rule.sourceKind,
    sourceLabel: rule.sourceLabel,
    locationId: rule.locationId,
    requirements: canonicalRequirement(rule.requirements),
    repeatability: rule.repeatability,
    probability: rule.probability,
    declaredCoverage: trustedSourceCoverage(
      sourceIds,
      prefix === 'recipe-audit:' ? 'RECIPE_AUDIT' : 'RESOURCE_MAP',
      trustedSources,
    ),
    sourceIds,
  };
  const id = catalogSourceId(prefix, payload);
  payloads.set(id, payload);
  return canonicalRule({
    ...rule,
    provenanceIds: [
      ...rule.provenanceIds.filter(provenanceId => !sourceIds.includes(provenanceId)),
      id,
    ],
  });
}

function canonicalizeUnresolvedSourceProvenance(
  source: UnresolvedAcquisitionSource,
  payloads: Map<string, AcquisitionProvenancePayload>,
  trustedSources: ReadonlyMap<string, TrustedRawAcquisitionSource>,
): UnresolvedAcquisitionSource {
  const recipeIds = source.provenanceIds.filter(id => id.startsWith('recipe-audit:'));
  const resourceIds = source.provenanceIds.filter(id => id.startsWith('resource-map:'));
  const prefix = recipeIds.length > 0 ? 'recipe-audit:' : 'resource-map:';
  const sourceIds = sortedUnique(recipeIds.length > 0 ? recipeIds : resourceIds);
  if (sourceIds.length === 0) return canonicalUnresolved(source);
  const payload: AcquisitionUnresolvedProvenancePayload = {
    type: 'UNRESOLVED',
    output: source.output,
    sourceKind: source.sourceKind,
    sourceLabel: source.sourceHost,
    regions: sortedUnique(source.regions),
    reason: source.reason,
    declaredCoverage: trustedSourceCoverage(
      sourceIds,
      prefix === 'recipe-audit:' ? 'RECIPE_AUDIT' : 'RESOURCE_MAP',
      trustedSources,
    ),
    sourceIds,
  };
  const id = catalogSourceId(prefix, payload);
  payloads.set(id, payload);
  return canonicalUnresolved({
    ...source,
    provenanceIds: [
      ...source.provenanceIds.filter(provenanceId => !sourceIds.includes(provenanceId)),
      id,
    ],
  });
}

function catalogSourceId(
  prefix: 'recipe-audit:' | 'resource-map:',
  payload: AcquisitionProvenancePayload,
): string {
  return `${prefix}sha256-${sha256HexSync(canonicalDocumentJson(payload))}`;
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
    provenanceIds: sortedUnique(provenanceIds),
  };
}

function unresolvedRawCandidate(
  candidate: RawAcquisitionCandidate,
  unresolvedRegionIds: readonly number[],
): UnresolvedAcquisitionSource {
  const regionIds = candidate.regionIds.length === 0 ? [] : [...unresolvedRegionIds];
  const provenanceIds = sortedUnique([
    ...candidate.provenanceIds,
    ...regionIds.map(regionId => `chunk:${regionId}`),
  ]);
  return {
    id: unresolvedId(
      candidate.output, candidate.sourceKind, candidate.sourceHost, provenanceIds,
    ),
    output: candidate.output,
    sourceKind: candidate.sourceKind,
    sourceHost: candidate.sourceHost,
    regions: regionIds.map(surfaceChunkForRegionId),
    coverage: 'UNKNOWN',
    reason: 'NO_PROOF_GRADE_LOCATION',
    provenanceIds,
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

function recognizedProvenanceCoverage(
  provenanceIds: readonly string[],
  prefix: string,
  declaredCoverage: Coverage,
): Coverage {
  return provenanceIds.length > 0 && provenanceIds.every(id => id.startsWith(prefix))
    ? declaredCoverage : 'UNKNOWN';
}

function buildProvenanceCatalog(
  locations: ReadonlyMap<string, LocationNodeSource>,
  rules: readonly AcquisitionRule[],
  unresolved: readonly UnresolvedAcquisitionSource[],
  provenancePayloads: ReadonlyMap<string, AcquisitionProvenancePayload>,
): AcquisitionProvenanceEntry[] {
  const usedIdSet = new Set([...rules, ...unresolved]
    .flatMap(source => source.provenanceIds));
  for (const id of [...usedIdSet]) {
    if (!id.startsWith('location:')) continue;
    let location = locations.get(id.slice('location:'.length));
    while (location?.parentId) {
      usedIdSet.add(`location:${location.parentId}`);
      location = locations.get(location.parentId);
    }
  }
  const usedIds = sortedUnique([...usedIdSet]);

  return usedIds.map(id => {
    const membership = {
      ruleIds: rules.filter(rule => rule.provenanceIds.includes(id)).map(rule => rule.id),
      unresolvedIds: unresolved.filter(source => source.provenanceIds.includes(id))
        .map(source => source.id),
    };
    if (id.startsWith('location:')) {
      const location = locations.get(id.slice('location:'.length));
      return {
        id,
        kind: 'LOCATION',
        coverage: location?.coverage ?? 'UNKNOWN',
        locationId: location?.id ?? id.slice('location:'.length),
        surfaceChunk: location?.surfaceChunk ?? '',
        parentId: location?.parentId ?? null,
        ...membership,
      };
    }
    if (/^chunk:\d+$/.test(id)) return { id, kind: 'CHUNK', coverage: 'PARTIAL', ...membership };
    if (/^transform:(shopItems|drops):.+/.test(id)) {
      return { id, kind: 'TRANSFORM', coverage: 'PARTIAL', ...membership };
    }
    if (id.startsWith('resource-map:')) {
      const payload = provenancePayloads.get(id);
      return {
        id, kind: 'RESOURCE_MAP', coverage: payload?.declaredCoverage ?? 'UNKNOWN',
        payload, ...membership,
      };
    }
    if (id.startsWith('recipe-audit:')) {
      const payload = provenancePayloads.get(id);
      return {
        id, kind: 'RECIPE_AUDIT', coverage: payload?.declaredCoverage ?? 'UNKNOWN',
        payload, ...membership,
      };
    }
    return { id, kind: 'UNKNOWN', coverage: 'UNKNOWN', ...membership };
  });
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

function unresolvedCoverage(_coverage: Coverage): Coverage {
  return 'UNKNOWN';
}
function combineAllCoverage(values: readonly Coverage[]): Coverage {
  return values.reduce(combineCoverage, 'VERIFIED');
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

const SHA256_INITIAL = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function canonicalDocumentJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalDocumentJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalDocumentJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256HexSync(message: string): string {
  const source = new TextEncoder().encode(message);
  const paddedLength = Math.ceil((source.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(source);
  bytes[source.length] = 0x80;
  let bitLength = BigInt(source.length) * 8n;
  for (let offset = 0; offset < 8; offset += 1) {
    bytes[paddedLength - 1 - offset] = Number(bitLength & 0xffn);
    bitLength >>= 8n;
  }

  const hash = new Uint32Array(SHA256_INITIAL);
  const words = new Uint32Array(64);
  const view = new DataView(bytes.buffer);
  for (let block = 0; block < bytes.length; block += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(block + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18)
        ^ (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19)
        ^ (previous2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_CONSTANTS[index]
        + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return [...hash].map(value => value.toString(16).padStart(8, '0')).join('');
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}