import { describe, it, expect } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { SKILLS_LIST, REGIONS_LIST } from './items';
import { createFreshState } from '../context/GameContext';
import { analyzeRequirement } from '../components/StrategyGuide';
import { calculateGoalProgress } from '../utils/goalLogic';
import { buildGoalRoute } from '../utils/goalRoute';

/**
 * Wiki facts for the second half of the Strategy Guide / Goal Tracker table
 * (requirements audit, part B). Each pin names the OSRS Wiki page it was
 * checked against on 22 Nov 2026.
 */

const entry = (key: string) => {
  const req = STRATEGY_DATABASE[key];
  expect(req, key).toBeDefined();
  return req;
};

describe('requirements part B: skill levels', () => {
  it('Barrelchest Anchor needs no Smithing; 60 Attack and 40 Strength to wield (Wiki: Barrelchest anchor)', () => {
    expect(entry('Barrelchest Anchor').skills).toEqual({ Prayer: 50, Attack: 60, Strength: 40 });
  });
  it('Ancient Mace needs 25 Prayer and 15 Attack (Wiki: Ancient mace, Another Slice of H.A.M.)', () => {
    expect(entry('Ancient Mace').skills).toEqual({ Prayer: 25, Attack: 15 });
  });
  it('every Weiss salt rock needs 72 Mining (Wiki: Salt Mine)', () => {
    expect(entry('Salt Mine (Weiss)').skills).toEqual({ Mining: 72 });
  });
  it('cave horrors need 58 Slayer (Wiki: Cave horror)', () => {
    expect(entry("Mos Le'Harmless Cave (Horrors)").skills).toEqual({ Slayer: 58 });
  });
  it('abyssal demons need 85 Slayer and the text does not guess (Wiki: Abyssal demon)', () => {
    const req = entry('Abyssal Area (Fairy Ring)');
    expect(req.skills).toEqual({ Slayer: 85 });
    expect(req.description).not.toMatch(/\?/);
  });
  it("Boots of Brimstone need a drake's claw, so 84 Slayer for drakes (Wiki: Drake's claw, Drake)", () => {
    expect(entry('Boots of Brimstone').skills).toEqual({ Slayer: 84 });
  });
  it('Neitiznot Faceguard needs no Crafting; 70 Defence to wear (Wiki: Neitiznot faceguard)', () => {
    expect(entry('Neitiznot Faceguard').skills).toEqual({ Defence: 70 });
  });
  it('Spirit Shield asks only for the 85 Prayer bless; both sigil routes are named (Wiki: Arcane spirit shield)', () => {
    const req = entry('Spirit Shield (Making)');
    expect(req.skills).toEqual({ Prayer: 85 });
    expect(req.description).toMatch(/90 Prayer and 85 Smithing/);
    expect(req.description).toMatch(/Abbot Langley/);
  });
});

describe('requirements part B: regions and sources', () => {
  it('harpie bug swarms are in Karamja, not Kandarin (Wiki: Harpie Bug Swarm)', () => {
    expect(entry('Harpie Bug Swarms').regions).toEqual(['Karamja']);
  });
  it('no master farmer is in Asgarnia (Wiki: Master Farmer)', () => {
    expect(entry('Master Farmers').regions).toEqual(['Misthalin']);
  });
  it('the Al Kharid silk and gem stalls cannot be stolen from (Wiki: Silk stall, Gem stall)', () => {
    expect(entry('Silk Stalls').regions).toEqual(['Kandarin']);
    expect(entry('Gem Stall').regions).toEqual(['Kandarin']);
  });
  it('only Dagannoth Prime drops the mud battlestaff (Wiki: Mud battlestaff)', () => {
    const req = entry('Mud Battlestaff');
    expect(req.regions).toEqual(['Fremennik']);
    expect(req.description).toBe('Drop from Dagannoth Prime.');
  });
});

describe('requirements part B: quests', () => {
  it('every way to Etceteria needs The Fremennik Trials (Wiki: Etceteria, Fairy ring CIP)', () => {
    expect(entry('Etceteria Spirit Tree').quests).toEqual(['The Fremennik Trials']);
  });
  it('volcanic ash is only on Fossil Island, behind Bone Voyage (Wiki: Volcanic ash)', () => {
    expect(entry('Fossil Island Phosphate').quests).toEqual(['Bone Voyage']);
  });
  it('the Sandstorm grinder needs no quest (Wiki: Sandstorm, quest = No)', () => {
    expect(entry('Sand (Sandstorm)').quests ?? []).toEqual([]);
  });
  it('every quest named here is a real quest', () => {
    for (const q of ['The Fremennik Trials', 'Bone Voyage']) expect(QUEST_DATA[q], q).toBeDefined();
  });
});

describe("requirements part B: Champions' Guild 32 Quest Points (Wiki: Champions' Guild)", () => {
  const keys = ["Champions' Challenge", "Scavvo's Rune Store"];
  const everythingButQuests = () => {
    const u = createFreshState().unlocks;
    u.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
    u.levels = Object.fromEntries(SKILLS_LIST.map(s => [s, 99]));
    u.regions = [...REGIONS_LIST];
    return u;
  };
  const withQuestPoints = (need: number) => {
    const u = everythingButQuests();
    let points = 0;
    for (const quest of Object.values(QUEST_DATA)) {
      if (points >= need) break;
      if (quest.kind !== 'quest' || !quest.points) continue;
      u.quests.push(quest.id);
      points += quest.points;
    }
    return u;
  };

  const stateWith = (unlocks: ReturnType<typeof everythingButQuests>) => ({ ...createFreshState(), unlocks, gameModeId: 'vanilla' });

  it('both entries ask for 32 Quest Points', () => {
    for (const key of keys) expect(entry(key).questPoints, key).toBe(32);
  });
  it('the Strategy Guide lists the Quest Points until they are met', () => {
    for (const key of keys) {
      expect(analyzeRequirement(entry(key), everythingButQuests(), 'vanilla').missingChecks, key).toContain('32 Quest Points');
      expect(analyzeRequirement(entry(key), withQuestPoints(32), 'vanilla').missingChecks, key).not.toContain('32 Quest Points');
    }
  });
  it('the Goal Tracker and the goal route count them', () => {
    for (const key of keys) {
      expect(calculateGoalProgress(entry(key), everythingButQuests(), 'vanilla').missing, key).toContain('Quest Points (0/32)');
      const route = buildGoalRoute(key, stateWith(everythingButQuests()));
      expect(route?.questPoints, key).toMatchObject({ need: 32, have: 0, met: false });
      expect(buildGoalRoute(key, stateWith(withQuestPoints(32)))?.questPoints?.met, key).toBe(true);
    }
  });
});
