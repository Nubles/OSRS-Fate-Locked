import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { locateSlayerTask } from './slayerTaskLocations';
import corrections from '../data/sources/slayer-corrections.json';
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
    for (const addition of corrections.additions) {
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
    expect(MASTERS.Duradel['Fossil Island Wyverns'].req).toEqual(['Bone Voyage Complete the quest']);
    expect(MASTERS.Duradel.Waterfiends.req).toBeUndefined();
  });
});
