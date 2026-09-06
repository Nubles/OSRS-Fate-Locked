import type {
  QuestData,
  QuestLocationRequirement,
} from '../data/questData';
import type { QuestPlace } from './questLocations';

export interface QuestGeographyDisplay {
  regions: string[];
  locations: QuestLocationRequirement[];
  knownSteps: QuestPlace[];
  routeGroups?: NonNullable<QuestData['chunkedGeography']>['groups'];
}

/**
 * Exact standard-mode areas that the quest eligibility engine enforces.
 *
 * Location-policy quests retain broad `regions` as descriptive source
 * metadata, so consumers must not treat those labels as machine gates.
 */
export function enforcedQuestAreas(
  quest: Pick<QuestData, 'accessPolicy' | 'regions' | 'locations' | 'chunkedGeography'>,
  gameModeId?: string,
): string[] {
  if (gameModeId === 'chunked' && quest.chunkedGeography) return [];
  const regions = quest.accessPolicy === 'locations' ? [] : quest.regions;
  const locationAreas = quest.accessPolicy === 'regions'
    ? []
    : (quest.locations ?? []).flatMap(location => location.standardAreas);

  return uniqueByLast([...regions, ...locationAreas], area => area);
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
  quest: Pick<QuestData, 'accessPolicy' | 'regions' | 'locations' | 'chunkedGeography'>,
  places: readonly QuestPlace[],
  gameModeId?: string,
): QuestGeographyDisplay {
  if (gameModeId === 'chunked' && quest.chunkedGeography) return {
    regions: [], locations: quest.chunkedGeography.locations.map(location => ({...location, standardAreas: []})),
    knownSteps: [], routeGroups: quest.chunkedGeography.groups,
  };
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
