import { describe, expect, it } from 'vitest';
import corrections from '../data/sources/slayer-corrections.json';
import { initialState } from '../context/GameContext';
import { DropSource, type UnlockState } from '../types';
import { BOSSES_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import { FARM_SLAYER_CARD_CHUNKS, SLAYER_MASTER_CHUNKS } from '../data/activityChunks';
import { SLAYER_MASTER_REQUIREMENTS } from '../data/slayerMasterRequirements';
import { BOSS_TASK_BOSSES, BOSS_TASK_SLAYER_LEVELS, BOSS_TASK_UNLOCK } from '../data/slayerBossTasks';
import { vanillaBossKeyStage } from '../config/vanillaKeyEconomy';
import { canonicalBossId, canonicalQuestId } from './contentIdentity';
import {
  BOSS_TASK_ALL_SPENT, BOSS_TASK_NEEDS_BOSS, BOSS_TASK_NEEDS_MASTER, BOSS_TASK_NEEDS_TIER, BOSS_TASK_NEEDS_UNLOCK,
  BOSS_TASK_ROLL_ON_CARD, SLAYER_CARD_MASTER, SLAYER_LOCKED,
  bossTaskChoices, slayerCardBlock, slayerMasterBlock, slayerMasterFloor, slayerSourceBlock,
} from './farmGates';

const run = (unlocks: Partial<UnlockState> = {}): UnlockState => ({ ...initialState.unlocks, ...unlocks });
const slayer = (tier: number, unlocks: Partial<UnlockState> = {}) =>
  run({ ...unlocks, skills: { ...initialState.unlocks.skills, Slayer: tier, ...unlocks.skills } });

type BossTaskRule = { only?: string[]; except?: string[]; noSubstitutes?: string[] };
type BossTaskRow = { boss: string; slayer?: number; monsters?: string[]; substitutes?: string[] };

describe('boss task data (data/slayerBossTasks.ts)', () => {
  const source = corrections.bossTasks as unknown as { unlock: string; masters: Record<string, BossTaskRule>; bosses: BossTaskRow[] };

  it('matches slayer-corrections.json as the chunk content generator reads it', () => {
    expect(BOSS_TASK_UNLOCK).toBe(source.unlock);
    expect(SLAYER_UNLOCKS_LIST).toContain(BOSS_TASK_UNLOCK);
    expect(Object.keys(BOSS_TASK_BOSSES).sort()).toEqual(Object.keys(source.masters).sort());
    for (const [master, rule] of Object.entries(source.masters)) {
      // scripts/chunk-content-transform.mjs: only/except pick the bosses; substitutes count unless noSubstitutes.
      const expected = source.bosses
        .filter(({ boss }) => (!rule.only || rule.only.includes(boss)) && !(rule.except ?? []).includes(boss))
        .flatMap(({ boss, monsters, substitutes }) => [boss, ...(monsters ?? []),
          ...((rule.noSubstitutes ?? []).includes(boss) ? [] : substitutes ?? [])])
        .map(name => canonicalBossId(name));
      expect(expected, master).not.toContain(undefined);
      expect([...BOSS_TASK_BOSSES[master]].sort(), master).toEqual([...new Set(expected)].sort());
    }
  });

  it('keeps each boss’s Slayer level, and names only bosses the app knows', () => {
    const levels = Object.fromEntries(source.bosses.filter(row => row.slayer).map(row => [canonicalBossId(row.boss), row.slayer]));
    expect(BOSS_TASK_SLAYER_LEVELS).toEqual(levels);
    for (const boss of Object.values(BOSS_TASK_BOSSES).flat()) expect(BOSSES_LIST, boss).toContain(boss);
  });
});

describe('Slayer master gates', () => {
  it('maps every Farm Keys card to a master with requirements and a chunk', () => {
    expect(Object.keys(SLAYER_CARD_MASTER).sort())
      .toEqual(Object.keys(FARM_SLAYER_CARD_CHUNKS).filter(card => card !== 'Boss Task').sort());
    for (const master of new Set(Object.values(SLAYER_CARD_MASTER))) {
      expect(SLAYER_MASTER_REQUIREMENTS[master], master).toBeDefined();
      expect(SLAYER_MASTER_CHUNKS[master], master).toBeDefined();
    }
    // The quest gate compares names with the run's completed quest ids.
    for (const quest of Object.values(SLAYER_MASTER_REQUIREMENTS).flatMap(req => req.quests ?? [])) {
      expect(canonicalQuestId(quest), quest).toBe(quest);
    }
  });

  it('reads the least Slayer level of every way in, ignoring combat level', () => {
    expect(slayerMasterFloor('Duradel')).toBe(50);
    expect(slayerMasterFloor('Mortimer')).toBe(70);
    // Konar: a Slayer cape or combat 75; combat isn't tracked, so no Slayer floor.
    expect(slayerMasterFloor('Konar quo Maten')).toBe(0);
    expect(slayerMasterFloor('Turael')).toBe(0);
  });

  it('greys out every master while Slayer is locked (Vanilla)', () => {
    for (const card of Object.keys(SLAYER_CARD_MASTER)) {
      expect(slayerCardBlock(card, run(), 'vanilla'), card).toBe(SLAYER_LOCKED);
    }
  });

  it('asks for the master’s area and quests in Vanilla', () => {
    const open = slayer(1);
    expect(slayerCardBlock('Turael', open, 'vanilla')).toBe('Needs the Burthorpe area');
    expect(slayerCardBlock('Aya', open, 'vanilla')).toBe('Needs the Burthorpe area');
    // Edgeville is in free Misthalin.
    expect(slayerCardBlock('Vannaka', open, 'vanilla')).toBeNull();
    expect(slayerCardBlock('Krystilia', open, 'vanilla')).toBeNull();
    expect(slayerCardBlock('Spria', open, 'vanilla')).toBe('Needs the A Porcine of Interest quest');
    expect(slayerCardBlock('Spria', slayer(1, { quests: ['A Porcine of Interest'] }), 'vanilla')).toBeNull();
    expect(slayerCardBlock('Turael', slayer(1, { regions: ['Burthorpe'] }), 'vanilla')).toBeNull();
    expect(slayerCardBlock('Chaeldar', slayer(1, { regions: ['Zanaris'] }), 'vanilla')).toBe('Needs the Lost City quest');
  });

  it('asks for Shilo Village and Slayer tier 5 at Duradel (and Kuradal)', () => {
    expect(slayerCardBlock('Duradel', slayer(5), 'vanilla')).toBe('Needs the Shilo Village area');
    const shilo = { regions: ['Shilo Village'] };
    expect(slayerCardBlock('Duradel', slayer(5, shilo), 'vanilla')).toBe('Needs the Shilo Village quest');
    const quest = { ...shilo, quests: ['Shilo Village'] };
    expect(slayerCardBlock('Duradel', slayer(4, quest), 'vanilla')).toBe('Needs Slayer tier 5 (level 50)');
    expect(slayerCardBlock('Kuradal', slayer(4, quest), 'vanilla')).toBe('Needs Slayer tier 5 (level 50)');
    expect(slayerCardBlock('Duradel', slayer(5, quest), 'vanilla')).toBeNull();
  });

  it('asks for the master’s own chunk in Chunked, then the rest', () => {
    expect(slayerMasterBlock('Turael', slayer(1, { chunks: [] }), 'chunked')).toMatch(/^Needs .*\(45, 55\)$/);
    expect(slayerMasterBlock('Turael', slayer(1, { chunks: ['45,55'] }), 'chunked')).toBeNull();
    expect(slayerMasterBlock('Turael', run({ chunks: ['45,55'] }), 'chunked')).toBe(SLAYER_LOCKED);
  });

  it('leaves the retired modes’ cards open', () => {
    expect(slayerCardBlock('Duradel', run(), 'casual')).toBeNull();
    expect(slayerCardBlock('Duradel', run(), undefined)).toBeNull();
    expect(slayerSourceBlock(DropSource.SLAYER_BOSS, run(), 'casual')).toBeNull();
  });

  it('opens a Roll Inbox source when any of its masters is open, and sends boss tasks to the card', () => {
    // Turael needs Burthorpe, Spria A Porcine of Interest: neither yet.
    expect(slayerSourceBlock(DropSource.SLAYER_BEGINNER, slayer(1), 'vanilla')).toBe('Needs the Burthorpe area');
    expect(slayerSourceBlock(DropSource.SLAYER_BEGINNER, slayer(1, { quests: ['A Porcine of Interest'] }), 'vanilla')).toBeNull();
    expect(slayerSourceBlock(DropSource.SLAYER_DURADEL, run(), 'vanilla')).toBe(SLAYER_LOCKED);
    expect(slayerSourceBlock(DropSource.SLAYER_BOSS, slayer(10), 'vanilla')).toBe(BOSS_TASK_ROLL_ON_CARD);
    expect(slayerSourceBlock(DropSource.SLAYER_BOSS, slayer(10), 'chunked')).toBe(BOSS_TASK_ROLL_ON_CARD);
  });
});

describe('Boss Task card', () => {
  const likeABoss = (tier: number, unlocks: Partial<UnlockState> = {}) => slayer(tier, { slayerUnlocks: ['Like a Boss'], ...unlocks });

  it('needs Slayer, then Like a Boss', () => {
    expect(bossTaskChoices(run({ bosses: ['Callisto'] }), 'vanilla', {})).toEqual({ bosses: [], block: SLAYER_LOCKED });
    expect(bossTaskChoices(slayer(10, { bosses: ['Callisto'] }), 'vanilla', {})).toEqual({ bosses: [], block: BOSS_TASK_NEEDS_UNLOCK });
  });

  it('needs a master who gives boss tasks (Chunked, no master’s chunk)', () => {
    expect(bossTaskChoices(likeABoss(10, { chunks: [], bosses: ['Callisto'] }), 'chunked', {}).block).toBe(BOSS_TASK_NEEDS_MASTER);
    expect(bossTaskChoices(likeABoss(10, { chunks: ['48,54'], bosses: ['Callisto'] }), 'chunked', {}))
      .toEqual({ bosses: ['Callisto'], block: null });
  });

  it('offers only unlocked bosses an open master assigns', () => {
    // Vanilla, no areas: only Krystilia (Edgeville) is open, and she gives only Wilderness bosses.
    expect(bossTaskChoices(likeABoss(10), 'vanilla', {}).block).toBe(BOSS_TASK_NEEDS_BOSS);
    expect(bossTaskChoices(likeABoss(10, { bosses: ['Vorkath', 'Wintertodt'] }), 'vanilla', {}).block).toBe(BOSS_TASK_NEEDS_BOSS);
    expect(bossTaskChoices(likeABoss(10, { bosses: ['Vorkath', 'Callisto', 'Artio', 'Wintertodt'] }), 'vanilla', {}))
      .toEqual({ bosses: ['Artio', 'Callisto'], block: null });
    // With Konar's Mount Karuulm, any task boss she assigns, the Hydra too; never Wintertodt.
    expect(bossTaskChoices(likeABoss(10, { regions: ['Mount Karuulm'], bosses: ['Wintertodt', 'Vorkath', 'Alchemical Hydra'] }), 'vanilla', {}))
      .toEqual({ bosses: ['Alchemical Hydra', 'Vorkath'], block: null });
  });

  it('leaves out a boss whose Slayer level is past Slayer’s tier', () => {
    const cerberus = { regions: ['Mount Karuulm'], bosses: ['Cerberus'] };
    expect(bossTaskChoices(likeABoss(9, cerberus), 'vanilla', {}).block).toBe(BOSS_TASK_NEEDS_TIER);
    expect(bossTaskChoices(likeABoss(10, cerberus), 'vanilla', {}).bosses).toEqual(['Cerberus']);
  });

  it('leaves out a boss whose stash is spent, as its kills stop rolling', () => {
    const unlocks = likeABoss(10, { bosses: ['Callisto', 'Scorpia'] });
    const spent = { Callisto: vanillaBossKeyStage('Callisto', 0).cap };
    expect(bossTaskChoices(unlocks, 'vanilla', spent).bosses).toEqual(['Scorpia']);
    expect(bossTaskChoices(unlocks, 'vanilla', { ...spent, Scorpia: vanillaBossKeyStage('Scorpia', 0).cap }).block).toBe(BOSS_TASK_ALL_SPENT);
  });

  it('treats an old save with no Slayer rewards list as no Like a Boss', () => {
    const old = { ...slayer(10, { bosses: ['Callisto'] }) } as Partial<UnlockState>;
    delete old.slayerUnlocks;
    expect(bossTaskChoices(old as UnlockState, 'vanilla', undefined).block).toBe(BOSS_TASK_NEEDS_UNLOCK);
  });
});
