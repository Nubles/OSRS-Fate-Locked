// Wiki facts for the first half of the Strategy Guide table (data/requirements.ts),
// checked against the OSRS Wiki in November 2026. Each block names the page it
// follows, so a later edit that drifts from the Wiki fails here.
import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { QUEST_DATA } from './questData';
import { TableType } from '../types';
import { analyzeRequirement } from '../components/StrategyGuide';
import { createFreshState } from '../context/GameContext';
import { REGIONS_LIST, SKILLS_LIST, REGION_GROUPS, MINIGAMES_LIST, GUILDS_LIST, BOSSES_LIST, MERCHANTS_LIST } from './items';
import { BANK_ACCESS_GATES } from './bankAccess';
import { RESOURCE_MAP } from './resourceData';

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
    // Either place will do, and regions are all required, so only the Mourner Tunnels side is listed.
    expect(S['Dark Beasts'].regions).toEqual(['Kandarin']);
    expect(S['Dark Beasts'].description).toMatch(/Iorwerth Dungeon/);
    expect(S['Dark Beasts'].quests).toEqual(["Mourning's End Part II"]);
    expect(S['Dark Beasts'].skills).toEqual({ Slayer: 90 });
    expect(analyzeRequirement(S['Dark Beasts'], maxed(), 'vanilla').isFullyPlayable).toBe(false);
  });

  it('the curated Dark Bow drop row matches the Strategy Guide entry', () => {
    const rows = (RESOURCE_MAP['Dark Bow'] ?? []).filter(r => r.name === 'Dark Beast' && !r.requirementsUnverified);
    expect(rows).toHaveLength(1);
    // A resource row's regions are alternatives, so it lists both dungeons; the Strategy Guide's are
    // all required, so its entry lists only the Mourner Tunnels side.
    expect(rows[0].regions).toEqual(['Kandarin', 'Tirannwn']);
    expect(rows[0].regions).toEqual(expect.arrayContaining(S['Dark Beasts'].regions));
    expect(rows[0].quests).toEqual(S['Dark Beasts'].quests);
    expect(rows[0].skills).toEqual(S['Dark Beasts'].skills);
  });
});

describe('Ver Sinhaza Bank (Wiki: Ver Sinhaza, List of banks)', () => {
  it('needs only Priest in Peril; A Taste of Hope only adds the medallion teleport', () => {
    expect(S['Ver Sinhaza Bank'].quests).toEqual(['Priest in Peril']);
    expect(analyzeRequirement(S['Ver Sinhaza Bank'], maxed(['Priest in Peril']), 'vanilla').missingQuests).toEqual([]);
  });
});

describe('Lletya and Burgh de Rott banks (Wiki: Lletya bank, Burgh de Rott bank)', () => {
  // "Players must have partially completed Mourning's End Part I" (oldid 15361478); "The bank requires
  // Priest in Peril and a partial completion of In Aid of the Myreque" (oldid 15211939).
  const manualOf = (id: string) => BANK_ACCESS_GATES.find(gate => gate.id === id)?.accessOptions.flatMap(option => option.manual ?? []);
  it('asks for the started quest, as the bank rows do', () => {
    expect(S['Lletya Bank'].quests).toEqual([]);
    expect(S['Lletya Bank'].manualRequirements).toEqual(manualOf('9265'));
    expect(S['Burgh de Rott Bank'].quests).toEqual(['Priest in Peril']);
    expect(S['Burgh de Rott Bank'].manualRequirements).toEqual(manualOf('13874'));
    expect(manualOf('9265')).toEqual(["Confirm you have started Mourning's End Part I"]);
    const partway = analyzeRequirement(S['Burgh de Rott Bank'], maxed(['Priest in Peril']), 'vanilla');
    expect(partway.missingQuests).toEqual([]);
    expect(partway.parts.manualChecks).toEqual(['Confirm you have repaired the Burgh de Rott bank in In Aid of the Myreque']);
    expect(analyzeRequirement(S['Burgh de Rott Bank'], maxed([]), 'vanilla').missingQuests).toEqual(['Priest in Peril']);
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

// Every Key and area held except the areas of the named continents; every quest and the named diaries done.
const everythingBut = (continents: string[], { quests = Object.keys(QUEST_DATA), diaries = [] as string[], levels = {} as Record<string, number> } = {}) => {
  const u = maxed(quests);
  const skip = new Set(continents.flatMap(c => [c, ...(REGION_GROUPS[c] ?? [])]));
  u.regions = REGIONS_LIST.filter(r => !skip.has(r));
  u.minigames = [...MINIGAMES_LIST];
  u.guilds = [...GUILDS_LIST];
  u.bosses = [...BOSSES_LIST];
  u.merchants = [...MERCHANTS_LIST];
  u.diaries = diaries;
  u.levels = { ...u.levels, ...levels };
  return u;
};

describe('Entries that asked for a second continent their content never uses', () => {
  // Holy wrench: Rum Deal, re-obtained from Davey on Braindeath Island. Crystal tool seed: a drop from Zalcano.
  // Smouldering stone: Cerberus (Taverley Dungeon) and hellhounds. Mining enhancers: the Varrock armour's
  // extra ore works on any standard rock; the Varrock diary is in Misthalin.
  const CASES: Array<[string, string[], string, { diaries?: string[] }]> = [
    ['Holy Wrench', ['Morytania'], 'Kharidian Desert', {}],
    ['Crystal Tool Seed', ['Tirannwn'], 'Kourend & Kebos', {}],
    ['Infernal Tools', ['Asgarnia'], 'Kourend & Kebos', {}],
    ['Varrock Armor (Mining)', ['Misthalin'], 'Asgarnia', { diaries: ['Varrock Easy'] }],
  ];
  it.each(CASES)('%s needs only %j, not %s', (key, regions, dropped, opts) => {
    expect(S[key].regions).toEqual(regions);
    const result = analyzeRequirement(S[key], everythingBut([dropped], opts), 'vanilla');
    expect(result.missingRegions).toEqual([]);
    expect(result.isFullyPlayable).toBe(true);
  });

  it('Dark Beasts open with the Mourner Tunnels and no Tirannwn area', () => {
    const result = analyzeRequirement(S['Dark Beasts'], everythingBut(['Tirannwn']), 'vanilla');
    expect(result.missingRegions).toEqual([]);
    expect(result.isFullyPlayable).toBe(true);
  });
});

describe('Ogre Enclave (Wiki: Ogre Enclave)', () => {
  it('names no ogre shamans, which are there only during Watchtower', () => {
    expect(S['Ogre Enclave'].quests).toEqual(['Watchtower']);
    expect(S['Ogre Enclave'].description).not.toMatch(/shaman/i);
    expect(S['Ogre Enclave'].description).toMatch(/blue dragons/i);
  });
});

describe('Hunter Rumours (Wiki: Varlamore, Hunter Guild)', () => {
  it('needs Children of the Sun, as every part of Varlamore does', () => {
    const allButCots = Object.keys(QUEST_DATA).filter(q => q !== 'Children of the Sun');
    expect(analyzeRequirement(S['Hunter Rumours'], everythingBut([], { quests: allButCots }), 'vanilla').isFullyPlayable).toBe(false);
    expect(analyzeRequirement(S['Hunter Rumours'], everythingBut([]), 'vanilla').isFullyPlayable).toBe(true);
  });
});

describe('Ecumenical Keys (Wiki: Wilderness God Wars Dungeon, Ecumenical key)', () => {
  it('take the same 60 Strength or 60 Agility as the dungeon they drop in', () => {
    expect(S['Ecumenical Keys'].accessRoutes).toEqual(S['Wilderness God Wars Dungeon'].accessRoutes);
    const low = analyzeRequirement(S['Ecumenical Keys'], everythingBut([], { levels: { Strength: 1, Agility: 1 } }), 'vanilla');
    expect(low.missingChecks).toContain('One of: 60 Strength or 60 Agility');
    expect(low.isFullyPlayable).toBe(false);
    expect(analyzeRequirement(S['Ecumenical Keys'], everythingBut([], { levels: { Strength: 1, Agility: 60 } }), 'vanilla').isFullyPlayable).toBe(true);
  });
});

describe('God Books (Completed) (Wiki: God book)', () => {
  it('need no Prayer level to wield; 50 Prayer is for blessing symbols', () => {
    expect(S['God Books (Completed)'].skills).toEqual({});
    expect(S['God Books (Completed)'].quests).toEqual(['Horror from the Deep']);
    expect(S['God Books (Completed)'].description).toMatch(/50 Prayer/);
    const low = analyzeRequirement(S['God Books (Completed)'], everythingBut([], { levels: { Prayer: 1 } }), 'vanilla');
    expect(low.missingSkills).toEqual([]);
  });
});

describe('Every Varlamore entry needs Children of the Sun (Wiki: Varlamore)', () => {
  // "Varlamore can only be accessed upon completion of Children of the Sun." An entry may ask for it
  // directly, through a quest that needs it, or through its activity (Hunter Rumours borrows the Hunter Guild's).
  const needsCots = new Set(['Children of the Sun']);
  for (let grew = true; grew;) {
    grew = false;
    for (const quest of Object.values(QUEST_DATA)) {
      if (!needsCots.has(quest.id) && (quest.prereqs ?? []).some(p => needsCots.has(p))) { needsCots.add(quest.id); grew = true; }
    }
  }
  const varlamore = new Set(['Varlamore', ...REGION_GROUPS['Varlamore']]);
  const entries = Object.entries(S).filter(([, req]) => req.category !== TableType.QUESTS && req.regions.some(r => varlamore.has(r)));
  it('covers the Varlamore entries', () => {
    expect(entries.map(([key]) => key)).toEqual(expect.arrayContaining(['Hunter Rumours', 'Wealthy Citizens']));
  });
  it.each(entries)('%s is not ready without it', (_key, req) => {
    const quests = Object.keys(QUEST_DATA).filter(q => !needsCots.has(q));
    expect(analyzeRequirement(req, everythingBut([], { quests }), 'vanilla').isFullyPlayable).toBe(false);
    expect(analyzeRequirement(req, everythingBut([]), 'vanilla').isFullyPlayable).toBe(true);
  });
});
