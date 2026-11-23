import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { locateSlayerTask } from './slayerTaskLocations';
import corrections from '../data/sources/slayer-corrections.json';
import families from '../data/slayerTaskFamilies.json';
import familyExclusions from '../data/sources/slayer-family-exclusions.json';
import type { SlayerMasters } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { slayerReachability, type LocateFn } from './slayerReach';
import { isOnTaskRequirement, slayerLocate, slayerReason } from './slayerDecisions';
import { BOSSES_LIST, MISTHALIN_AREAS, MOBILITY_LIST, REGIONS_LIST, SKILLS_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { chunkContentService } from '../services/ChunkContentService';

/**
 * Slayer fixes from the accuracy audit (29 September 2026): the data import
 * dropped every skill gate and Krystilia's reward flag, and some levels were
 * wrong upstream.
 */
const MASTERS = (content as unknown as { slayerMasters: SlayerMasters }).slayerMasters;

const account = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, regions: [], mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [],
  storage: [], guilds: [], farming: [], slayerUnlocks: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
  skills: { Attack: 10, Strength: 10, Defence: 10, Hitpoints: 10, Prayer: 10, Ranged: 10, Magic: 10, Slayer: 10, Thieving: 10, Sailing: 10, Firemaking: 10 },
  levels: { Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99, Prayer: 99, Ranged: 99, Magic: 99, Slayer: 99, Thieving: 99, Sailing: 99, Firemaking: 99 },
  quests: ['Priest in Peril', 'Desert Treasure I', 'Bone Voyage', 'Troubled Tortugans', 'Death Plateau'],
  ...over,
});
const located = () => ({ cx: 50, cy: 50, unlocked: true, accessStatus: 'ALLOWED' as const });
/** Nieve's and Chaeldar's own requirements: where they stand, and Lost City for Zanaris. */
const masters = (over: Partial<UnlockState> = {}) => account({
  regions: ['Tree Gnome Stronghold', 'Zanaris'], quests: [...account().quests, 'Lost City'], ...over,
});
const row = (master: string, task: string, unlocks: UnlockState) => slayerReachability({ [master]: { [task]: MASTERS[master][task] } }, unlocks, located)
  .masters[0].rows[0];

describe('Slayer rows keep what the source asks for', () => {
  it('asks for the other skills a master needs, such as Defence 20 for basilisks', () => {
    const low = account({ levels: { ...account().levels, Defence: 15 } });
    expect(row('Vannaka', 'Basilisks', low)).toMatchObject({ status: 'slayer-locked', blocker: 'Defence 20' });
    expect(slayerReason(row('Vannaka', 'Basilisks', low))).toBe('Defence 20');
    expect(row('Vannaka', 'Basilisks', account()).status).toBe('ready');
    expect(MASTERS.Chaeldar['Cave krakens'].skills).toEqual({ Magic: 50 });
    expect(MASTERS.Vannaka['Harpie bug swarms'].skills).toEqual({ Firemaking: 33 });
  });

  it('asks for I Wildy More Slayer before Krystilia assigns her four reward tasks', () => {
    for (const task of ['Abyssal demons', 'Dust devils', 'Jellies', 'Nechryael']) {
      expect(MASTERS.Krystilia[task].unlock, task).toBe('I Wildy More Slayer');
      expect(row('Krystilia', task, account()), task).toMatchObject({ status: 'slayer-locked', blocker: 'Needs I Wildy More Slayer' });
      expect(row('Krystilia', task, account({ slayerUnlocks: ['I Wildy More Slayer'] })).status, task).toBe('ready');
    }
  });
});

describe('where a master’s task is fought', () => {
  const service = new ChunkContentService();
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
    await service.init();
    vi.unstubAllGlobals();
  });
  const places = (master: string, task: string, monster: string) =>
    locateSlayerTask(task, [service.entityLocations(monster, ['monster'])!], MASTERS[master][task], master);

  it('finds Krystilia’s earth warriors in the Edgeville Dungeon’s Wilderness part (S-7)', () => {
    const hits = places('Krystilia', 'Earth warriors', 'Earth warrior');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every(hit => /#wilderness$/i.test(hit.location.locationName ?? ''))).toBe(true);
  });

  it('finds Konar’s abyssal demons in the Abyss and dark beasts in the Mourner Tunnels (S-8)', () => {
    expect(places('Konar quo Maten', 'Abyssal demons - Abyss', 'Abyssal demon').length).toBeGreaterThan(0);
    expect(places('Konar quo Maten', 'Dark beasts - Mourner Tunnels', 'Dark beast').length).toBeGreaterThan(0);
  });

  const located = (master: string, task: string) => service.slayerLocations(task, MASTERS[master][task], master);
  const chunks = (master: string, task: string) => new Set(located(master, task).map(hit => `${hit.location.cx},${hit.location.cy}`));

  it('finds every task a Slayer reward adds where its master sends players (B5)', () => {
    for (const addition of [...corrections.additions, ...(corrections as unknown as { places: typeof corrections.additions }).places]) {
      expect(located(addition.master, addition.task).length, `${addition.master}/${addition.task}`).toBeGreaterThan(0);
    }
  });

  it('keeps Konar’s places apart and Krystilia’s aviansies in the Wilderness', () => {
    expect(chunks('Konar quo Maten', 'Lizardmen - Lizardman Canyon')).toEqual(new Set(['22,58', '23,57']));
    expect(chunks('Konar quo Maten', 'Basilisks - Fremennik Slayer Dungeon')).toEqual(new Set(['43,56']));
    expect(located('Konar quo Maten', "Red dragons - Myth's Guild").every(hit => /^Myth's Guild/.test(hit.location.locationName ?? ''))).toBe(true);
    const wilderness = located('Krystilia', 'Aviansies');
    expect(wilderness.length).toBeGreaterThan(0);
    expect(wilderness.every(hit => hit.location.locationName === 'Wilderness God Wars Dungeon')).toBe(true);
  });

  it('keeps Krystilia’s tasks in the Wilderness: not the Entrana Dungeon nor the King Black Dragon (slayer.d1[1])', () => {
    // Wiki "Entrana Dungeon" oldid 15353043 (its Wilderness door is an exit only) and "Krystilia" oldid 15389119.
    for (const task of ['Zombies', 'Black demons', 'Greater demons']) {
      expect(located('Krystilia', task).filter(hit => hit.location.locationName === 'Entrana Dungeon'), task).toEqual([]);
    }
    expect(located('Krystilia', 'Black dragons').map(hit => hit.name)).not.toContain('King Black Dragon');
    expect(located('Krystilia', 'Black dragons').length).toBeGreaterThan(0);
    expect(located('Vannaka', 'Greater demons').filter(hit => hit.location.locationName === 'Entrana Dungeon')
      .map(hit => `${hit.location.cx},${hit.location.cy}`)).toEqual(['44,52']);
  });

  it('finds no moved-out monster in the Revenant Caves, and the revenants still there (slayer.d2[0])', () => {
    // Wiki "Revenant Caves" oldid 15397220: the 2020 overhaul moved them to the Wilderness Slayer Cave.
    for (const [master, task] of [['Vannaka', 'Lesser demons'], ['Vannaka', 'Ankous'], ['Krystilia', 'Greater demons'], ['Nieve', 'Hellhounds'], ['Krystilia', 'Ice giants'], ['Krystilia', 'Green dragons']]) {
      const hits = located(master, task);
      expect(hits.filter(hit => hit.location.locationName === 'Revenant Caves'), `${master}/${task}`).toEqual([]);
      expect(hits.some(hit => hit.location.locationName === 'Wilderness Slayer Cave'), `${master}/${task}`).toBe(true);
    }
    expect(located('Krystilia', 'Revenants').some(hit => hit.location.locationName === 'Revenant Caves')).toBe(true);
  });

  it('names boss monsters the map knows', () => {
    for (const master of ['Konar quo Maten', 'Nieve', 'Krystilia']) {
      for (const boss of MASTERS[master].Bosses.bosses!) for (const monster of boss.monsters) {
        expect(service.entityLocations(monster, ['monster']), `${master}: ${monster}`).toBeTruthy();
      }
    }
  });

  it('asks for Like a Boss, then for one of the bosses to be unlocked', () => {
    const run = (unlocks: UnlockState) => slayerReachability({ Nieve: { Bosses: MASTERS.Nieve.Bosses } }, unlocks,
      slayerLocate(service, unlocks, undefined)).masters[0].rows[0];
    expect(run(masters())).toMatchObject({ status: 'slayer-locked', blocker: 'Needs Like a Boss' });
    const noBoss = run(masters({ slayerUnlocks: ['Like a Boss'] }));
    expect(noBoss).toMatchObject({ status: 'area-locked', blocker: 'Needs a boss unlock' });
    expect(slayerReason(noBoss)).toBe('Needs a boss unlock');
  });
});

describe('tasks a Slayer reward adds (accuracy audit S-6)', () => {
  it('add the 30 master and task pairs the wiki gates behind a reward, as reviewed', () => {
    for (const addition of corrections.additions) {
      expect(MASTERS[addition.master][addition.task], `${addition.master}/${addition.task}`).toEqual(addition.row);
      expect(SLAYER_UNLOCKS_LIST, addition.task).toContain(addition.row.unlock);
      expect(addition.wiki.every(url => corrections.sourceRevisions.some(source => source.url === url))).toBe(true);
    }
    expect(new Set(corrections.additions.map(addition => `${addition.master}/${addition.task.split(' - ')[0]}`)).size).toBe(30);
  });

  it('wait for their reward to be bought', () => {
    expect(row('Nieve', 'TzHaar', masters())).toMatchObject({ status: 'slayer-locked', blocker: 'Needs Hot Stuff' });
    expect(row('Nieve', 'TzHaar', masters({ slayerUnlocks: ['Hot Stuff'] })).status).toBe('ready');
    expect(row('Chaeldar', 'Lizardmen', masters())).toMatchObject({ blocker: 'Needs Reptile Got Ripped' });
    expect(row('Chaeldar', 'Lizardmen', masters({ slayerUnlocks: ['Reptile Got Ripped'] })).status).toBe('ready');
    expect(row('Krystilia', 'Aviansies', account())).toMatchObject({ blocker: 'Needs Watch the Birdie' });
  });
});

describe('gates a player on the task meets (accuracy audit S-9)', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
    await chunkContentService.init();
    vi.unstubAllGlobals();
  });

  it('count a monster’s own on-task gate as met, and a Wilderness one only for Krystilia', () => {
    for (const raw of ['Gargoyle task', 'Smoke devil Slayer task.', 'Cave kraken or Kraken Slayer task', 'Slayer task for basement monsters', 'Current Slayer assignment: Iron dragon']) {
      expect(isOnTaskRequirement(raw, 'Nieve'), raw).toBe(true);
    }
    expect(isOnTaskRequirement('Abyssal demon wilderness task', 'Krystilia')).toBe(true);
    expect(isOnTaskRequirement('Abyssal demon wilderness task', 'Vannaka')).toBe(false);
    for (const raw of ['Take port tasks from Catherby', 'Receive a Slayer assignment from Krystilia in Edgeville', 'Slayer Tower Task[+]', 'Priest in Peril Complete the quest']) {
      expect(isOnTaskRequirement(raw, 'Nieve'), raw).toBe(false);
    }
  });

  it('let an account with everything take the tasks only those gates held back', () => {
    const maxed = account({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
      regions: [...REGIONS_LIST, ...MISTHALIN_AREAS],
      mobility: [...MOBILITY_LIST],
      bosses: [...BOSSES_LIST],
      slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA),
    });
    const reach = slayerReachability(chunkContentService.slayerMasters(), maxed, slayerLocate(chunkContentService, maxed, 'vanilla'), 'vanilla');
    const status = (master: string, task: string) =>
      reach.masters.find(entry => entry.master === master)!.rows.find(row => row.monster === task)!.status;
    for (const [master, task] of [
      ['Nieve', 'Smoke devils'], ['Nieve', 'Gargoyles'], ['Nieve', 'Cave krakens'], ['Nieve', 'Kalphites'], ['Nieve', 'Frost dragons'],
      ['Duradel', 'Hellhounds'], ['Krystilia', 'Abyssal demons'], ['Krystilia', 'Magic axes'], ['Krystilia', 'Pirates'],
    ]) expect(status(master, task), `${master}/${task}`).toBe('ready');
  });
});

describe('quest-locked places the source marks as area unlocks (slayer.d3[0])', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
    await chunkContentService.init();
    vi.unstubAllGlobals();
  });
  const maxed = (without: string[] = []) => account({
    skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
    regions: [...REGIONS_LIST, ...MISTHALIN_AREAS],
    mobility: [...MOBILITY_LIST],
    bosses: [...BOSSES_LIST],
    slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
    quests: Object.keys(QUEST_DATA).filter(quest => !without.includes(quest)),
    diaries: Object.keys(DIARY_DATA),
  });
  const status = (unlocks: UnlockState, task: string) =>
    slayerReachability({ 'Konar quo Maten': { [task]: MASTERS['Konar quo Maten'][task] } }, unlocks, slayerLocate(chunkContentService, unlocks, 'vanilla'), 'vanilla')
      .masters[0].rows[0].status;

  it('asks for the quest that opens the only place Konar names', () => {
    for (const [task, quest] of [
      ["Basilisks - Jormungand's Prison", 'The Fremennik Exiles'],
      ["Dagannoths - Jormungand's Prison", 'The Fremennik Exiles'],
      ['Fire giants - Waterfall Dungeon', 'Waterfall Quest'],
    ]) {
      expect(status(maxed(), task), task).toBe('ready');
      expect(status(maxed([quest]), task), `${task} without ${quest}`).not.toBe('ready');
    }
  });
});

describe('boss tasks (Like a Boss)', () => {
  const names = (master: string) => MASTERS[master].Bosses.bosses!.map(boss => boss.name);

  it('come from Konar, Nieve, Duradel and Krystilia, with the wiki’s weights and bosses', () => {
    expect(Object.entries(MASTERS).filter(([, tasks]) => tasks.Bosses).map(([master]) => master).sort())
      .toEqual(['Duradel', 'Konar quo Maten', 'Krystilia', 'Nieve']);
    expect(MASTERS['Konar quo Maten'].Bosses).toMatchObject({ weight: 8, unlock: 'Like a Boss' });
    expect(MASTERS.Duradel.Bosses.weight).toBe(12);
    expect(names('Konar quo Maten')).toHaveLength(33);
    expect(names('Konar quo Maten')).toContain('Alchemical Hydra');
    expect(names('Nieve')).toHaveLength(32);
    expect(names('Duradel')).not.toContain('Alchemical Hydra');
    expect(names('Krystilia')).toEqual(['Callisto', 'Chaos Elemental', 'Chaos Fanatic', 'Crazy archaeologist', 'Scorpia', 'Venenatis', "Vet'ion"]);
    const archaeologist = (master: string) => MASTERS[master].Bosses.bosses!.find(boss => boss.name === 'Crazy archaeologist')!.monsters;
    expect(archaeologist('Konar quo Maten')).toEqual(['Crazy archaeologist']);
    expect(archaeologist('Nieve')).toEqual(['Crazy archaeologist', 'Deranged archaeologist']);
    expect(corrections.bossTasks.wiki.every(url => corrections.sourceRevisions.some(source => source.url === url))).toBe(true);
  });

  it('offer only the bosses whose Slayer level the run has', () => {
    const offered: string[][] = [];
    const record: LocateFn = (_task, assignment) => {
      offered.push((assignment?.bosses ?? []).map(boss => boss.name));
      return { cx: 1, cy: 1, unlocked: true, accessStatus: 'ALLOWED' };
    };
    const unlocks = masters({ levels: { ...account().levels, Slayer: 50 }, slayerUnlocks: ['Like a Boss'] });
    expect(slayerReachability({ Nieve: { Bosses: MASTERS.Nieve.Bosses } }, unlocks, record).masters[0].rows[0].status).toBe('ready');
    expect(offered[0]).toContain('Zulrah');
    expect(offered[0]).toContain('Vorkath');
    expect(offered[0]).not.toContain('Shellbane gryphon');
    expect(offered[0]).not.toContain('Cerberus');
  });
});

describe('reviewed Slayer corrections', () => {
  it('apply each correction to the generated rows', () => {
    for (const correction of corrections.corrections) {
      const generated = MASTERS[correction.master][correction.task];
      expect(generated, `${correction.master}/${correction.task}`).toBeDefined();
      expect(generated, `${correction.master}/${correction.task}`).toMatchObject(correction.set ?? {});
      for (const raw of correction.removeReq ?? []) expect(generated.req ?? [], raw).not.toContain(raw);
      expect(correction.wiki.every(url => corrections.sourceRevisions.some(source => source.url === url))).toBe(true);
    }
  });

  it('use the wiki\'s levels: basilisks 40 Slayer, Nieve\'s suqah and metal dragons 85 combat', () => {
    expect(MASTERS.Vannaka.Basilisks.slayer).toBe(40);
    expect(MASTERS.Mortimer.Basilisks.slayer).toBe(40);
    expect(MASTERS.Vannaka['Ice warriors'].combat).toBe(45);
    expect(MASTERS.Nieve.Suqah.combat).toBe(85);
    expect(MASTERS.Nieve['Metal dragons'].combat).toBe(85);
    expect(MASTERS.Nieve['Greater demons'].combat).toBe(75);
    expect(MASTERS.Duradel.Waterfiends.req).toBeUndefined();
  });
});

describe('Slayer rows from the November 2026 audit', () => {
  const konar = (family: string) => Object.entries(MASTERS['Konar quo Maten'])
    .filter(([task]) => task.startsWith(`${family} - `))
    .map(([task, info]) => ({ place: task.split(' - ')[1], ...info }));

  it('gives Konar\'s and Duradel\'s metal dragons from combat 85, in Konar\'s four places only (slayer[0], slayer[1])', () => {
    const dragons = konar('Metal dragons');
    expect(dragons.map(({ place }) => place).sort()).toEqual(['Brimhaven Dungeon', 'Catacombs of Kourend', 'Isle of Souls Dungeon', 'Lithkren Vault']);
    for (const dragon of dragons) expect(dragon.combat, dragon.place).toBe(85);
    expect(dragons.reduce((sum, { weight }) => sum + weight, 0)).toBe(15);
    expect(MASTERS.Duradel['Metal dragons'].combat).toBe(85);
    const low = account({ regions: ['Mount Karuulm'], levels: { ...account().levels, Attack: 65, Strength: 65, Defence: 65, Hitpoints: 65, Prayer: 50, Ranged: 60, Magic: 60 }, quests: [...account().quests, 'Dragon Slayer I'] });
    expect(row('Konar quo Maten', 'Metal dragons - Brimhaven Dungeon', low).status).toBe('combat-locked');
  });

  it('uses Duradel\'s own combat levels for greater demons and suqah (slayer[1])', () => {
    expect(MASTERS.Duradel['Greater demons'].combat).toBe(75);
    expect(MASTERS.Duradel.Suqah.combat).toBe(85);
  });

  it('gives Mortimer\'s venators from 74 Slayer and his bloodvelds weight 8 (slayer[2], slayer[5])', () => {
    expect(MASTERS.Mortimer.Venators.slayer).toBe(74);
    expect(MASTERS.Mortimer.Bloodvelds.weight).toBe(8);
  });

  it('asks for Bone Voyage and Elemental Workshop I before Fossil Island wyverns (slayer[3])', () => {
    for (const [master, task] of [['Chaeldar', 'Fossil Island Wyverns'], ['Nieve', 'Fossil Island Wyverns'], ['Duradel', 'Fossil Island Wyverns'], ['Konar quo Maten', 'Fossil Island Wyverns - Wyvern Cave']]) {
      expect(MASTERS[master][task].req, `${master}/${task}`).toEqual(['Bone Voyage Complete the quest', 'Elemental Workshop I Complete the quest']);
    }
  });

  it('sends Konar\'s trolls and wyrms to every place the wiki lists (slayer[4])', () => {
    expect(konar('Trolls').map(({ place }) => place).sort()).toEqual(['Death Plateau', 'Fremennik Isles', 'Keldagrim', 'Mount Quidamortem', 'Troll Stronghold', 'Wyrmscraig Cavern']);
    expect(konar('Trolls').every(({ weight }) => weight === 1)).toBe(true);
    expect(konar('Wyrms').map(({ place }) => place).sort()).toEqual(['Charred Dungeon', 'Karuulm Slayer Dungeon', 'Neypotzli', 'Wyrmscraig Cavern']);
    expect(konar('Wyrms').every(({ weight }) => weight === 2.5)).toBe(true);
  });

  it('cites a listed wiki revision for every removed or added place', () => {
    const extra = corrections as unknown as { removals: { wiki: string[] }[]; places: { wiki: string[] }[] };
    for (const entry of [...extra.removals, ...extra.places]) {
      expect(entry.wiki.every(url => corrections.sourceRevisions.some(source => source.url === url))).toBe(true);
    }
  });
});

describe('God Wars Dungeon tasks need 60 Strength or 60 Agility (slayer.d1[0])', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
    await chunkContentService.init();
    vi.unstubAllGlobals();
  });
  const maxed = (strength: number, agility: number) => {
    const unlocks = account({
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: { ...Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])), Strength: strength, Agility: agility },
      regions: [...REGIONS_LIST, ...MISTHALIN_AREAS],
      mobility: [...MOBILITY_LIST],
      bosses: [...BOSSES_LIST],
      slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA),
    });
    return unlocks;
  };
  const status = (master: string, task: string, unlocks: UnlockState, mode = 'vanilla') =>
    slayerReachability({ [master]: { [task]: MASTERS[master][task] } }, unlocks, slayerLocate(chunkContentService, unlocks, mode), mode)
      .masters[0].rows[0].status;
  const tasks: [string, string][] = [
    ['Krystilia', 'Aviansies'], ['Krystilia', 'Bloodvelds'], ['Krystilia', 'Spiritual creatures'],
    ['Nieve', 'Spiritual creatures'], ['Nieve', 'Aviansies'], ['Vannaka', 'Spiritual creatures'],
    ['Konar quo Maten', 'Aviansies - God Wars Dungeon'], ['Konar quo Maten', 'Bloodvelds - God Wars Dungeon'],
  ];

  it('are not ready below both levels, and ready with either', () => {
    for (const [master, task] of tasks) {
      expect(status(master, task, maxed(50, 50)), `${master} ${task} at 50/50`).not.toBe('ready');
      expect(status(master, task, maxed(60, 1)), `${master} ${task} with 60 Strength`).toBe('ready');
      expect(status(master, task, maxed(1, 60)), `${master} ${task} with 60 Agility`).toBe('ready');
    }
  });

  it('keep tasks with other places open: Nieve’s bloodvelds and Konar’s Slayer Tower bloodvelds', () => {
    expect(status('Nieve', 'Bloodvelds', maxed(50, 50))).toBe('ready');
    expect(status('Konar quo Maten', 'Bloodvelds - Slayer Tower', maxed(50, 50))).toBe('ready');
  });
});

/**
 * Map monsters whose own Wiki page (infobox_monster slayer_category, live query
 * 23 November 2026) puts them in a task the family left out (slayer.d1[2]).
 */
const WIKI_CATEGORY_GAPS = `
  spiders|Acidic Araxyte
  araxytes|Acidic Araxyte
  shades|Asyn shadow (Temple Trekking)
  rats|Blessed giant rat
  hellhounds|Bouncer
  ogres|City guard
  hill giants|Cyclops (Ardougne Zoo)
  hill giants|Cyclops (Catacombs of Kourend)
  dagannoths|Dagannoth Rex
  dagannoths|Dagannoth Supreme
  birds|Duckling
  green dragons|Elvarg
  ogres|Enclave guard
  birds|Evil Chicken
  ghosts|Ghost (Grave of Scorpius)
  ghosts|Ghost (Melzar's Maze)
  skeletons|Giant skeleton (Shadow Dungeon)
  skeletons|Giant skeleton (Tarn's Lair)
  goblins|Goblin (Goblin Village)
  goblins|Goblin (God Wars Dungeon)
  goblins|Goblin guard
  ogres|Gorad
  skeletons|Greater Skeleton Hellhound (Calvar'ion)
  skeletons|Greater Skeleton Hellhound (Vet'ion)
  goblins|Guard (Cave goblin)
  ghosts|Haze
  tzhaar|Jal-Ak
  tzhaar|Jal-ImKot
  tzhaar|Jal-MejJak
  tzhaar|Jal-MejRah
  tzhaar|Jal-Nib
  tzhaar|Jal-Xil
  tzhaar|Jal-Zek
  tzhaar|JalTok-Jad
  tzhaar|Ket-Zek
  lizardmen|Lizardman shaman (Chambers of Xeric)
  monkeys|Maniacal Monkey Archer
  spiders|Mirrorback Araxyte
  araxytes|Mirrorback Araxyte
  monkeys|Monkey Archer
  birds|Mounted terrorbird gnome
  ogres|Ogre chieftain
  ghosts|Revenant cyclops
  ghosts|Revenant dark beast
  ghosts|Revenant demon
  ghosts|Revenant dragon
  ghosts|Revenant goblin
  ghosts|Revenant hellhound
  ghosts|Revenant hobgoblin
  ghosts|Revenant imp
  ghosts|Revenant knight
  ghosts|Revenant ork
  ghosts|Revenant pyrefiend
  shades|Riyl shadow (Temple Trekking)
  spiders|Ruptura Araxyte
  araxytes|Ruptura Araxyte
  chaos druids|Salarin the twisted
  scorpions|Scorpia's offspring (monster)
  goblins|Sergeant Grimspike
  goblins|Sergeant Steelwill
  shades|Shade (Temple Trekking)
  skeletons|Skeletal Mystic
  skeletons|Skeletal miner
  skeletons|Skeleton (Catacombs of Kourend)
  skeletons|Skeleton (Forthos Ruin)
  skeletons|Skeleton (Lucien's camp)
  skeletons|Skeleton (Wilderness Agility Course)
  skeletons|Skeleton Hellhound (Calvar'ion)
  skeletons|Skeleton Hellhound (Vet'ion)
  skeletons|Skeleton brute
  skeletons|Skeleton fremennik
  skeletons|Skeleton heavy
  skeletons|Skeleton hero
  skeletons|Skeleton thug
  skeletons|Skeleton warlord
  zombies|Skogre
  zombies|Summoned Zombie
  tzhaar|Tok-Xil
  tzhaar|Tz-Kek
  tzhaar|Tz-Kih
  skeletons|Undead one
  goblins|Wormbrain
  tzhaar|Yt-HurKot
  tzhaar|Yt-MejKot
  zombies|Zombie (Entrana Dungeon)
  zombies|Zombie (Kourend)
  zombies|Zombie (Melzar's Maze)
  zombies|Zombie (Sepulchre of Death)
  zombies|Zombie (Shayzien Crypts)
  zombies|Zombie (Stronghold of Security)
  zombies|Zombie (Tarn's Lair)
  zombies|Zombie (Temple Trekking)
  zombies|Zombie (Wilderness)
  pirates|Zombie pirate
  zombies|Zombie pirate (Harmony Island)
`.trim().split('\n').map(line => line.trim().split('|') as [string, string]);

describe('task families hold every map monster the Wiki counts for the task (slayer.d1[2])', () => {
  const service = new ChunkContentService();
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
    await service.init();
    vi.unstubAllGlobals();
  });
  const list = families.families as Record<string, string[]>;
  const excluded: Record<string, Record<string, string>> = familyExclusions.excluded;

  it('list each audited monster, or leave it out with a reason (event, boss-fight spawn, raid or quest only)', () => {
    expect(WIKI_CATEGORY_GAPS).toHaveLength(95);
    for (const [family, name] of WIKI_CATEGORY_GAPS) {
      const listed = list[family].includes(name);
      const reason = excluded[family]?.[name];
      expect(listed !== Boolean(reason), `${family}: ${name}`).toBe(true);
    }
    for (const [family, names] of Object.entries(excluded)) for (const [name, reason] of Object.entries(names)) {
      expect(list[family], family).toBeDefined();
      expect(list[family].includes(name), `${family}: ${name}`).toBe(false);
      expect(reason.trim().length, `${family}: ${name}`).toBeGreaterThan(0);
    }
  });

  it('count Krystilia’s zombies at the Graveyard of Shadows, her pirates at the Chaos Temple and ghosts in the Revenant Caves', () => {
    const at = (master: string, task: string, monster: string) =>
      locateSlayerTask(task, [service.entityLocations(monster, ['monster'])!], MASTERS[master][task], master);
    expect(at('Krystilia', 'Zombies', 'Zombie (Wilderness)').length).toBeGreaterThan(0);
    expect(at('Krystilia', 'Pirates', 'Zombie pirate').length).toBeGreaterThan(0);
    expect(at('Mazchna', 'Ghosts', 'Revenant imp').map(hit => hit.location.locationName)).toContain('Revenant Caves');
    expect(at('Nieve', 'Dagannoths', 'Dagannoth Rex').length).toBeGreaterThan(0);
  });
});
