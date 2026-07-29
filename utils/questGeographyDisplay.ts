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

const uniqueBy = <T>(values: readonly T[], keyOf: (value: T) => string): T[] =>
  [...new Map(values.map(value => [keyOf(value), value])).values()];

export function selectQuestGeography(
  quest: Pick<QuestData, 'accessPolicy' | 'regions' | 'locations'>,
  places: readonly QuestPlace[],
): QuestGeographyDisplay {
  const regions = quest.accessPolicy === 'locations'
    ? []
    : uniqueBy(quest.regions, region => region);
  const locations = quest.accessPolicy === 'regions'
    ? []
    : uniqueBy(quest.locations ?? [], location => location.id);
  const knownSteps = quest.accessPolicy === 'regions'
    ? uniqueBy(places, step => `${step.cx},${step.cy}`)
    : [];

  return { regions, locations, knownSteps };
}
