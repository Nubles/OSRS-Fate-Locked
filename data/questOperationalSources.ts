import runtimeChecks from './questOperationalChecks.json';
import type { RequirementPredicate } from '../utils/requirementPredicates';

/** Source clauses are deliberately not split into item gates: an OR route or a
 * quest-obtained alternative must not become multiple pre-owned item demands. */
export function sourcedQuestItemPredicates(id: string): RequirementPredicate[] {
  const records = runtimeChecks as Record<string, string[] | null>;
  const record = Object.hasOwn(records, id) ? records[id] : undefined;
  if (!Array.isArray(record)) {
    return [{ kind: 'unknown', key: `quest-item-source:${id}`, label: `${id}: required-item source needs review` }];
  }
  return record.map((label, index) => ({
    kind: 'manual', key: `quest-source-items:${id}:${index}`,
    label: `${label} — satisfy the applicable required route legally; recommendations are optional and quest-obtainable items need not be pre-owned.`,
  }));
}
