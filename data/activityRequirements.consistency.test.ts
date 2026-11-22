import { describe, it, expect } from 'vitest';
import { ACTIVITY_REQUIREMENTS, getActivityReq } from './activityRequirements';
import { ACTIVITY_ACCESS_AREAS } from './activityAccess';
import { ACTIVITY_REGIONS } from './activityRegions';
import {
  BOSSES_LIST, MINIGAMES_LIST, GUILDS_LIST, MOBILITY_LIST, ARCANA_LIST,
  POH_LIST, STORAGE_LIST, MERCHANTS_LIST, FARMING_PATCH_LIST, SKILLS_LIST,
} from './items';
import { QUEST_DATA } from './questData';
import { REGIONS_LIST, REGION_GROUPS } from './items';
import { createFreshState } from '../context/GameContext';
import { isAreaReachable } from '../utils/reachability';
import { evaluateActivityReadiness } from '../utils/activityReadiness';

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
  it('names only areas a fully unlocked Vanilla run can reach', () => {
    // An unknown area name can never be satisfied, so the activity could never
    // read Ready (Champions' Guild once required the non-area "Champions' Guild").
    const everything = {
      ...createFreshState().unlocks,
      regions: [...REGIONS_LIST, ...Object.keys(REGION_GROUPS)],
    };
    const unreachable = Object.entries(ACTIVITY_REQUIREMENTS).flatMap(([name, req]) =>
      (req.requiredAreas ?? [])
        .filter(area => !isAreaReachable(area, everything, 'vanilla'))
        .map(area => `${name}: ${area}`));
    expect(unreachable).toEqual([]);
  });

  it('pins The Mad Angel access requirements and region', () => {
    expect(ACTIVITY_REGIONS['The Mad Angel']).toBe('The Open Seas');
    expect(ACTIVITY_REQUIREMENTS['The Mad Angel']).toEqual({
      quests: ['Fallen From Grace'],
      requiredAreas: ['Wyrmscraig'],
    });
  });

  it('shares every canonical boss and minigame access area with readiness', () => {
    for (const [item, areas] of Object.entries(ACTIVITY_ACCESS_AREAS)) {
      expect(getActivityReq(item)?.requiredAreas, item).toEqual(areas);
    }
  });

  it('pins Bounty Hunter and Soul Wars hard entry gates', () => {
    expect(getActivityReq('Bounty Hunter')).toMatchObject({
      requiredAreas: ['Ferox Enclave'],
      combatLevel: 32,
      manualRequirements: ['At least 12 hours of account play time'],
    });
    expect(getActivityReq('Soul Wars')).toMatchObject({
      requiredAreas: ['Isle of Souls'],
      combatLevel: 40,
      totalLevel: 500,
      manualRequirements: ['Completed the Soul Wars tutorial once'],
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

// Wiki facts for minigame, guild and storage rows, checked in November 2026.
describe('activity rows follow the Wiki', () => {
  const needsCotS = (quests: string[] = []): boolean => {
    const seen = new Set<string>();
    const walk = (id: string): boolean => {
      if (id === 'Children of the Sun') return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return (QUEST_DATA[id]?.prereqs ?? []).some(walk);
    };
    return quests.some(walk);
  };
  const ready = (item: string, setup: (u: ReturnType<typeof createFreshState>['unlocks']) => void) => {
    const u = createFreshState().unlocks;
    u.regions = [...REGIONS_LIST];
    setup(u);
    return evaluateActivityReadiness(true, getActivityReq(item), u, 'vanilla');
  };

  it('every gated Varlamore minigame or guild asks for Children of the Sun (Wiki: Varlamore)', () => {
    const ACTIVITIES = new Set<string>([...MINIGAMES_LIST, ...GUILDS_LIST]);
    const missing = Object.entries(ACTIVITY_REGIONS)
      .filter(([item, region]) => region === 'Varlamore' && ACTIVITIES.has(item) && ACTIVITY_REQUIREMENTS[item])
      .filter(([item]) => !needsCotS([
        ...(ACTIVITY_REQUIREMENTS[item].quests ?? []),
        ...(ACTIVITY_REQUIREMENTS[item].questProgress ?? []).map(p => p.quest),
      ]))
      .map(([item]) => item);
    expect(missing).toEqual([]);
  });

  it('Mastering Mixology and Vale Totems name their quest gates', () => {
    expect(ACTIVITY_REQUIREMENTS['Mastering Mixology']).toMatchObject({ skills: { Herblore: 60 }, quests: ['Children of the Sun'] });
    expect(ACTIVITY_REQUIREMENTS['Vale Totems']).toMatchObject({ skills: { Fletching: 20 }, quests: ['Children of the Sun', 'Vale Totems'] });
    expect(ready('Mastering Mixology', u => { u.skills.Herblore = 10; u.levels.Herblore = 60; u.quests = ['Druidic Ritual']; }).status).toBe('NOT_READY');
  });

  it('Impetuous Impulses needs 17 Hunter by either way in, and the Mess needs 20 Cooking', () => {
    expect(ACTIVITY_REQUIREMENTS['Impetuous Impulses'].skills).toEqual({ Hunter: 17 });
    expect(ACTIVITY_REQUIREMENTS['Impetuous Impulses'].oneOf).toBeUndefined();
    expect(ACTIVITY_REQUIREMENTS.Mess.skills).toEqual({ Cooking: 20 });
    expect(ready('Impetuous Impulses', u => { u.quests = ['Lost City']; }).status).toBe('NOT_READY');
    expect(ready('Mess', () => {}).status).toBe('NOT_READY');
  });

  it('house furniture rows carry their lowest build level (Wiki: Achievement gallery, Costume room)', () => {
    expect(ACTIVITY_REQUIREMENTS['Spellbook Altars'].skills).toEqual({ Construction: 80 });
    expect(ACTIVITY_REQUIREMENTS['Spellbook Altars'].note).toMatch(/Achievement gallery/);
    expect(ACTIVITY_REQUIREMENTS['Magic Wardrobe'].skills).toEqual({ Construction: 42 });
    expect(ACTIVITY_REQUIREMENTS['Armour Case'].skills).toEqual({ Construction: 46 });
    expect(ACTIVITY_REQUIREMENTS['Treasure Chest (Clues)'].skills).toEqual({ Construction: 48 });
    expect(ACTIVITY_REQUIREMENTS['Toy Box'].skills).toEqual({ Construction: 50 });
    expect(ACTIVITY_REQUIREMENTS['Cape Rack'].skills).toEqual({ Construction: 54 });
  });

  it('the Colossal Pouch needs 56 Crafting as well as 25 Runecraft (Wiki: Colossal pouch)', () => {
    expect(ACTIVITY_REQUIREMENTS['Colossal Pouch'].skills).toEqual({ Runecraft: 25, Crafting: 56 });
  });

});
