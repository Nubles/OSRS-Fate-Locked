import { describe, expect, it } from 'vitest';
import { initialState, prepareKeyRollAction, prepareLevelUpActions } from '../context/GameContext';
import { DROP_RATES } from '../config/rules';
import { FATE_MARK_CURSED_ODDS } from '../config/economy';
import { BOSSES_LIST } from '../data/items';
import { bossTier } from '../data/bossKeyTiers';
import { MINIGAME_KEY_RESERVES } from '../data/minigameKeyReserves';
import type { KeyRollContext } from '../config/vanillaKeyEconomy';
import { DropSource, type GameState } from '../types';
import { keyChance, keyChanceBonus, levelUpKeyChance } from './keyChance';

/**
 * The Key chance every screen shows is the chance the roll is made against.
 * The roll's own threshold (prepareKeyRollAction's payload) is the reference:
 * each sample state rolls, and the displayed chance must equal what it rolled at.
 */

type Run = GameState & { lastEvent: null };
const dice = () => 500;

const run = (patch: Partial<GameState> = {}): Run => ({
  ...initialState,
  runId: 'odds-run',
  runRevision: 0,
  lastEvent: null,
  ...patch,
  unlocks: { ...initialState.unlocks, ...patch.unlocks },
});

/** Attack at `level` with `tier` skill tiers unlocked. */
const attackAt = (level: number, tier: number, patch: Partial<GameState> = {}): Run => run({
  ...patch,
  unlocks: {
    ...initialState.unlocks,
    ...patch.unlocks,
    skills: { ...initialState.unlocks.skills, Attack: tier },
    levels: { ...initialState.unlocks.levels, Attack: level },
  },
});

// Nine level-up achievements adding 3.3% between them (utils/achievementBoosts.ts).
const LEVEL_BOOSTS = [
  'skills-start-1', 'skills-start-5', 'skills-start-12', 'total-level-500', 'skill-tiers-50',
  'skills-start-24', 'total-level-1000', 'total-level-1500', 'skill-tiers-100',
];

/** The chance the level-up rolled against, or null when it rolled nothing. */
const rolledLevelChance = (state: Run, skill = 'Attack'): number | null =>
  prepareLevelUpActions(state, skill, 0, dice).rewardAction?.payload.threshold ?? null;

/** The chance a Key roll from this source rolled against, or null when it did not roll. */
const rolledChance = (state: Run, source: string, rate: number, context?: KeyRollContext): number | null =>
  (context
    ? prepareKeyRollAction(state, source, rate, 1, dice, undefined, undefined, undefined, context)
    : prepareKeyRollAction(state, source, rate, 1, dice))?.payload.threshold ?? null;

const midBoss = BOSSES_LIST.find((name) => bossTier(name) === 'mid')!;
const minigame = Object.keys(MINIGAME_KEY_RESERVES)[0];

describe('the Key chance a screen shows is the chance the roll uses', () => {
  const levelStates: Array<[string, Run]> = [
    ['Vanilla, no boosts', attackAt(61, 7)],
    ['Vanilla with 3.3% of level-up achievements', attackAt(61, 7, { achievementsClaimed: LEVEL_BOOSTS })],
    ['Vanilla with achievements and Zamorak\'s Pact', attackAt(61, 7, { achievementsClaimed: LEVEL_BOOSTS, rituals: { pactRollsLeft: 3, pactDebt: 0 } })],
    ['Vanilla under Luck (advantage, same odds)', attackAt(61, 7, { achievementsClaimed: LEVEL_BOOSTS, activeBuff: 'LUCK' })],
    ['Vanilla under Greed', attackAt(61, 7, { activeBuff: 'GREED' })],
    ['Vanilla with Dharok', attackAt(61, 7, { fatePoints: 30, rituals: { barrows: { brother: 'DHAROK', rollsLeft: 2, failed: 0, fateCost: 0 } } })],
    ['Chunked under the tier cap, with achievements', attackAt(61, 7, { gameModeId: 'chunked', achievementsClaimed: LEVEL_BOOSTS })],
    ['Chunked, cursed chunk', attackAt(61, 7, { gameModeId: 'chunked', rituals: { cursedRollsLeft: 2 } })],
    ['Region Rush (region passives)', attackAt(61, 7, { gameModeId: 'region-rush', achievementsClaimed: LEVEL_BOOSTS })],
  ];

  it.each(levelStates)('level-up: %s', (_name, state) => {
    const rolled = rolledLevelChance(state);
    expect(rolled).not.toBeNull();
    expect(levelUpKeyChance(state, 'Attack')).toBe(rolled);
  });

  it('includes the achievement boost the classic card showed and the OSRS guide left out (Attack 61)', () => {
    expect(levelUpKeyChance(attackAt(61, 7), 'Attack')).toBe(12.4);
    expect(levelUpKeyChance(attackAt(61, 7, { achievementsClaimed: LEVEL_BOOSTS }), 'Attack')).toBe(15.7);
  });

  it('shows no chance where the level-up rolls nothing: past a Chunked tier cap, or at 99', () => {
    const capped = attackAt(70, 7, { gameModeId: 'chunked', achievementsClaimed: LEVEL_BOOSTS });
    expect(rolledLevelChance(capped)).toBeNull();
    expect(levelUpKeyChance(capped, 'Attack')).toBeNull();
    // The same level in Vanilla rolls.
    expect(levelUpKeyChance(attackAt(70, 7), 'Attack')).toBe(rolledLevelChance(attackAt(70, 7)));
    expect(levelUpKeyChance(attackAt(99, 10), 'Attack')).toBeNull();
  });

  const activityStates: Array<[string, Run]> = [
    ['Vanilla', run()],
    ['Vanilla with every activity boosted', run({
      achievementsClaimed: ['slayer-tasks-1', 'slayer-tasks-100', 'clues-1', 'clues-25', 'bosses-1', 'bosses-25', 'quests-1', 'quests-50',
        'diaries-1', 'diaries-12', 'ca-1', 'ca-3', 'collection-1', 'collection-250', 'minigames-1', 'minigames-15'],
    })],
    ['Vanilla with boosts and the Pact', run({ achievementsClaimed: ['slayer-tasks-100', 'bosses-25', 'clues-25'], rituals: { pactRollsLeft: 1, pactDebt: 0 } })],
    ['Chunked with boosts', run({ gameModeId: 'chunked', achievementsClaimed: ['bosses-25', 'minigames-15', 'collection-250'] })],
    ['Chunked, cursed', run({ gameModeId: 'chunked', rituals: { cursedRollsLeft: 1 } })],
    ['Region Rush with boosts', run({ gameModeId: 'region-rush', achievementsClaimed: ['minigames-15', 'quests-50'] })],
    ['Vanilla, second clue Key and a boss part paid', run({
      achievementsClaimed: ['clues-25', 'bosses-25'], clueStandardKeysAwarded: 1, bossStandardKeysAwarded: { [midBoss]: 1 },
    })],
  ];

  const sources: Array<[string, number, KeyRollContext | undefined]> = [
    [DropSource.SLAYER_DURADEL, DROP_RATES[DropSource.SLAYER_DURADEL], undefined],
    [DropSource.QUEST_MASTER, DROP_RATES[DropSource.QUEST_MASTER], undefined],
    [DropSource.DIARY_HARD, DROP_RATES[DropSource.DIARY_HARD], undefined],
    [DropSource.CA_HARD, DROP_RATES[DropSource.CA_HARD], undefined],
    ['Col. Log: Abyssal whip', DROP_RATES[DropSource.COLLECTION_LOG], undefined],
    [DropSource.ACTIVITY_MINIGAME, DROP_RATES[DropSource.ACTIVITY_MINIGAME], undefined],
    [DropSource.CHUNK_EXPLORE, DROP_RATES[DropSource.CHUNK_EXPLORE], undefined],
    [DropSource.CLUE_HARD, DROP_RATES[DropSource.CLUE_HARD], { kind: 'clue', clueTier: 'Hard' }],
    [DropSource.BOSS_MID, 0, { kind: 'boss', bossName: midBoss, bossClass: 'mid' }],
    [DropSource.ACTIVITY_MINIGAME, 0, { kind: 'minigame', minigameName: minigame }],
  ];

  it.each(activityStates)('activity cards and Journal: %s', (_name, state) => {
    for (const [source, rate, context] of sources) {
      // A boss or minigame reserve rolls at its own stage's rate, whatever rate is passed.
      expect(keyChance(state, source, rate, context), `${source} ${JSON.stringify(context)}`)
        .toBe(rolledChance(state, source, rate, context));
    }
  });

  it('shows no chance for a boss whose Key reserve has run out', () => {
    const spent = run({ bossStandardKeysAwarded: { [midBoss]: 2 } });
    const context: KeyRollContext = { kind: 'boss', bossName: midBoss, bossClass: 'mid' };
    expect(rolledChance(spent, DropSource.BOSS_MID, 0, context)).toBeNull();
    expect(keyChance(spent, DropSource.BOSS_MID, 0, context)).toBeNull();
  });

  it('reports what the boosts add, rounded', () => {
    const boosted = run({ achievementsClaimed: ['slayer-tasks-1', 'slayer-tasks-25'] });
    expect(keyChanceBonus(boosted, DropSource.SLAYER_DURADEL, DROP_RATES[DropSource.SLAYER_DURADEL])).toBe(0.5);
    expect(keyChanceBonus(run({ gameModeId: 'chunked', rituals: { cursedRollsLeft: 1 } }), DropSource.COLLECTION_LOG, DROP_RATES[DropSource.COLLECTION_LOG]))
      .toBe(-FATE_MARK_CURSED_ODDS);
  });
});

describe('no screen works out a Key chance on its own', () => {
  // Every display reads utils/keyChance.ts. A screen that adds boosts by hand
  // is how the OSRS skill guide fell behind the classic skill card.
  const sources = import.meta.glob<string>(['../components/**/*.{ts,tsx}', '!../components/**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true });

  it('keeps level odds, achievement boosts and region passives out of components', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100);
    const offenders = Object.entries(sources)
      .filter(([, text]) => /\b(skillLevelKeyChance|achievementBoostFor|getActiveRegionBonuses|rollRitualPlan)\b/
        .test(text.replace(/^\s*import .*$/gm, '')))
      .map(([path]) => path.split('/').pop());
    // SkillRollOdds names a level's base chance beside its boosted one.
    expect(offenders).toEqual(['SkillRollOdds.tsx']);
  });
});
