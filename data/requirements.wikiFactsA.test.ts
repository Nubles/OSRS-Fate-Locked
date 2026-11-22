// Wiki facts for the first half of the Strategy Guide table (data/requirements.ts),
// checked against the OSRS Wiki in November 2026. Each block names the page it
// follows, so a later edit that drifts from the Wiki fails here.
import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { TableType } from '../types';
import { analyzeRequirement } from '../components/StrategyGuide';
import { createFreshState } from '../context/GameContext';
import { REGIONS_LIST, SKILLS_LIST } from './items';

const S = STRATEGY_DATABASE;
// Every region and skill held at 99: only quests and unlocks can block.
const maxed = (quests: string[] = []) => {
  const u = createFreshState().unlocks;
  u.regions = [...REGIONS_LIST];
  u.skills = Object.fromEntries(SKILLS_LIST.map(s => [s, 10]));
  u.levels = Object.fromEntries(SKILLS_LIST.map(s => [s, 99]));
  u.quests = quests;
  return u;
};

describe('Calcified Rocks (Wiki: Cam Torum mine, Calcified rocks)', () => {
  it('opens with Cam Torum, partway through Perilous Moons', () => {
    expect(S['Calcified Rocks'].quests).toEqual(['Perilous Moons']);
    expect(S['Calcified Rocks'].skills).toEqual({ Mining: 41 });
    expect(analyzeRequirement(S['Calcified Rocks'], maxed(['Children of the Sun']), 'vanilla').missingQuests).toEqual(['Perilous Moons']);
  });
  it('names the real yields', () => {
    expect(S['Calcified Rocks'].description).toMatch(/blessed bone shards/);
    expect(S['Calcified Rocks'].description).toMatch(/calcified deposits/);
    expect(S['Calcified Rocks'].description).not.toMatch(/Calcified shards/);
  });
});

describe('Dark Beasts (Wiki: Dark beast, Mourner Tunnels)', () => {
  it('live in the Mourner Tunnels and the Iorwerth Dungeon, behind Mourning\'s End Part II', () => {
    expect(S['Dark Beasts'].regions).toEqual(['Kandarin', 'Tirannwn']);
    expect(S['Dark Beasts'].quests).toEqual(["Mourning's End Part II"]);
    expect(S['Dark Beasts'].skills).toEqual({ Slayer: 90 });
    expect(analyzeRequirement(S['Dark Beasts'], maxed(), 'vanilla').isFullyPlayable).toBe(false);
  });
});

describe('Ver Sinhaza Bank (Wiki: Ver Sinhaza, List of banks)', () => {
  it('needs only Priest in Peril; A Taste of Hope only adds the medallion teleport', () => {
    expect(S['Ver Sinhaza Bank'].quests).toEqual(['Priest in Peril']);
    expect(analyzeRequirement(S['Ver Sinhaza Bank'], maxed(['Priest in Peril']), 'vanilla').missingQuests).toEqual([]);
  });
});

describe('Agility shortcuts (Wiki: Shortcuts list, Rocks (Eagles\' Peak), The Hollows)', () => {
  it('Lumbridge Swamp Caves stepping stones open at 1 Agility', () => {
    expect(S['Lumbridge Swamp Caves Jump'].skills).toEqual({ Agility: 1 });
    expect(S['Lumbridge Swamp Caves Jump'].description).toMatch(/Chasm of Tears/);
  });
  it('the Eagles\' Peak rocks need 25 Agility and no quest', () => {
    expect(S["Eagles' Peak Shortcut"].skills).toEqual({ Agility: 25 });
    expect(S["Eagles' Peak Shortcut"].quests ?? []).toEqual([]);
  });
  it('the Canifis cellar trapdoor needs no Agility and opens during In Search of the Myreque', () => {
    expect(S['Myreque Hideout Shortcut'].skills).toEqual({});
    expect(S['Myreque Hideout Shortcut'].quests).toEqual(['In Search of the Myreque']);
  });
  it('lists no shortcut the game does not have', () => {
    expect(S["Xeric's Lookout"]).toBeUndefined();
    expect(S['Prifddinas Waterfall']).toBeUndefined();
  });
  it('keeps the real 62 Agility Mount Karuulm climb', () => {
    expect(S['Karuulm Dungeon (Middle)'].skills).toEqual({ Agility: 62 });
  });
});

describe('Ectoplasmator (Wiki: Ectoplasmator)', () => {
  it('needs 40 Prayer', () => {
    expect(S.Ectoplasmator.skills).toEqual({ Prayer: 40 });
  });
  it("leaves the Champions' Guild's 32 quest points to its activity gate", () => {
    const u = maxed();
    expect(analyzeRequirement(S["Champions' Guild (Shop)"], u, 'vanilla').missingChecks).toContain('32 Quest Points');
  });
});

describe('Teomat (Wiki: The Teomat)', () => {
  it('is a monastery with no shop, so the Merchants list does not offer it', () => {
    expect(S.Teomat).toBeUndefined();
  });
});

describe('Entry descriptions (Wiki: Obelisk of Air, Pirates\' Hideout, Spiritual ranger, Crystal impling)', () => {
  it('the Deep Wilderness Dungeon has no air obelisk and chaos dwarves drop no dragon 2h', () => {
    expect(S['Deep Wilderness Dungeon'].description).not.toMatch(/Obelisk|D2H/i);
    expect(S['Deep Wilderness Dungeon'].description).toMatch(/wine of Zamorak/i);
  });
  it('the Pirates\' Hideout has thieving chests and no shop', () => {
    expect(S["Pirate's Hideout"].description).not.toMatch(/shop/i);
    expect(S["Pirate's Hideout"].description).toMatch(/chests/);
  });
  it('spiritual rangers do not drop dragon arrowtips', () => {
    expect(S['Spiritual Rangers'].description).not.toMatch(/Dragon Arrowtips/i);
  });
  it('crystal implings give noted amulets of power, not (t)', () => {
    expect(S['Crystal Implings'].description).not.toMatch(/\(t\)/);
    expect(S['Crystal Implings'].description).toMatch(/noted Amulets of Power/);
  });
});

describe('Quest strategy keys match the quest list', () => {
  it('The Fremennik Exiles and The Slug Menace use their QUEST_DATA ids, so their descriptions show', () => {
    for (const key of ['The Fremennik Exiles', 'The Slug Menace']) {
      expect(QUEST_DATA[key], key).toBeDefined();
      expect(S[key]?.category, key).toBe(TableType.QUESTS);
    }
    expect(S['The Fremennik Exiles'].description).toMatch(/Neitiznot Faceguard/);
    expect(S['The Slug Menace'].description).toMatch(/Proselyte/);
    expect(S['Fremennik Exiles']).toBeUndefined();
    expect(S['Slug Menace']).toBeUndefined();
  });
});

describe('Specific bank access entries (Wiki: Corsair Cove, Farming Guild, Myths\' Guild)', () => {
  it('Corsair Cove is on the Feldip Hills shore, in Kandarin only', () => {
    expect(S['Corsair Cove Bank'].regions).toEqual(['Kandarin']);
    const u = maxed(['The Corsair Curse']);
    u.regions = ['Kandarin'];
    expect(analyzeRequirement(S['Corsair Cove Bank'], u, 'vanilla').missingRegions).toEqual([]);
  });
  it('the guild banks need the guild itself, like the Crafting Guild bank', () => {
    const u = maxed(['Dragon Slayer II']);
    expect(analyzeRequirement(S['Farming Guild Bank'], u, 'vanilla').isCategoryUnlocked).toBe(false);
    expect(analyzeRequirement(S["Myths' Guild Bank"], u, 'vanilla').isCategoryUnlocked).toBe(false);
    u.guilds = ['Farming Guild', "Myths' Guild"];
    expect(analyzeRequirement(S['Farming Guild Bank'], u, 'vanilla').isFullyPlayable).toBe(true);
    expect(analyzeRequirement(S["Myths' Guild Bank"], u, 'vanilla').isFullyPlayable).toBe(true);
  });
});

describe('Saves that pinned a removed or renamed entry', () => {
  // The save schema keeps any pinned id as a plain string (utils/saveSchema.test.ts
  // keeps 'first_goal'). An id the goal panel cannot find falls through to the
  // Resource Engine lookup, which shows no card for it, as before.
  it('falls through to the engine lookup instead of throwing', async () => {
    const { goalNeedsResourceEngine } = await import('../components/GoalTracker');
    for (const id of ["Xeric's Lookout", 'Prifddinas Waterfall', 'Teomat', 'Fremennik Exiles', 'Slug Menace']) {
      expect(goalNeedsResourceEngine(id), id).toBe(true);
    }
    expect(goalNeedsResourceEngine('The Fremennik Exiles')).toBe(false);
    expect(goalNeedsResourceEngine('Dark Beasts')).toBe(false);
  });
});
