import { questProvidedItem } from '../../data/questProvidedItems';
import type { QuestData, QuestLocationRequirement } from '../../data/questData';
import { sourcedQuestItemPredicates } from '../../data/questOperationalSources';
import itemSourceClauses from '../../data/questOperationalChecks.json';
import { questOperationalRequirements } from '../../data/questOperationalRequirements';
import type { UnlockState } from '../../types';
import { evaluateQuestEligibility } from '../../utils/journalStatus';
import { isAreaReachable } from '../../utils/reachability';
import { chunkKey, isChunkUnlocked } from '../../utils/chunkAdjacency';
import { evaluatePredicate, type RequirementPredicate, type RequirementCertainty } from '../../utils/requirementPredicates';
import type { ChunkQuestLocation } from '../../utils/questChunkGeography';

export interface QuestAccessNode {
  id: string;
  label: string;
  kind: 'all' | 'any' | 'area' | 'guild' | 'chunk' | 'permission' | 'unknown';
  status: 'met' | 'locked' | 'unknown';
  children?: QuestAccessNode[];
  cx?: number;
  cy?: number;
}
export interface QuestAccessClause {
  /** Original whole source clause, without presentation guidance; never split into inventory demands. */
  sourceText?: string;
  questSupplier?: string;
  id: string;
  label: string;
  status: RequirementCertainty;
  predicate: RequirementPredicate;
}
export interface QuestAccessModel {
  questId: string;
  name: string;
  mode: 'standard' | 'chunked';
  eligibility: ReturnType<typeof evaluateQuestEligibility>;
  /** Destination ownership/access permissions only: this does not prove a walking route. */
  geography: QuestAccessNode;
  /** Complete source clauses, including quantities and alternatives; not parsed inventory demands. */
  items: QuestAccessClause[];
  operations: QuestAccessClause[];
}

const group = (id: string, label: string, kind: 'all' | 'any', children: QuestAccessNode[]): QuestAccessNode => ({
  id, label, kind, children,
  status: !children.length ? 'unknown' : kind === 'all'
    ? children.some(child => child.status === 'locked') ? 'locked' : children.some(child => child.status === 'unknown') ? 'unknown' : 'met'
    : children.some(child => child.status === 'met') ? 'met' : children.some(child => child.status === 'unknown') ? 'unknown' : 'locked',
});
const unknown = (id: string, label: string): QuestAccessNode => ({ id, label, kind: 'unknown', status: 'unknown' });

/** Identity must not depend on failure messages, which disappear once a gate is met.
 * Keep every alternative visible instead of displaying only the evaluator's preferred branch.
 */
function predicateLabel(predicate: RequirementPredicate): string {
  switch (predicate.kind) {
    case 'all': return `All required: ${predicate.of.map(predicateLabel).join('; ')}`;
    case 'any': return `One complete alternative: ${predicate.of.map(entry => `(${predicateLabel(entry)})`).join(' OR ')}`;
    case 'unlock': return `Unlock: ${predicate.id}`;
    case 'skill': return `${predicate.skill} level ${predicate.level}`;
    case 'combinedSkills': return `${predicate.skills.join(' + ')} combined level ${predicate.level}`;
    case 'method': return `${predicate.skill} method tier ${predicate.tier}`;
    case 'equipment': return predicate.label ?? `${predicate.slot} equipment tier ${predicate.tier}`;
    case 'quest': return `Complete ${predicate.id}`;
    case 'diary': return `Complete ${predicate.id}`;
    case 'area': return `Access: ${predicate.id}`;
    case 'questPoints': return `${predicate.count} quest points`;
    case 'item': return `${predicate.label}: available and legal to ${predicate.usage}`;
    default: return predicate.label;
  }
}

/** A display adapter over the existing rules, not a second quest readiness engine. */
export function buildQuestAccess(quest: QuestData, unlocks: UnlockState, gameModeId?: string): QuestAccessModel {
  const chunked = gameModeId === 'chunked';
  const area = (id: string, label: string): QuestAccessNode => ({
    id, label, kind: 'area', status: isAreaReachable(label, unlocks, gameModeId) ? 'met' : 'locked',
  });
  const chunks = (location: ChunkQuestLocation): QuestAccessNode => group(location.id, location.label, 'any',
    (location.chunkOptions ?? []).map(({ cx, cy }, index) => Number.isInteger(cx) && Number.isInteger(cy) && cx >= 0 && cy >= 0 && cx <= 255 && cy <= 255
      ? { id: `${location.id}:${index}`, label: `${cx}, ${cy}`, kind: 'chunk', cx, cy, status: isChunkUnlocked(chunkKey({ cx, cy }), unlocks.chunks ?? []) ? 'met' : 'locked' }
      : unknown(`${location.id}:${index}`, 'Unverified chunk coordinates')));
  const location = (entry: QuestLocationRequirement): QuestAccessNode => chunked ? chunks(entry)
    : group(entry.id, entry.label, 'all', entry.standardAreas.map((label, index) => area(`${entry.id}:${index}`, label)));
  const fixed: QuestAccessNode[] = [];
  if (chunked && quest.chunkedGeography) {
    const data = quest.chunkedGeography;
    fixed.push(...data.locations.map(chunks));
    fixed.push(...data.groups.map(entry => group(entry.id, entry.label, 'any', entry.routes.map(route => group(route.id, route.label, 'all', [
      ...route.locations.map(chunks), ...(route.requirements ?? []).map((predicate, index): QuestAccessNode => {
        const result = evaluatePredicate(predicate, { unlocks, gameModeId });
        return { id: `${route.id}:permission:${index}`, kind: 'permission', label: predicateLabel(predicate), status: result.status === 'READY' ? 'met' : result.status === 'LOCKED' ? 'locked' : 'unknown' };
      }), ...(route.unknowns ?? []).map((label, index) => unknown(`${route.id}:unknown:${index}`, label)),
    ])))));
    fixed.push(...data.unknowns.map((label, index) => unknown(`geography:unknown:${index}`, label)));
  } else {
    if (quest.accessPolicy === 'regions' || quest.accessPolicy === 'regions-and-locations') fixed.push(...quest.regions.map((label, index) => area(`region:${index}`, label)));
    if (quest.accessPolicy === 'locations' || quest.accessPolicy === 'regions-and-locations') fixed.push(...(quest.locations ?? []).map(location));
    if (quest.oneOf?.length) fixed.push(group('alternatives', 'One complete access route', 'any', quest.oneOf.map((route, index) => group(`route:${index}`, `Route ${index + 1}`, 'all', [
      ...(route.regions ?? []).map((label, item) => area(`route:${index}:area:${item}`, label)),
      ...(route.guilds ?? []).map((label, item): QuestAccessNode => ({ id: `route:${index}:guild:${item}`, label, kind: 'guild', status: unlocks.guilds.includes(label) ? 'met' : 'locked' })),
      ...(route.locations ?? []).map(location),
    ]))));
  }
  const clauses = (predicates: RequirementPredicate[], prefix: string): QuestAccessClause[] => predicates.map((predicate, index) => {
    const evaluated = evaluatePredicate(predicate, { unlocks, gameModeId });
    return { id: 'key' in predicate ? predicate.key : `${prefix}:${index}`, predicate, status: evaluated.status,
      label: predicateLabel(predicate) };
  });
  const itemPredicates = sourcedQuestItemPredicates(quest.id);
  const itemKeys = new Set(itemPredicates.filter(predicate => 'key' in predicate).map(predicate => 'key' in predicate ? predicate.key : ''));
  const operations = clauses(questOperationalRequirements(quest).filter(predicate => !('key' in predicate) || !itemKeys.has(predicate.key)), 'operation');
  const displayedLabels = new Set([...operations.map(clause => clause.label), ...itemPredicates.flatMap(predicate => 'label' in predicate ? [predicate.label] : [])]);
  for (const [index, label] of (quest.manualRequirements ?? []).entries()) {
    if (displayedLabels.has(label)) continue;
    displayedLabels.add(label);
    operations.push(...clauses([{ kind: 'manual', key: `quest-manual:${quest.id}:${index}`, label }], 'manual'));
  }
  return {
    questId: quest.id, name: quest.name, mode: chunked ? 'chunked' : 'standard',
    eligibility: evaluateQuestEligibility(quest, unlocks, gameModeId),
    geography: group('geography', chunked ? 'Required destination chunks and access' : 'Required area access', 'all', fixed),
    items: clauses(itemPredicates, 'item').map((clause, index) => {
      const records = itemSourceClauses as Record<string, string[] | null>;
      const source = Object.hasOwn(records, quest.id) ? records[quest.id] : null;
      const supplied = Array.isArray(source) ? questProvidedItem(quest.id, index, source[index]) : null;
      return { ...clause, ...(supplied ? { questSupplier: supplied.supplier } : {}), ...(Array.isArray(source) && typeof source[index] === 'string' ? { sourceText: source[index] } : {}) };
    }),
    operations,
  };
}
