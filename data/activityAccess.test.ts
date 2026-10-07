import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_ACCESS_AREAS,
  NO_HARD_LOCATION_GATE,
  VANILLA_RANDOM_ACCESS_POLICY,
  validateVanillaRandomAccessPolicy,
} from './activityAccess';
import { BOSSES_LIST, MINIGAMES_LIST, REGIONS_LIST } from './items';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
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
    expect(ACTIVITY_ACCESS_AREAS['Chaos Fanatic']).toEqual(['Lava Maze']);
    expect(NO_HARD_LOCATION_GATE.has('Chaos Fanatic')).toBe(false);
    expect(ACTIVITY_ACCESS_AREAS['The Mad Angel']).toEqual(['Wyrmscraig']);

    for (const activity of ['Mimic', 'Shooting Stars', 'Mahogany Homes', 'Forestry', 'Rat Pits']) {
      expect(NO_HARD_LOCATION_GATE.has(activity), `${activity} should remain a location-neutral activity`).toBe(true);
    }
  });

  it('gates each boss and minigame by the area the map gives its entrance chunk', () => {
    // Reviewed entrance chunks (accuracy audit, 29 September 2026). A gate that names
    // another area lets a run roll something it can't enter, while the map, the chunk
    // panel and RuneLite lock it (owner decisions B1 and B2, 2 October 2026).
    const ENTRANCES: Readonly<Record<string, string>> = {
      'Corporeal Beast': '50,57', 'Thermonuclear Smoke Devil': '37,47', Yama: '22,57', Kraken: '35,56',
      "Giants' Foundry": '52,49', 'Tombs of Amascut': '52,42', Nex: '45,58', 'General Graardor': '45,58',
      'Commander Zilyana': '45,58', "Kree'arra": '45,58', "K'ril Tsutsaroth": '45,58', 'Duke Sucellus': '44,61',
      'Phantom Muspah': '44,61', 'The Leviathan': '48,49', 'The Whisperer': '46,54', Amoxliatl: '26,50',
      'Maggot King': '56,52', 'Chaos Elemental': '50,61', Araxxor: '57,53', "Emir's Arena": '52,51',
      // Captain Ginea's tent at (1504,3632), in the Shayzien encampment (accuracy audit G1).
      'Intelligence Gathering': '23,56',
    };
    const ownerOf = new Map<string, string>(Object.entries(SUB_AREA_CHUNKS as Record<string, { cx: number; cy: number }[]>)
      .flatMap(([area, chunks]) => chunks.map(({ cx, cy }) => [`${cx},${cy}`, area] as const)));
    for (const [activity, chunk] of Object.entries(ENTRANCES)) {
      const owner = ownerOf.get(chunk);
      expect(owner, `${activity}: ${chunk} has an area`).toBeDefined();
      expect(ACTIVITY_ACCESS_AREAS[activity], activity).toContain(owner);
      expect(NO_HARD_LOCATION_GATE.has(activity), activity).toBe(false);
    }
    // The arena floor still counts for Emir's Arena; its lobby is in the Mage Training Arena's chunk.
    expect(ACTIVITY_ACCESS_AREAS["Emir's Arena"]).toEqual(['Duel Arena / PvP Arena', 'Mage Training Arena']);
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

  it('rejects unsafe empty-pool configurations before gameplay can select from them', () => {
    for (const emptyEligiblePool of [
      { noUnlock: false, retainsKey: true, preservesRngProgression: true },
      { noUnlock: true, retainsKey: false, preservesRngProgression: true },
      { noUnlock: true, retainsKey: true, preservesRngProgression: false },
    ]) {
      expect(() => validateVanillaRandomAccessPolicy({
        ...VANILLA_RANDOM_ACCESS_POLICY,
        emptyEligiblePool,
      })).toThrow('must reject without spending a key or consuming RNG');
    }
  });
});
