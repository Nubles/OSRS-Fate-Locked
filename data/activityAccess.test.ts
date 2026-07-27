import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_ACCESS_AREAS,
  NO_HARD_LOCATION_GATE,
  VANILLA_RANDOM_ACCESS_POLICY,
} from './activityAccess';
import { BOSSES_LIST, MINIGAMES_LIST, REGIONS_LIST } from './items';
import { MISTHALIN_AREAS } from '../constants';
import { TableType } from '../types';

const ALL_ACTIVITIES = new Set([...BOSSES_LIST, ...MINIGAMES_LIST]);
const CANONICAL_NAMED_AREAS = new Set([...REGIONS_LIST, ...MISTHALIN_AREAS]);
const hasAccessAreaDeclaration = (activity: string): boolean =>
  Object.prototype.hasOwnProperty.call(ACTIVITY_ACCESS_AREAS, activity);

describe('vanilla activity access declarations', () => {
  it('classifies every current boss and minigame exactly once without stale declarations', () => {
    for (const activity of ALL_ACTIVITIES) {
      const declarations = Number(hasAccessAreaDeclaration(activity)) + Number(NO_HARD_LOCATION_GATE.has(activity));
      expect(declarations, `${activity} must have one location declaration`).toBe(1);
    }

    for (const activity of [...Object.keys(ACTIVITY_ACCESS_AREAS), ...NO_HARD_LOCATION_GATE]) {
      expect(ALL_ACTIVITIES.has(activity), `${activity} is not a current boss or minigame`).toBe(true);
    }
  });

  it('uses only canonical named areas for hard-location gates', () => {
    for (const [activity, areas] of Object.entries(ACTIVITY_ACCESS_AREAS)) {
      expect(areas.length, `${activity} needs at least one access area`).toBeGreaterThan(0);
      expect(new Set(areas).size, `${activity} repeats an access area`).toBe(areas.length);

      for (const area of areas) {
        expect(CANONICAL_NAMED_AREAS.has(area), `${activity} uses non-canonical area ${area}`).toBe(true);
      }
    }
  });

  it('accepts exact free Misthalin areas without accepting invented area names', () => {
    expect(CANONICAL_NAMED_AREAS.has('Edgeville')).toBe(true);
    expect(CANONICAL_NAMED_AREAS.has('An Invented Area')).toBe(false);
  });

  it('pins representative literal venue rules and intentional non-gates', () => {
    expect(ACTIVITY_ACCESS_AREAS['Pest Control']).toEqual(["Void Knights' Outpost"]);
    expect(ACTIVITY_ACCESS_AREAS['Last Man Standing']).toEqual(['Ferox Enclave']);
    expect(ACTIVITY_ACCESS_AREAS['Giant Mole']).toEqual(['Falador']);
    expect(ACTIVITY_ACCESS_AREAS.Obor).toEqual(['Edgeville']);
    expect(ACTIVITY_ACCESS_AREAS['Temple Trekking']).toEqual(['Burgh de Rott', 'Paterdomus']);
    expect(ACTIVITY_ACCESS_AREAS['Mastering Mixology']).toEqual(['Aldarin']);
    expect(ACTIVITY_ACCESS_AREAS['Guardians of the Rift']).toEqual(["Wizards' Tower"]);
    expect(ACTIVITY_ACCESS_AREAS['Crazy Archaeologist']).toEqual(['Forgotten Cemetery']);
    expect(NO_HARD_LOCATION_GATE.has('Crazy Archaeologist')).toBe(false);

    for (const activity of ['Mimic', 'Shooting Stars', 'Mahogany Homes', 'Forestry', 'Rat Pits']) {
      expect(NO_HARD_LOCATION_GATE.has(activity), `${activity} should remain a location-neutral activity`).toBe(true);
    }
  });

  it('exports the downstream vanilla random access policy', () => {
    expect(VANILLA_RANDOM_ACCESS_POLICY).toEqual({
      filteredTables: [TableType.BOSSES, TableType.MINIGAMES],
      randomCosts: ['key', 'chaosKey'],
      requiresTrackedHardGeography: true,
      emptyEligiblePool: { noUnlock: true, retainsKey: true, preservesRngProgression: true },
      omniDirect: { allowsLocationIneligible: true, warnsPlayer: true },
    });
  });
});
