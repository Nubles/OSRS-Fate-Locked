import { describe, expect, it } from 'vitest';
import chunkContent from '../public/chunk-content.json';
import diarySource from './sources/achievement-diary-tasks.json';
import { namedAreaChunks } from '../utils/reachability';
import { ALL_DIARY_TASKS, type DiaryTask, type DiaryTaskRequirementOption } from './diaryTasks';
import { ACTIVITY_ACCESS_AREAS } from './activityAccess';
import { QUEST_DATA } from './questData';
import { MERCHANT_SERVICES } from './merchantServices';
import type { UnlockState } from '../types';
import { evaluateDiaryTaskEligibility } from '../utils/journalStatus';

/**
 * Players reported wrong Achievement Diary data, so every task was checked
 * against the game: the OSRS Wiki's diary pages and the app's own map. The
 * owner approved the fixes on 2 October 2026. Each block below pins a fix;
 * the checks at the end catch the same kind of mistake in any task.
 */

const task = (id: string): DiaryTask => {
  const found = ALL_DIARY_TASKS.find(row => row.id === id);
  if (!found) throw new Error(`No Diary task ${id}`);
  return found;
};

/** An account with nothing unlocked but what a check names. */
const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...overrides,
});

describe('Diary tasks are in the areas the game has them in', () => {
  it('puts the Jaldraocht Pyramid altar beside the pyramid, not in Sophanem', () => {
    // The pyramid's chunk (50,45) has no area of its own; Bandit Camp and Pollnivneach border it.
    expect(task('des_hard_7')).toMatchObject({ anyOfRegions: ['Bandit Camp', 'Pollnivneach'] });
    expect(task('des_hard_7').regions).toBeUndefined();
  });

  it('puts the Shadow Dungeon at Baxtorian Falls, where it is entered', () => {
    expect(task('kan_hard_7').regions).toEqual(['Baxtorian Falls']);
  });

  it('puts the Nature Altar in Shilo Village’s chunk, reached from Tai Bwo Wannai', () => {
    for (const id of ['kar_hard_4', 'kar_elite_1']) {
      expect(task(id), id).toMatchObject({ anyOfRegions: ['Shilo Village', 'Tai Bwo Wannai'] });
      expect(task(id).regions, id).toBeUndefined();
    }
  });

  it('puts the Thermonuclear Smoke Devil, and its roll, in the Feldip Hills', () => {
    // The Smoke Devil Dungeon is entered in Jiggig Swamp (37,47), not at Castle Wars.
    expect(task('west_elite_2')).toMatchObject({
      regions: ['Feldip Hills'], bosses: ['Thermonuclear Smoke Devil'],
    });
    expect(ACTIVITY_ACCESS_AREAS['Thermonuclear Smoke Devil']).toEqual(['Feldip Hills']);
  });

  it('needs the Kharazi Jungle to eat an oomlie wrap, as for its palm leaves', () => {
    expect(task('kar_hard_3')).toMatchObject({
      regions: ['Kharazi Jungle'],
      questProgress: [expect.objectContaining({ quest: "Legends' Quest" })],
    });
    expect(task('kar_hard_8')).toMatchObject({
      regions: ['Kharazi Jungle'],
      questProgress: [expect.objectContaining({ quest: "Legends' Quest" })],
    });
  });

  it('needs Falador to buy the Isafdar painting from Sir Renitee', () => {
    expect(task('west_hard_10').regions).toEqual(['Falador']);
  });
});

describe('Diary tasks name the area that owns their chunk on the map', () => {
  // The owner kept the map and moved the tasks: each place is in a chunk the
  // map gives to the area beside the one the task names.
  it.each([
    ['kan_med_8', 'Camelot', 'the Catherby farming patches are in 43,54'],
    ['kan_elite_2', 'Camelot', 'the Catherby herb patch is in 43,54'],
    ['des_hard_2', 'Agility Pyramid', 'the granite quarry is in 49,45'],
    ['kar_easy_4', 'Port Sarim', 'the dock east of Musa Point is in 46,49'],
    ['ard_hard_11', 'East Ardougne', 'the anvil near West Ardougne is in 39,52'],
    ['lum_hard_10', 'Mage Training Arena', 'the altar at Emir’s Arena is in 52,51'],
  ])('tags %s with %s, because %s', (id, area) => {
    expect(task(id).regions).toEqual([area]);
  });

  it('still needs Plague City progress to smith the shield in West Ardougne', () => {
    expect(task('ard_hard_11').questProgress).toEqual([expect.objectContaining({ quest: 'Plague City' })]);
  });
});

describe('Diary trips need the place you leave from and the place you arrive in', () => {
  // The owner's rule: a travel task needs both ends of the trip.
  it.each([
    ['des_med_5', 'the magic carpet to Uzer', ['Shantay Pass', 'Ruins of Uzer']],
    ['des_easy_11', 'the magic carpet to Pollnivneach', ['Shantay Pass', 'Pollnivneach']],
    ['fal_easy_8', 'the boat to Entrana', ['Port Sarim', 'Entrana']],
    ['kar_easy_5', 'the boat from Brimhaven to Ardougne', ['Brimhaven', 'East Ardougne']],
    ['lum_hard_6', 'the train from Dorgesh-Kaan to Keldagrim', ['Lumbridge', 'Keldagrim']],
    ['ard_easy_8', 'the Ardougne lever to the Deserted Keep (49,61)', ['East Ardougne', 'Mage Arena']],
    ['wild_hard_8', 'the shortcut from Trollheim (45,57)', ['Burthorpe', 'Wilderness God Wars Dungeon']],
    ['frem_med_8', 'the walk from Waterbirth Island to the Lighthouse', ['Lighthouse', 'Waterbirth Island']],
    ['kan_med_4', 'the Water Obelisk grapple, reached through Taverley Dungeon', ['Catherby', 'Taverley']],
    ['kan_hard_5', 'the Water Obelisk, reached through Taverley Dungeon', ['Catherby', 'Taverley']],
  ] as const)('tags %s with each area %s passes through', (id, _trip, areas) => {
    expect(task(id).regions).toEqual(areas);
  });

  it('takes the boat to Land’s End from Port Sarim or Port Piscarilius', () => {
    expect(task('kou_easy_6')).toMatchObject({
      regions: ["Land's End"], anyOfRegions: ['Port Sarim', 'Piscarilius'],
    });
  });

  it('lands either Wilderness lever at the Deserted Keep', () => {
    expect(task('wilderness_easy_2')).toMatchObject({
      regions: ['Mage Arena'], anyOfRegions: ['East Ardougne', 'Edgeville'],
    });
  });
});

/** North of the Shantay Pass: no desert heat, and the Desert Diary's areas leave them out. */
const NOT_DESERT = ['Al Kharid', 'Duel Arena / PvP Arena', 'Mage Training Arena'];
const placesOf = (row: DiaryTask): string[] => [
  ...(row.regions ?? []), ...(row.anyOfRegions ?? []), ...(row.oneOf ?? []).flatMap(option => option.regions ?? []),
];

describe('Desert Diary tasks done in the desert', () => {
  it('accept any desert area for a combat potion, Humidify and Ice Barrage', () => {
    for (const id of ['des_med_8', 'des_hard_3', 'des_elite_2']) {
      expect(task(id).anyOfRegions, id).toEqual([
        'Shantay Pass', 'Pollnivneach', 'Nardah', 'Sophanem', 'Menaphos', 'Bandit Camp', 'Bedabin Camp',
        'Ruins of Uzer', 'Agility Pyramid', "Giants' Plateau", 'Kalphite Lair', 'Ruins of Unkah',
      ]);
    }
  });

  it('never accept Al Kharid, the Duel Arena or the Mage Training Arena', () => {
    // The Desert Diary's areas are "Kharidian Desert (not including Al Kharid)" (wiki rev 15280543).
    const inTheDesert = ALL_DIARY_TASKS.filter(row => row.tierId.startsWith('Desert') && /\bdesert\b/i.test(row.description));
    expect(inTheDesert.map(row => row.id)).toEqual(expect.arrayContaining(['des_med_8', 'des_hard_3', 'des_elite_2']));
    for (const row of inTheDesert) {
      expect(placesOf(row).filter(area => NOT_DESERT.includes(area)), row.id).toEqual([]);
    }
  });
});

/** The quests the map makes you finish before you may enter a chunk, by chunk id (cx * 256 + cy). */
const MAP_QUEST_GATES = (chunkContent as { questSections: Record<string, string[]> }).questSections;
type Chunk = { cx: number; cy: number };

/** Every quest that must be done before `quest`, by QUEST_DATA's prerequisites. */
const prerequisitesOf = (quest: string, into = new Set<string>()): Set<string> => {
  for (const before of QUEST_DATA[quest]?.prereqs ?? []) {
    if (into.has(before)) continue;
    into.add(before);
    prerequisitesOf(before, into);
  }
  return into;
};

/** A chunk's gate quests, each with the quests it needs first. */
const gatesOfChunk = ({ cx, cy }: Chunk): Set<string> => {
  const gates = new Set<string>();
  for (const quest of MAP_QUEST_GATES[String(cx * 256 + cy)] ?? []) {
    gates.add(quest);
    prerequisitesOf(quest, gates);
  }
  return gates;
};

/** What every one of several places needs: one place is enough, so only the quests all of them need. */
const commonTo = (sets: readonly Set<string>[]): Set<string> => (sets.length
  ? new Set([...sets[0]].filter(quest => sets.every(set => set.has(quest))))
  : new Set());

/** The quests an area needs: the gate on any of its chunks. (No area a task names is only partly gated.) */
const areaGates = (area: string): Set<string> => new Set(namedAreaChunks(area).flatMap(chunk => [...gatesOfChunk(chunk)]));

/** The quests a requirement's areas and places need. */
const gatesNeeded = (requirement: DiaryTaskRequirementOption & { anyOfRegions?: string[] }): Set<string> => {
  const needed = new Set<string>();
  const add = (set: Set<string>) => set.forEach(quest => needed.add(quest));
  for (const area of requirement.regions ?? []) add(areaGates(area));
  if (requirement.anyOfRegions?.length) add(commonTo(requirement.anyOfRegions.map(areaGates)));
  for (const location of requirement.locations ?? []) add(commonTo(location.chunkOptions.map(gatesOfChunk)));
  return needed;
};

/** The quests a requirement shows are done: those it lists, what they need first, and what a quest in progress needed first. */
const questsDone = (...requirements: (DiaryTaskRequirementOption | undefined)[]): Set<string> => {
  const done = new Set<string>();
  for (const requirement of requirements) {
    for (const quest of requirement?.quests ?? []) {
      done.add(quest);
      prerequisitesOf(quest, done);
    }
    for (const { quest } of requirement?.questProgress ?? []) prerequisitesOf(quest, done);
  }
  return done;
};

/** Gate quests a task's areas need but no route of it shows are done. */
const missingGates = (row: DiaryTask): string[] => {
  if (row.allQuests) return [];
  const missing = new Set<string>();
  const routes = row.oneOf?.length ? row.oneOf : [undefined];
  for (const route of routes) {
    if (route?.allQuests) continue;
    const done = questsDone(row, route);
    const needed = new Set([...gatesNeeded(row), ...(route ? gatesNeeded(route) : [])]);
    needed.forEach(quest => { if (!done.has(quest)) missing.add(quest); });
  }
  return [...missing].sort();
};

describe('Diary tasks behind a quest gate on the map', () => {
  it('ask for Priest in Peril wherever Morytania’s map gate needs it', () => {
    // The map puts 40 Morytania chunks, Paterdomus's among them, behind Priest in Peril.
    for (const id of [
      'mor_easy_1', 'mor_easy_2', 'mor_easy_4', 'mor_easy_5', 'mor_easy_6', 'mor_easy_7', 'mor_easy_8',
      'mor_easy_9', 'mor_easy_10', 'mor_med_1', 'mor_med_2', 'mor_med_3', 'mor_med_4', 'mor_med_8',
      'mor_hard_2', 'mor_hard_7', 'mor_hard_9', 'mor_elite_3', 'mor_elite_4', 'mor_elite_5', 'mor_elite_6',
    ]) {
      expect(task(id).quests, id).toContain('Priest in Peril');
    }
    // Killing a ghoul and the Salve bridge shortcut are tagged Paterdomus, whose chunk is behind the gate.
    expect(task('mor_easy_7')).toMatchObject({ regions: ['Paterdomus'], quests: ['Priest in Peril'] });
    expect(task('mor_hard_9')).toMatchObject({ regions: ['Paterdomus'], quests: ['Priest in Peril'] });
  });

  it('keep the quests they had before Priest in Peril', () => {
    expect(task('mor_med_8').quests).toEqual(['Dwarf Cannon', 'Priest in Peril']);
    expect(task('mor_elite_3').quests).toEqual(['Lunar Diplomacy', 'Priest in Peril']);
  });

  it('list the quest that opens every area they need, or a quest that needs it first', () => {
    const gated = ALL_DIARY_TASKS.filter(row => [...gatesNeeded(row), ...(row.oneOf ?? []).flatMap(option => [...gatesNeeded(option)])].length);
    // The check covers the Morytania tasks, Mos Le'Harmless and Harmony Island.
    expect(gated.length).toBeGreaterThan(30);
    const missing = Object.fromEntries(gated.map(row => [row.id, missingGates(row)]).filter(([, quests]) => quests.length));
    expect(missing).toEqual({});
  });

  it('finds a missing gate quest, so the check can fail', () => {
    expect(missingGates({ id: 'probe', tierId: 'Morytania Easy', description: 'Kill a Ghoul.', regions: ['Paterdomus'] }))
      .toEqual(['Priest in Peril']);
    expect(missingGates({ id: 'probe', tierId: 'Morytania Easy', description: 'Kill a Ghoul.', regions: ['Paterdomus'], quests: ['Nature Spirit'] }))
      .toEqual([]);
    expect(missingGates({ id: 'probe', tierId: 'Morytania Hard', description: 'Visit Mos Le’Harmless.', anyOfRegions: ["Mos Le'Harmless", 'Harmony Island'] }))
      .toEqual(expect.arrayContaining(['Cabin Fever', 'Priest in Peril']));
  });
});

/** The source rows, for what the wiki says each task needs (`sourceRequirements`). */
const SOURCE_REQUIREMENTS = new Map((diarySource as { tasks: { id: string; sourceRequirements?: string }[] }).tasks
  .map(row => [row.id, row.sourceRequirements ?? '']));
const barbarianProgress = (row: DiaryTask): string[] => [row, ...(row.oneOf ?? [])]
  .flatMap(requirement => requirement.questProgress ?? [])
  .filter(progress => progress.quest === 'Barbarian Training')
  .map(progress => progress.label);

describe('Diary tasks that use a barbarian skill', () => {
  // Barbarian Training (wiki rev 15359145): Tai Bwo Wannai Trio is "not required to start"; only Otto's
  // spear and hasta smithing needs it. Each task needs its own part of the miniquest, not all of it.
  it.each([
    ['kan_hard_1', 'Learned heavy rod fishing in Barbarian Training'],
    ['kan_hard_6', 'Learned to light fires with a bow in Barbarian Training'],
    ['kan_hard_8', 'Finished bow firemaking in Barbarian Training, which opens the Ancient Cavern'],
    ['kan_hard_11', 'Learned to smith spears in Barbarian Training'],
    ['kan_elite_3', 'Learned barehanded fishing in Barbarian Training'],
    ['kan_elite_4', 'Finished the Herblore part of Barbarian Training'],
    ['kan_elite_5', 'Learned to smith hastae in Barbarian Training'],
    ['kan_elite_6', 'Learned to build pyre ships in Barbarian Training'],
    ['mor_elite_1', 'Learned barehanded fishing in Barbarian Training'],
  ])('asks %s for its part of Barbarian Training: %s', (id, label) => {
    expect(barbarianProgress(task(id))).toEqual([label]);
  });

  it('asks for Tai Bwo Wannai Trio only where Otto teaches smithing', () => {
    expect(task('kan_hard_11').quests).toEqual(['Tai Bwo Wannai Trio']);
    expect(task('kan_elite_5').quests).toEqual(['Tai Bwo Wannai Trio']);
    for (const id of ['kan_hard_1', 'kan_hard_6', 'kan_hard_8', 'kan_elite_3', 'kan_elite_4', 'kan_elite_6', 'mor_elite_1']) {
      expect(task(id).quests ?? [], id).not.toContain('Tai Bwo Wannai Trio');
    }
  });

  it('use the bare-handed route on the Catherby sharks, and no item stands for the training', () => {
    const bareHanded = task('kan_elite_3').oneOf?.find(option => option.label === 'Bare-handed fishing');
    expect(bareHanded).toMatchObject({ skills: { Fishing: 96, Strength: 76 } });
    expect(bareHanded?.items).toBeUndefined();
    expect(task('mor_elite_1').items).toBeUndefined();
  });

  it('ask every task the wiki gives a barbarian skill for Barbarian Training progress, never the whole miniquest', () => {
    const barbarian = ALL_DIARY_TASKS.filter(row => /Access to Barbarian|or Barbarian Fishing/.test(SOURCE_REQUIREMENTS.get(row.id) ?? ''));
    expect(barbarian.map(row => row.id).sort()).toEqual([
      'kan_elite_3', 'kan_elite_4', 'kan_elite_5', 'kan_elite_6', 'kan_hard_1', 'kan_hard_11', 'kan_hard_6', 'kan_hard_8', 'mor_elite_1',
    ]);
    for (const row of barbarian) {
      expect(barbarianProgress(row), row.id).toHaveLength(1);
      for (const requirement of [row, ...(row.oneOf ?? [])]) {
        expect(requirement.quests ?? [], row.id).not.toContain('Barbarian Training');
        expect((requirement.items ?? []).filter(item => /Barbarian/.test(item)), row.id).toEqual([]);
      }
    }
  });
});

/** How task descriptions name the service NPCs in data/merchantServices.ts, when not by name. */
const SERVICE_NAMES: Readonly<Record<string, string>> = { Sawmill: 'Sawmill Operator', 'Nardah Herbalist': 'Zahur' };
const merchantsOf = (row: DiaryTask): string[] => [row, ...(row.oneOf ?? [])].flatMap(requirement => requirement.merchants ?? []);

describe('Diary tasks that use a shop or a service', () => {
  it.each([
    ['mor_easy_5', 'Tanners', 'Sbott tans a hide'],
    ['var_easy_4', 'Sawmill Operators', 'the Sawmill makes a plank'],
    ['var_med_10', 'Sawmill Operators', 'the Sawmill makes 20 mahogany planks'],
    ['kan_hard_10', 'Real Estate Agents', 'the Seers’ estate agent redecorates'],
    ['var_hard_7', 'Real Estate Agents', 'the Varrock estate agent redecorates'],
    ['des_med_11', 'Real Estate Agents', 'the house moves to Pollnivneach'],
    ['var_med_3', 'Pet Shops', 'Gertrude colours the kitten'],
    ['ard_easy_9', 'Hunter Shops', 'it views Aleck’s Hunter Emporium'],
    ['des_easy_6', 'Decanters', 'Zahur, the Nardah Herbalist, cleans the herb'],
    ['des_elite_4', 'Taxidermists', 'the Canifis taxidermist stuffs the KQ head'],
  ])('asks %s for %s, because %s', (id, merchant) => {
    expect(task(id).merchants).toEqual([merchant]);
  });

  it('lets an ironman reach Pollnivneach through the house portal, without teleport tablets', () => {
    // "Ironmen must instead enter their house via the Pollnivneach house portal" (wiki rev 15280543).
    expect(task('des_med_11')).toMatchObject({ skills: { Construction: 20 }, regions: ['Pollnivneach'] });
    expect(task('des_med_11').mobility).toBeUndefined();
  });

  it('needs Canifis, where the taxidermist stuffs the KQ head', () => {
    expect(task('des_elite_4')).toMatchObject({ regions: ['Canifis'], quests: ['Priest in Peril'] });
  });

  it('need the category of any service NPC they name', () => {
    const named: string[] = [];
    for (const row of ALL_DIARY_TASKS) {
      for (const [name, service] of [...Object.keys(MERCHANT_SERVICES).map(key => [key, key]), ...Object.entries(SERVICE_NAMES)]) {
        const npc = name.replace(/\s*\(.*\)$/, '');
        if (!new RegExp(`\\b${npc}\\b`, 'i').test(row.description)) continue;
        named.push(row.id);
        expect(merchantsOf(row), `${row.id} names ${npc}`).toContain(MERCHANT_SERVICES[service].category);
      }
    }
    expect([...new Set(named)].sort()).toEqual(['des_easy_6', 'kan_hard_10', 'mor_easy_5', 'var_easy_4', 'var_hard_7']);
  });
});

describe('Diary tasks that need a minigame’s or a boss’s loot', () => {
  // The owner's rule of 2 October 2026: loot counts like playing, on the route that uses it.
  it('needs Intelligence Gathering to deliver intelligence to Captain Ginea', () => {
    expect(task('kou_med_8')).toMatchObject({ regions: ['Shayzien'], minigames: ['Intelligence Gathering'] });
  });

  it('needs the TzHaar Fight Cave for a fire cape, and the Kalphite Queen for her head', () => {
    expect(task('kar_elite_4').bosses).toEqual(['TzHaar Fight Cave']);
    expect(task('des_elite_4').bosses).toEqual(['Kalphite Queen']);
  });

  it('needs Tai Bwo Wannai Cleanup only on the routes that use its trading sticks or gem rocks', () => {
    for (const [id, cleanupRoute] of [['kar_med_8', 'Hardwood Grove'], ['kar_med_9', 'Hardwood Grove'], ['kar_med_19', 'Tai Bwo Wannai Cleanup']]) {
      const row = task(id);
      expect(row.minigames, id).toBeUndefined();
      for (const option of row.oneOf ?? []) {
        expect(option.minigames, `${id} ${option.label}`).toEqual(option.label === cleanupRoute ? ['Tai Bwo Wannai Cleanup'] : undefined);
      }
    }
  });
});

describe('Diary tasks in Zanaris', () => {
  // Zanaris is entered "by wielding a dramen staff or lunar staff" (wiki rev 15351742). The Lumbridge
  // Elite reward, fairy rings without a staff, comes after these tiers, so it never waives the staff here.
  const STAFF = {
    slot: 'Weapon', tier: 1, reason: 'Dramen or lunar staff to enter Zanaris',
    manualCheck: 'Have Dramen or lunar staff to enter Zanaris and confirm that the specific item is permitted by your equipment tier',
  };

  it('needs a wielded dramen or lunar staff to get a Slayer task from Chaeldar', () => {
    expect(task('lum_med_10')).toMatchObject({
      quests: ['Lost City'], regions: ['Zanaris'], equipmentRequirements: [STAFF],
    });
    expect(task('lum_med_10').equipmentRequirements?.[0].unlessDiary).toBeUndefined();
  });

  it('reaches the cosmic altar with the staff or through the Abyss, after Lost City either way', () => {
    expect(task('lum_hard_2')).toMatchObject({
      quests: ['Lost City'], regions: ['Zanaris'],
      oneOf: [
        { label: 'Zanaris', equipmentRequirements: [STAFF] },
        { label: 'The Abyss', quests: ['Enter the Abyss'], regions: ['Edgeville'] },
      ],
    });
    // The altar takes a cosmic or catalytic talisman or tiara, unless you arrive through the Abyss.
    expect(task('lum_hard_3')).toMatchObject({
      quests: ['Lost City'], regions: ['Zanaris'],
      oneOf: [
        { label: 'Zanaris', items: ['Cosmic or catalytic talisman or tiara'], equipmentRequirements: [STAFF] },
        { label: 'The Abyss', quests: ['Enter the Abyss'], regions: ['Edgeville'] },
      ],
    });
  });
});

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('Diary tasks that need only part of a quest', () => {
  it.each(['frem_easy_9', 'frem_elite_5', 'frem_elite_6', 'wild_hard_8'])(
    'accepts %s with Troll Stronghold under way, or the Easy Combat Achievements', id => {
      // "Partial completion of the Troll Stronghold": it needs Death Plateau done, not Troll Stronghold.
      expect(task(id).oneOf).toEqual([
        {
          label: 'Troll Stronghold progress',
          quests: ['Death Plateau'],
          questProgress: [{ quest: 'Troll Stronghold', label: expect.stringContaining('Troll Stronghold') }],
        },
        { cas: ['Easy'] },
      ]);
      expect(task(id).quests ?? []).not.toContain('Troll Stronghold');
    },
  );

  it('smelts in The Forsaken Tower partway through the quest, after Client of Kourend', () => {
    // The pinned wiki text said completion; the current page says "Partial completion" (rev 15357910).
    expect(task('kou_hard_2')).toMatchObject({
      quests: ['Client of Kourend'],
      questProgress: [expect.objectContaining({ quest: 'The Forsaken Tower' })],
    });
  });

  it('boards the Swampy boat once Nature Spirit is started', () => {
    expect(task('mor_med_7')).toMatchObject({
      quests: ['Priest in Peril', 'The Restless Ghost'],
      questProgress: [{ quest: 'Nature Spirit', label: 'Started Nature Spirit' }],
    });
  });

  it('never ask for the whole quest where the wiki asks for part of it', () => {
    const quests = Object.keys(QUEST_DATA);
    const partial: string[] = [];
    for (const row of ALL_DIARY_TASKS) {
      const text = SOURCE_REQUIREMENTS.get(row.id) ?? '';
      for (const quest of quests) {
        const named = new RegExp(`(partial completion of|quest start of|started) (the )?${escapeRegExp(quest)}(?!\\w)`, 'i');
        if (!named.test(text)) continue;
        partial.push(row.id);
        for (const requirement of [row, ...(row.oneOf ?? [])]) {
          expect(requirement.quests ?? [], `${row.id} needs only part of ${quest}`).not.toContain(quest);
        }
      }
    }
    expect(partial).toEqual(expect.arrayContaining(['frem_easy_9', 'frem_elite_5', 'frem_elite_6', 'wild_hard_8', 'mor_med_7']));
  });
});

describe('Diary tasks in the Karuulm Slayer Dungeon', () => {
  const BOOTS = {
    slot: 'Boots', tier: 1, reason: 'Boots of stone, brimstone or granite', unlessDiary: 'Kourend Elite',
    manualCheck: 'Have Boots of stone, brimstone or granite and confirm that the specific item is permitted by your equipment tier',
  };

  it('needs boots of stone, brimstone or granite to kill a wyrm, unless the Kourend Elite reward is claimed', () => {
    expect(task('kou_hard_9')).toMatchObject({ regions: ['Mount Karuulm'], equipmentRequirements: [BOOTS] });
    const wyrmHunter = account({ regions: ['Mount Karuulm'], skills: { Slayer: 10 }, levels: { Slayer: 62 } });
    expect(evaluateDiaryTaskEligibility(task('kou_hard_9'), wyrmHunter).blockers)
      .toEqual([expect.objectContaining({ kind: 'equipment', slot: 'Boots', tier: 1 })]);
    expect(evaluateDiaryTaskEligibility(task('kou_hard_9'), { ...wyrmHunter, equipment: { Boots: 1 } }))
      .toMatchObject({ machineEligible: true, manualChecks: [BOOTS.manualCheck] });
    expect(evaluateDiaryTaskEligibility(task('kou_hard_9'), { ...wyrmHunter, diaries: ['Kourend Elite'] }))
      .toMatchObject({ eligible: true, blockers: [] });
  });
});
