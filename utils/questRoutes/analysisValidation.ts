import type { QuestPreparationRouteAnalysis } from './analyzeQuest';

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): boolean => finite(value) && value > 0;
const nonnegative = (value: unknown): boolean => finite(value) && value >= 0;
const bool = (value: unknown): boolean => typeof value === 'boolean';
const optional = (value: unknown, check: (value: unknown) => boolean): boolean => value === undefined || check(value);
const list = (value: unknown, check: (value: unknown) => boolean): boolean => Array.isArray(value) && value.every(check);
const chunk = (value: unknown): boolean => typeof value === 'string' && /^-?\d+,-?\d+$/.test(value);
const sourceKind = (value: unknown): boolean => ['SPAWN', 'SHOP', 'DROP', 'GATHER', 'RECIPE'].includes(value as string);
const itemRef = (value: unknown): boolean => record(value) && text(value.key) && text(value.name);
const gate = (value: unknown): boolean => {
  if (!record(value) || !text(value.label)) return false;
  switch (value.type) {
    case 'QUEST': return text(value.questId);
    case 'SKILL': return text(value.skill) && positive(value.level);
    case 'UNLOCK': return text(value.id) && ['guilds', 'merchants', 'minigames', 'mobility', 'slayerUnlocks'].includes(value.category as string);
    case 'UNRESOLVED': return text(value.raw);
    default: return false;
  }
};
const step = (value: unknown): boolean => record(value)
  && text(value.id) && text(value.label) && optional(value.chunk, chunk)
  && list(value.gates, gate) && optional(value.blockers, gates => list(gates, gate))
  && optional(value.sourceKind, sourceKind) && optional(value.quantity, positive)
  && optional(value.consumed, bool) && bool(value.requiresChunkUnlock) && bool(value.hasDataGap);
const route = (value: unknown): boolean => record(value)
  && text(value.id) && itemRef(value.item) && positive(value.outputQuantity)
  && sourceKind(value.sourceKind) && text(value.sourceLabel) && list(value.chunks, chunk)
  && list(value.steps, step) && list(value.blockers, gate) && bool(value.deterministic)
  && optional(value.probability, probability => finite(probability) && probability > 0 && probability <= 1)
  && ['recursiveCost', 'consumedIngredientCost', 'skillUnlockCost', 'skillLevelCost', 'travelCost'].every(key => nonnegative(value[key]))
  && optional(value.travelCostEstimated, bool) && bool(value.hasDataGap);
const requirement = (value: unknown): boolean => record(value)
  && itemRef(value.item) && positive(value.quantity)
  && ['PLAYER_OBTAINED', 'QUEST_PROVIDED'].includes(value.supplyPolicy as string)
  && optional(value.alternatives, alternatives => list(alternatives, itemRef))
  && optional(value.note, note => typeof note === 'string');
const item = (value: unknown): boolean => record(value)
  && requirement(value.requirement)
  && ['OBTAINABLE_NOW', 'ROUTE_BLOCKED', 'NO_CURRENT_SOURCE', 'DATA_INCOMPLETE'].includes(value.state as string)
  && list(value.currentRoutes, route) && list(value.missingChunkRoutes, route)
  && list(value.missingChunkOptions, option => record(option) && list(option.chunks, chunk)
    && list(option.routeIds, text) && list(option.remainingGates, gate))
  && list(value.dataNotes, note => typeof note === 'string');

const walkthroughBlocker = (value: unknown): boolean => {
  if (!record(value) || !text(value.label)) return false;
  switch (value.kind) {
    case 'CHUNK': return chunk(value.chunk);
    case 'ITEM': return text(value.itemKey);
    case 'GATE': return gate(value.gate);
    case 'DEPENDENCY': return text(value.actionId);
    case 'LOCATION': return true;
    default: return false;
  }
};
const walkthrough = (value: unknown): boolean => record(value)
  && text(value.questId) && ['READY', 'BLOCKED', 'INCOMPLETE'].includes(value.status as string)
  && bool(value.hasIncompleteEvidence) && list(value.blockers, walkthroughBlocker)
  && record(value.source) && text(value.source.wikiTitle) && text(value.source.wikiUrl)
  && text(value.source.wikiLicence) && text(value.source.wikiLicenceUrl)
  && list(value.sourceLines, line => record(line) && text(line.id) && typeof line.rawText === 'string')
  && list(value.actions, action => record(action)
    && record(action.definition) && text(action.definition.id) && text(action.definition.displayText)
    && ['PREPARE', 'QUEST'].includes(action.definition.section as string)
    && nonnegative(action.definition.sourceOrder) && list(action.definition.rawWikiLineIds, text)
    && list(action.definition.items, requirement) && list(action.definition.dependsOn, text)
    && record(action.location) && list(action.location.chunks, chunk) && list(action.location.candidateChunks, chunk)
    && ['EXACT', 'REVIEWED', 'AMBIGUOUS', 'UNMAPPED'].includes(action.location.confidence as string)
    && ['EXPLICIT_CHUNK', 'EXACT_ENTITY', 'INHERITED_TARGET', 'REVIEWED_ALIAS', 'NONE'].includes(action.location.evidenceKind as string)
    && typeof action.location.explanation === 'string'
    && ['READY_HERE', 'REQUIREMENT_MISSING', 'CHUNK_LOCKED', 'LOCATION_NEEDS_REVIEW', 'ITEM_EVIDENCE_INCOMPLETE', 'INFORMATION'].includes(action.state as string)
    && list(action.blockers, walkthroughBlocker)
    && list(action.itemPreparation, item => record(item) && text(item.itemKey) && text(item.analysisState) && bool(item.obtainableNow)));

/** Validate the preparation payload before any route consumer dereferences it.
 * Unknown enum values and malformed nested evidence must never become ready UI.
 */
export function isQuestAnalysisUsable(analysis: unknown): analysis is QuestPreparationRouteAnalysis {
  return record(analysis) && text(analysis.questId)
    && ['READY_NOW', 'CANNOT_COMPLETE_YET', 'ANALYSIS_INCOMPLETE'].includes(analysis.status as string)
    && list(analysis.items, item) && optional(analysis.walkthrough, walkthrough) && record(analysis.generatedFrom)
    && nonnegative(analysis.generatedFrom.chunkDataVersion)
    && text(analysis.generatedFrom.questRevision) && text(analysis.generatedFrom.accountFingerprint);
}
