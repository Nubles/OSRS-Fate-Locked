import type {
  QuestData,
  QuestLocationRequirement,
} from '../data/questData';
import type { QuestPlace } from './questLocations';

export interface QuestGeographyDisplay {
  regions: string[];
  locations: QuestLocationRequirement[];
  knownSteps: QuestPlace[];
}

const uniqueByLast = <T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): T[] => {
  const byKey = new Map<string, T>();
  for (const value of values) byKey.set(keyOf(value), value);
  return [...byKey.values()];
};

const uniqueByFirst = <T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): T[] => {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = keyOf(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function selectQuestGeography(
  quest: Pick<QuestData, 'accessPolicy' | 'regions' | 'locations'>,
  places: readonly QuestPlace[],
): QuestGeographyDisplay {
  const regions = quest.accessPolicy === 'locations'
    ? []
    : uniqueByLast(quest.regions, region => region);
  const locations = quest.accessPolicy === 'regions'
    ? []
    : uniqueByLast(quest.locations ?? [], location => location.id);
  const knownSteps = quest.accessPolicy === 'regions'
    ? uniqueByFirst(places, step => `${step.cx},${step.cy}`)
    : [];

  return { regions, locations, knownSteps };
}
