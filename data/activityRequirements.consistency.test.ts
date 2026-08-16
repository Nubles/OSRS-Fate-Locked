import { describe, it, expect } from 'vitest';
import { ACTIVITY_REQUIREMENTS } from './activityRequirements';
import { ACTIVITY_REGIONS } from './activityRegions';
import {
  BOSSES_LIST, MINIGAMES_LIST, GUILDS_LIST, MOBILITY_LIST, ARCANA_LIST,
  POH_LIST, STORAGE_LIST, MERCHANTS_LIST, FARMING_PATCH_LIST, SKILLS_LIST,
} from './items';
import { QUEST_DATA } from './questData';

const ALL_ACTIVITY_ITEMS = new Set<string>([
  ...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST, ...MOBILITY_LIST, ...ARCANA_LIST,
  ...POH_LIST, ...STORAGE_LIST, ...MERCHANTS_LIST, ...FARMING_PATCH_LIST,
]);
const SKILLS = new Set(SKILLS_LIST);
// Quests are referenced everywhere by their canonical id (= the QUEST_DATA key),
// e.g. "Desert Treasure II" — not the long display name. Validate against ids.
const QUEST_IDS = new Set(Object.keys(QUEST_DATA));
const CONTINENTS = new Set([
  'Misthalin','Asgarnia','Kandarin','Karamja','Kharidian Desert','Morytania','Fremennik',
  'Tirannwn','Wilderness','Kourend & Kebos','Varlamore','Islands & Others','The Open Seas',
]);

describe('activity requirements + regions consistency', () => {
  it('pins The Mad Angel access requirements and region', () => {
    expect(ACTIVITY_REGIONS['The Mad Angel']).toBe('The Open Seas');
    expect(ACTIVITY_REQUIREMENTS['The Mad Angel']).toEqual({
      quests: ['Fallen From Grace'],
      requiredAreas: ['Wyrmscraig'],
    });
  });

  it('every requirement key is a real activity item (no typos)', () => {
    for (const key of Object.keys(ACTIVITY_REQUIREMENTS)) {
      expect(ALL_ACTIVITY_ITEMS.has(key), `unknown activity "${key}"`).toBe(true);
    }
  });

  it('every skill gate names a real skill with a 1-99 level', () => {
    for (const [item, req] of Object.entries(ACTIVITY_REQUIREMENTS)) {
      for (const [sk, lvl] of Object.entries(req.skills ?? {})) {
        expect(SKILLS.has(sk), `${item}: unknown skill "${sk}"`).toBe(true);
        expect(lvl, `${item}.${sk}`).toBeGreaterThanOrEqual(1);
        expect(lvl, `${item}.${sk}`).toBeLessThanOrEqual(99);
      }
    }
  });

  it('every quest gate names a real quest in QUEST_DATA', () => {
    for (const [item, req] of Object.entries(ACTIVITY_REQUIREMENTS)) {
      for (const q of req.quests ?? []) {
        expect(QUEST_IDS.has(q), `${item}: quest "${q}" not in QUEST_DATA`).toBe(true);
      }
    }
  });

  it('every region tag is a valid continent', () => {
    for (const [item, reg] of Object.entries(ACTIVITY_REGIONS)) {
      expect(CONTINENTS.has(reg), `${item}: bad region "${reg}"`).toBe(true);
    }
  });
});
