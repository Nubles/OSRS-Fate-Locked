import checks from './questOperationalChecks.json';
import type { RequirementPredicate } from '../utils/requirementPredicates';

/** Reviewed supplying steps, not an inference from an availability flag.
 * Helper revision: 633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a.
 * RuneMysteries.java:107-121; VampyreSlayer.java:116-117, 144-158.
 * Acquisition never establishes permission to equip, consume or use the item.
 */
const reviews = [
  { questId: 'Rune Mysteries', index: 0, revisionId: 15275863,
    label: 'Air talisman (is given for free at the start of the quest)',
    supplier: 'Duke Horacio gives you the air talisman at the start of the quest.',
    requirements: [{ kind: 'location', label: 'Duke Horacio, Lumbridge Castle', areas: ['Lumbridge'], chunks: ['50,50'] }],
  },
  { questId: 'Vampyre Slayer', index: 2, revisionId: 15316695,
    label: 'Stake (obtained during the quest)',
    supplier: 'Dr Harlow gives you the stake after Morgan sends you to him and you bring him a beer.',
    requirements: [
      { kind: 'location', label: 'Morgan, Draynor Village', areas: ['Draynor Village'], chunks: ['48,51'] },
      { kind: 'location', label: 'Dr Harlow, Blue Moon Inn', areas: ['Varrock'], chunks: ['50,53'] },
      { kind: 'manual', key: 'quest-source-items:Vampyre Slayer:1', label: 'Beer legally available for Dr Harlow' },
    ],
  },
] satisfies { questId: string; index: number; revisionId: number; label: string; supplier: string; requirements: RequirementPredicate[] }[];

export function questProvidedItem(questId: string, index: number, label: string) {
  const review = reviews.find(entry => entry.questId === questId && entry.index === index && entry.label === label);
  const current = (checks as Record<string, string[] | null>)[questId];
  return review && current?.[index] === label ? review : null;
}
