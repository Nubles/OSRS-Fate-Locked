import { describe, expect, it } from 'vitest';
import content from '../public/chunk-content.json';
import corrections from '../data/sources/slayer-corrections.json';
import type { SlayerMasters } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { slayerReachability } from './slayerReach';
import { slayerReason } from './slayerDecisions';

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
