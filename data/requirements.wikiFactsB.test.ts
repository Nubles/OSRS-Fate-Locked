import { describe, it, expect } from 'vitest';
import { STRATEGY_DATABASE, FAIRY_RING_ACCESS } from './requirements';
import { getActivityReq } from './activityRequirements';
import { QUEST_DATA } from './questData';
import { SKILLS_LIST, REGIONS_LIST } from './items';
import { createFreshState } from '../context/GameContext';
import { analyzeRequirement } from '../components/StrategyGuide';
import { calculateGoalProgress } from '../utils/goalLogic';
import { buildGoalRoute } from '../utils/goalRoute';
import { AREA_ENTRY_ROUTES } from './areaAccess';

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
  it('ferocious gloves are hydra leather on the Lithkren Vault machinery, no Barrows gloves (Wiki: Ferocious gloves)', () => {
    const req = entry('Ferocious Gloves');
    expect(req.regions).toEqual(['Kourend & Kebos', 'Islands & Others']);
    expect(req.description).toMatch(/Lithkren/);
    expect(req.description).not.toMatch(/Barrows/i);
  });
  it('ferocious gloves need 95 Slayer: hydra leather drops only from the Alchemical Hydra (Wiki: Hydra leather, Alchemical Hydra)', () => {
    expect(entry('Ferocious Gloves').skills).toEqual({ Slayer: 95 });
  });
});

describe('requirements part B: shop stock, drops and removed systems', () => {
  const cases: [string, RegExp, RegExp][] = [
    // [entry, must match, must not match]. Wiki pages: Bandit Duty Free, Lundail's Arena-side Rune Shop,
    // Basilisk, Chest (Dorgesh-Kaan Average/Rich), Candle maker, Granite body, Kourend Favour, Lovakite ore,
    // Volcanic sulphur, Giant Sea Snake, Nurmof's Pickaxe Shop, Mount Karuulm Weapon Shop, Zogre bones,
    // King Black Dragon, Reward cart, Supply crate (discontinued).
    ['Bandit Duty Free', /tools/, /rune/i],
    ["Lundail's Rune Shop", /Death/, /Soul/],
    ['Basilisks', /Mystic Hat/, /Boots/],
    ['Dorgesh-Kaan Chests', /Easy clues/, /Hard|clues and gems/],
    ['Candle Maker', /^Sells Candles\.$/, /Lit|Black/],
    ['Granite Body', /95,000 coins/, /BA points|drop from/i],
    ['Lovakite Ore', /Lovakite bars/, /Favou?r|Dynamite/i],
    ['Volcanic Sulphur', /Dynamite/, /Favou?r/i],
    // Deep pass: the Giant Sea Snake cannot be fought after Royal Trouble; the young drop medium clues (Wiki: Sea Snake Young).
    ['Miscellania Dungeon', /Sea snake young \(Medium Clues\)/, /Hard|Giant Sea Snake \(/],
    ["Nurmof's Pickaxe Shop", /Rune Pickaxe/, /Adamant/],
    ['Mount Karuulm Weapon Shop', /Warhammers/, /Hastae/],
    ['Zogre Bones', /Prayer/, /Crushed Nest|\?/],
    ['Dragon Pickaxe (KBD)', /1\/1,000/, /1\/1,500/],
    ['Dragon Axe (Wintertodt)', /reward cart/, /supply crate/i],
  ];
  it.each(cases)('%s description matches the Wiki', (key, yes, no) => {
    const { description } = entry(key);
    expect(description).toMatch(yes);
    expect(description).not.toMatch(no);
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
  it("the goal route counts them for the Champions' Guild shop, whose rule is kept on the guild", () => {
    // Champions' Guild (Shop) carries no questPoints of its own: the guild's entry rule in
    // data/activityRequirements.ts gates it, and the Strategy Guide and the Goal Tracker's list read it there.
    // The goal route read only the row, so its Quest Points line was missing for this one goal.
    const key = "Champions' Guild (Shop)";
    expect(entry(key).questPoints).toBeUndefined();
    expect(buildGoalRoute(key, stateWith(everythingButQuests()))?.questPoints).toMatchObject({ need: 32, have: 0, met: false });
    expect(buildGoalRoute(key, stateWith(withQuestPoints(32)))?.questPoints?.met).toBe(true);
    // The Goal Tracker's list names the rule once, not once per source.
    expect(calculateGoalProgress(entry(key), everythingButQuests(), 'vanilla').missing.filter(line => /Quest Points/.test(line)))
      .toEqual(['32 Quest Points']);
  });
});

describe('requirements part B, deep pass: started quests and shop stock', () => {
  // Wiki 'Fairy ring' (rev 15397230): Fairytale I completed, Fairytale II only started
  // (until the Fairy Godfather grants permission). The rings, and the places reached only by ring.
  const FAIRY_RING_ENTRIES = [
    'Enchanted Valley', 'Gorak Plane', 'Abyssal Area (Fairy Ring)',
    'Fairy Ring DJR (Chasm)', 'Fairy Ring BJS (Zulrah)', 'Fairy Ring DKS (Polar)', 'Fairy Ring CIQ (Yanille)',
    'Fairy Ring ALP (Lighthouse)', 'Fairy Ring CKS (Canifis)', 'Fairy Ring DKP (Karambwan)', 'Fairy Ring BIP (Poly)',
    'Fairy Ring CIR (Mount K)', 'Fairy Ring BLP (TzHaar)',
  ];
  it('no entry but the quest itself asks for Fairytale II to be completed', () => {
    const offenders = Object.entries(STRATEGY_DATABASE)
      .filter(([key, req]) => key !== 'Fairytale II - Cure a Queen' && (req.quests ?? []).includes('Fairytale II - Cure a Queen'))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });
  it('every fairy-ring entry asks for Fairytale I and the started-Fairytale II check, worded as the Fairy Rings rule', () => {
    expect(getActivityReq('Fairy Rings')?.manualRequirements).toEqual([FAIRY_RING_ACCESS]);
    const ringKeyed = Object.entries(STRATEGY_DATABASE).filter(([, req]) => req.needsKey?.includes('Fairy Rings')).map(([key]) => key);
    for (const key of new Set([...FAIRY_RING_ENTRIES, ...ringKeyed])) {
      const req = entry(key);
      expect(req.quests, key).toContain('Fairytale I - Growing Pains');
      expect(req.questProgress, key).toContainEqual({ quest: 'Fairytale II - Cure a Queen', label: FAIRY_RING_ACCESS });
      expect(req.manualRequirements ?? [], key).not.toContain(FAIRY_RING_ACCESS);
    }
    expect(entry('Fairy Ring BJS (Zulrah)').quests).toContain('Regicide');
  });
  it('a player with Fairytale I done and Fairytale II started is not blocked on a quest', () => {
    const u = createFreshState().unlocks;
    u.quests = ['Fairytale I - Growing Pains'];
    for (const key of FAIRY_RING_ENTRIES.filter(k => k !== 'Fairy Ring BJS (Zulrah)')) {
      const result = analyzeRequirement(entry(key), u, 'vanilla');
      expect(result.missingQuests, key).toEqual([]);
      expect(result.missingChecks, key).toContain(FAIRY_RING_ACCESS);
    }
  });
  // Completing Fairytale II proves the started check, so the cards can be Ready again.
  it('a player who has completed Fairytale II has no fairy ring check left', () => {
    const u = createFreshState().unlocks;
    u.quests = ['Fairytale I - Growing Pains', 'Fairytale II - Cure a Queen', 'Regicide'];
    u.regions = [...REGIONS_LIST];
    u.mobility = ['Fairy Rings'];
    u.minigames = ['Enchanted Valley', 'Gorak Plane', 'Abyssal Area'];
    u.skills = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10]));
    u.levels = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99]));
    for (const key of FAIRY_RING_ENTRIES) {
      const result = analyzeRequirement(entry(key), u, 'vanilla');
      expect(result.missingChecks, key).toEqual([]);
      expect(result.isFullyPlayable, key).toBe(true);
    }
  });
  it('Jatizso and Neitiznot shops need The Fremennik Trials and a started Fremennik Isles (Wiki: Jatizso, Neitiznot, Mord Gunnars)', () => {
    for (const key of ['Jatizso Ore Shop', 'Neitiznot Supplies']) {
      expect(entry(key).quests, key).toEqual(['The Fremennik Trials']);
      expect(entry(key).questProgress, key).toEqual([{ quest: 'The Fremennik Isles', label: 'Confirm you have started The Fremennik Isles' }]);
      expect(entry(key).manualRequirements, key).toBeUndefined();
    }
  });
  it('the started Fremennik Isles check stays until the quest is completed', () => {
    const u = createFreshState().unlocks;
    u.quests = ['The Fremennik Trials'];
    for (const key of ['Jatizso Ore Shop', 'Neitiznot Supplies']) {
      expect(analyzeRequirement(entry(key), u, 'vanilla').missingChecks, key).toContain('Confirm you have started The Fremennik Isles');
    }
    u.quests = ['The Fremennik Trials', 'The Fremennik Isles'];
    for (const key of ['Jatizso Ore Shop', 'Neitiznot Supplies']) {
      expect(analyzeRequirement(entry(key), u, 'vanilla').missingChecks, key).not.toContain('Confirm you have started The Fremennik Isles');
    }
  });
  it('Dragonfire Shield (Smithing) needs 90 Smithing and Dragon Slayer I started, not completed (Wiki: Dragonfire shield, Anti-dragon shield)', () => {
    const req = entry('Dragonfire Shield (Smithing)');
    expect(req.skills).toEqual({ Smithing: 90 });
    expect(req.quests ?? []).toEqual([]);
    expect(req.questProgress).toEqual([{ quest: 'Dragon Slayer I', label: expect.stringMatching(/started Dragon Slayer I/) }]);
    expect(req.manualRequirements).toBeUndefined();
    expect(req.description).toMatch(/Oziach 1,250,000 coins after Dragon Slayer I/);
  });
  it('Dragonfire Shield (Smithing) has no check left once Dragon Slayer I is completed', () => {
    const u = createFreshState().unlocks;
    u.regions = [...REGIONS_LIST];
    u.merchants = ['Dragonfire Shield'];
    u.skills.Smithing = 10;
    u.levels = { ...u.levels, Smithing: 90 };
    const started = analyzeRequirement(entry('Dragonfire Shield (Smithing)'), u, 'vanilla');
    expect(started.missingChecks.join(' ')).toMatch(/started Dragon Slayer I/);
    u.quests = ['Dragon Slayer I'];
    const done = analyzeRequirement(entry('Dragonfire Shield (Smithing)'), u, 'vanilla');
    expect(done.missingChecks).toEqual([]);
    expect(done.isFullyPlayable).toBe(true);
    // The pinned goal follows the card: it turns green once the quest is done.
    expect(calculateGoalProgress(entry('Dragonfire Shield (Smithing)'), u, 'vanilla').percentage).toBe(100);
  });
  const stock: [string, RegExp, RegExp][] = [
    // [entry, must match, must not match]. Wiki pages: Tony's Pizza Bases, Blair's Armour, Shayzien armour,
    // Hring Hring, Neitiznot Supplies, Grand Tree Groceries (store lines checked 23 Nov 2026).
    // Ore store: Mithril ore and Adamantite ore have stock=0, and Ironmen cannot buy overstock (Wiki: Ironman Mode).
    ['Wilderness Food Shop', /pizza bases/, /Stew/i],
    ['Shayzien Armourer', /Combat Ring/, /Anti-poison/i],
    ['Jatizso Ore Shop', /coal/i, /Rune Ore|up to adamantite/i],
    ['Neitiznot Supplies', /Thread/, /Rope|Yak/i],
    ['Grand Tree Groceries', /cocktail shaker/, /Gin\/Vodka|Herblore/],
  ];
  it.each(stock)('%s description matches the shop stock', (key, yes, no) => {
    const { description } = entry(key);
    expect(description).toMatch(yes);
    expect(description).not.toMatch(no);
  });
});

describe('requirements part B, deep pass 2: access the content needs', () => {
  const allAccess = () => {
    const u = createFreshState().unlocks;
    u.regions = [...REGIONS_LIST];
    u.quests = Object.keys(QUEST_DATA);
    for (const skill of SKILLS_LIST) u.skills[skill] = 10;
    u.levels = Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99]));
    u.merchants = ['Staff Shops', 'Stonemasons'];
    u.minigames = ['Granite Boots'];
    u.farming = ['Harmony Island', 'Herb'];
    u.mobility = ['Jewelry Teleports'];
    u.diaries = ['Morytania Elite'];
    return u;
  };
  const without = (quest: string) => { const u = allAccess(); u.quests = u.quests.filter((q: string) => q !== quest); return u; };

  it('Granite Boots needs Bone Voyage: the boots drop only from the Fossil Island wyverns (Wiki: Granite boots, Fossil Island)', () => {
    expect(entry('Granite Boots').quests).toEqual(['Bone Voyage']);
    expect(analyzeRequirement(entry('Granite Boots'), without('Bone Voyage'), 'vanilla').missingQuests).toEqual(['Bone Voyage']);
  });
  it('Mage Arena Staff Shop needs Mage Arena I; the god staves shop opens after the miniquest (Wiki: Mage Arena Staffs.)', () => {
    expect(entry('Mage Arena Staff Shop').quests).toEqual(['Mage Arena I']);
    const blocked = analyzeRequirement(entry('Mage Arena Staff Shop'), without('Mage Arena I'), 'vanilla');
    expect(blocked.isFullyPlayable).toBe(false);
    expect(blocked.missingQuests).toEqual(['Mage Arena I']);
    // Lundail's shop in the bank room has no gate.
    expect(entry("Lundail's Rune Shop").quests ?? []).toEqual([]);
  });
  it('Stonemason (Keldagrim) asks for The Giant Dwarf started until it is completed (Wiki: Fremennik Diary, Easy task 5)', () => {
    expect(entry('Stonemason').quests ?? []).toEqual([]);
    expect(entry('Stonemason').questProgress).toEqual([{ quest: 'The Giant Dwarf', label: expect.stringMatching(/started The Giant Dwarf/) }]);
    expect(analyzeRequirement(entry('Stonemason'), without('The Giant Dwarf'), 'vanilla').missingChecks.join(' ')).toMatch(/started The Giant Dwarf/);
    expect(analyzeRequirement(entry('Stonemason'), allAccess(), 'vanilla').isFullyPlayable).toBe(true);
  });
  it('Harmony Island (Herb Patch) needs The Great Brain Robbery started, as the area rule does, and the Elite Morytania Diary (Wiki: Harmony Island)', () => {
    const req = entry('Harmony Island (Herb Patch)');
    expect(req.quests ?? []).not.toContain('The Great Brain Robbery');
    expect(req.diaries).toEqual(['Morytania Elite']);
    const areaRule = AREA_ENTRY_ROUTES['Harmony Island'][0].questProgress;
    expect(req.questProgress).toEqual(areaRule);
    const started = analyzeRequirement(req, without('The Great Brain Robbery'), 'vanilla');
    expect(started.missingQuests).toEqual([]);
    expect(started.missingChecks).toEqual([areaRule![0].label]);
    const done = analyzeRequirement(req, allAccess(), 'vanilla');
    expect(done.missingChecks).toEqual([]);
    expect(done.isFullyPlayable).toBe(true);
  });
});
