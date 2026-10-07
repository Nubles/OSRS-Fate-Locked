import { describe, it, expect } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { DIARY_DATA } from './diaryData';
import {
  SKILLS_LIST, REGION_GROUPS, MISTHALIN_AREAS,
} from './items';

/**
 * Integrity guards for STRATEGY_DATABASE (the goal-tracker source).
 *
 * Mirrors the resourceConsistency guards: every region / skill / quest /
 * diary referenced in a strategy entry must resolve to a real entry in the
 * canonical list. Otherwise the goal's lock analysis silently lists an
 * impossible "Missing X" forever — the original failure mode that motivated
 * adding these tests.
 */

const VALID_REGION = new Set<string>([
  'Misthalin',
  ...MISTHALIN_AREAS,
  ...Object.keys(REGION_GROUPS),
  ...Object.values(REGION_GROUPS).flat(),
]);
const VALID_SKILL = new Set(SKILLS_LIST);
const VALID_QUEST = new Set(Object.values(QUEST_DATA).map((q) => q.name));
const VALID_DIARY = new Set(Object.keys(DIARY_DATA));

describe('STRATEGY_DATABASE references resolve', () => {
  it('every region tag is valid', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const r of e.regions || []) {
        if (!VALID_REGION.has(r)) bad.push(`${key} -> "${r}"`);
      }
    }
    expect(bad, 'strategy entries with unknown region tags').toEqual([]);
  });

  it('every skill key is in SKILLS_LIST, with quest points represented separately', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const s of Object.keys(e.skills || {})) {
        if (!VALID_SKILL.has(s)) bad.push(`${key} -> "${s}"`);
      }
      if (QUEST_DATA[key]) expect(e.questPoints).toBe(QUEST_DATA[key].skills['Quest Points']);
    }
    expect(bad, 'strategy entries referencing unknown skills').toEqual([]);
  });

  it('every quest name matches QUEST_DATA', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const q of e.quests || []) {
        if (!VALID_QUEST.has(q)) bad.push(`${key} -> "${q}"`);
      }
    }
    expect(bad, 'strategy entries referencing unknown quests').toEqual([]);
  });

  it('every diary tier matches DIARY_DATA', () => {
    const bad: string[] = [];
    for (const [key, e] of Object.entries(STRATEGY_DATABASE)) {
      for (const d of e.diaries || []) {
        if (!VALID_DIARY.has(d)) bad.push(`${key} -> "${d}"`);
      }
    }
    expect(bad, 'strategy entries referencing unknown diary tiers').toEqual([]);
  });
});

describe('Strategy Guide corrections from the roll data audit (7 October 2026)', () => {
  // Each checked against the OSRS Wiki that day.
  const skills = (key: string) => STRATEGY_DATABASE[key].skills;
  it('pins corrected levels', () => {
    expect(skills('Sinister Chest')).toEqual({ Agility: 49 });
    expect(skills('Miscellania Dock Stepping Stone')).toEqual({ Agility: 55 });
    expect(skills('Observatory Grapple')).toEqual({ Agility: 23, Strength: 28, Ranged: 24 });
    expect(skills('Red Dragon Isle')).toEqual({ Agility: 56 });
    expect(skills("Angler's Outfit")).toEqual({ Fishing: 34 });
    expect(skills('Superglass Make')).toEqual({ Magic: 77 });
    expect(skills('Games Necklace (Wintertodt)')).toEqual({ Crafting: 22 });
    expect(skills('Necklace of Passage')).toEqual({ Crafting: 25 });
    expect(skills('Bonecrusher')).toEqual({});
    expect(skills('Boots of Brimstone')).toEqual({ Slayer: 44 });
  });
  it('takes 60 Strength or 60 Agility in the Wilderness God Wars Dungeon, not both', () => {
    for (const key of ['Wilderness God Wars Dungeon', 'Spiritual Rangers', 'Spiritual Warriors']) {
      expect(skills(key).Agility, key).toBeUndefined();
      expect(STRATEGY_DATABASE[key].accessRoutes?.map(r => r.label), key).toEqual(['60 Strength', '60 Agility']);
    }
  });
  it('pins corrected diaries, quests and regions', () => {
    expect(STRATEGY_DATABASE['Red Dragon Isle'].diaries).toBeUndefined();
    expect(STRATEGY_DATABASE['Gem Rocks (Underground)'].diaries).toEqual(['Karamja Medium']);
    expect(STRATEGY_DATABASE['Limestone Mine']).toMatchObject({ regions: ['Misthalin'] });
    expect(STRATEGY_DATABASE['Limestone Mine'].quests).toBeUndefined();
    expect(STRATEGY_DATABASE['Resurrect Crops'].quests).toBeUndefined();
    expect(STRATEGY_DATABASE['Fairy Ring BJS (Zulrah)'].quests).toContain('Regicide');
    expect(STRATEGY_DATABASE['Red Salamanders'].regions).toEqual(['Kandarin']);
  });
});
