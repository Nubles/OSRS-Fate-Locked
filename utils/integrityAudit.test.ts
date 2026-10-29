import { describe, expect, it } from 'vitest';
import {
  createFreshState, gameReducer, prepareKeyRollAction, prepareLevelUpActions,
} from '../context/GameContext';
import { ensureChain, hashEntry } from './integrity';
import { auditHistory, countUnlocks, type SavedTotals } from './runAudit';
import { resolveModeRules, type GameModeRules } from '../config/gameModes';
import { BARROWS_BROTHERS, INVOCATIONS } from '../config/economy';
import { SKILLS_LIST } from '../data/items';
import { PETS } from '../data/pets';
import { randomUnlockPool } from './gameEngine';
import { pickSacrifice } from './ritualEffects';
import { achievementPayouts } from './achievements';
import { pickFreeRitual } from './achievementRewards';
import { TableType, type GameState, type LogEntry } from '../types';
import type { KeyRollContext } from '../config/vanillaKeyEconomy';

/**
 * The run check (auditHistory) compares a history with the save it came with:
 * Keys, Omni-Keys, Chaos Keys, Fate and unlocks. These pin the forgeries from
 * the October 2026 critique (tamper.sim) and, as importantly, that honest
 * play through the real reducer never reads as a mismatch.
 */

type Run = GameState & { lastEvent: unknown };
const RUN_ID = '0b7e9d2c-3f4a-4e1b-8c6d-5a9f0e1d2c3b';
const fresh = (gameModeId = 'vanilla', customMode?: GameModeRules): Run =>
  ({ ...createFreshState(), runId: RUN_ID, gameModeId, gameModeLocked: true, ...(customMode ? { customMode } : {}), lastEvent: null } as Run);
const step = (s: Run, action: Parameters<typeof gameReducer>[1] | null): Run =>
  action ? gameReducer(s as Parameters<typeof gameReducer>[0], action) as Run : s;
const rulesOf = (s: Run) => resolveModeRules(s.gameModeId, s.customMode);
const audit = (s: Run, saved: SavedTotals = s) => auditHistory(s.history, rulesOf(s), saved);

/** Ten misses at 25% (rolled 100.0), as the critique's sim played them. */
const tenMisses = (): Run => {
  let s = fresh();
  const worst = (_p: string, _i = 0, max = 100) => max;
  for (let i = 0; i < 10; i++) s = step(s, prepareKeyRollAction(s, 'Quest (Novice)', 25, 1, worst));
  return s;
};

describe('run check: saved totals must match the history', () => {
  it('passes the honest run and says its totals were compared', () => {
    const s = tenMisses();
    const result = audit(s);
    expect(result.verdict).toBe('intact');
    expect(result.totals).toEqual({ status: 'match', reasons: [] });
  });

  it('warns when Keys, Omni-Keys and skill tiers were edited into the save (critique sim, case 1)', () => {
    const s = tenMisses();
    const edited = {
      ...s, keys: 999, specialKeys: 99,
      unlocks: { ...s.unlocks, skills: Object.fromEntries(SKILLS_LIST.map(k => [k, 10])) },
    };
    const result = audit(s, edited);
    expect(result.verdict).toBe('warning');
    expect(result.totals.status).toBe('mismatch');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'Saved Keys: 999, but the history adds up to 3.',
      'Saved Omni-Keys: 99, but the history adds up to 0.',
      `Saved unlocks: ${countUnlocks(edited.unlocks)}, but the history pays for 1.`,
    ]));
  });

  it.each([
    ['Chaos Keys', { chaosKeys: 1 }, 'Saved Chaos Keys: 1, but the history adds up to 0.'],
    ['Fate', { fatePoints: 49 }, 'Saved Fate: 49, but the history adds up to 10.'],
    ['fewer Keys', { keys: 2 }, 'Saved Keys: 2, but the history adds up to 3.'],
  ])('warns on edited %s', (_label, change, reason) => {
    const s = tenMisses();
    const result = audit(s, { ...s, ...change });
    expect(result.verdict).toBe('warning');
    expect(result.reasons).toContain(reason);
  });

  it('flags misses rewritten as successes and re-hashed (critique sim, case 2)', () => {
    const s = tenMisses();
    let prev = 'GENESIS';
    const forged = s.history.map((e): LogEntry => {
      const { hash: _h, prevHash: _p, ...body } = { ...e, type: 'ROLL_SUCCESS' as const, result: 'SUCCESS' as const, message: 'Key Found!' };
      const hash = hashEntry(body as LogEntry, prev);
      const out = { ...body, prevHash: prev, hash } as LogEntry;
      prev = hash;
      return out;
    });
    const result = auditHistory(forged, rulesOf(s), { ...s, keys: 13 });
    expect(result.chain.ok).toBe(true);
    expect(result.verdict).toBe('warning');
    expect(result.violations.filter(v => v.kind === 'ROLL_CONTRADICTS_RESULT')).toHaveLength(10);
    expect(result.reasons[0]).toBe('Entry 1: a success rolled 100, over its 25% chance.');
  });

  it('flags a miss whose roll was within its chance', () => {
    const history = ensureChain([{ id: 'm', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.', rollValue: 12.5, threshold: 25, meta: { fatePointsEarned: 1, standardKeysAwarded: 0 } }]);
    const result = auditHistory(history, undefined, { keys: 3, specialKeys: 0, chaosKeys: 0, fatePoints: 1 });
    expect(result.verdict).toBe('warning');
    expect(result.reasons).toEqual(['Entry 1: a miss rolled 12.5, within its 25% chance.']);
  });

  it('accepts a roll exactly on its chance as a success, and Verac hitting through a miss', () => {
    const history = ensureChain([
      { id: 'a', timestamp: 1, type: 'ROLL_SUCCESS', message: 'Key Found!', rollValue: 25, threshold: 25, meta: { standardKeysAwarded: 1 } },
      { id: 'b', timestamp: 2, type: 'ROLL_SUCCESS', message: 'Key Found!', details: 'Rolled 80.0 (> 25.0%). Verac hit through the miss.', rollValue: 80, threshold: 25, meta: { standardKeysAwarded: 1 } },
    ]);
    const result = auditHistory(history, undefined, { keys: 5, specialKeys: 0, chaosKeys: 0, fatePoints: 0 });
    expect(result.verdict).toBe('intact');
    expect(result.totals.status).toBe('match');
  });

  it('counts a roll\'s recorded Standard Keys over its message', () => {
    // A Vanilla boss whose reserve had one Key left: Greed asked for 2, the roll paid 1.
    const history = ensureChain([{ id: 'g', timestamp: 1, type: 'ROLL_SUCCESS', message: 'Key Found! (Greed awarded 1 Standard Key)', details: 'Rolled 1.0', rollValue: 1, threshold: 5, meta: { standardKeysAwarded: 1 } }]);
    expect(auditHistory(history, undefined, { keys: 4, specialKeys: 0, chaosKeys: 0, fatePoints: 0 }).totals.status).toBe('match');
  });
});

describe('run check: hash links are checked as stored', () => {
  it('reads a history whose hash fields were all deleted as unlinked, never intact', () => {
    const s = tenMisses();
    const stripped = s.history.map(({ hash: _h, prevHash: _p, ...e }) => e as LogEntry);
    const result = audit({ ...s, history: stripped });
    expect(result.verdict).toBe('warning');
    expect(result.reasons).toContain("This history has no hash links, so edits to it can't be seen.");
  });

  it('reads one entry without its hash link as an edit', () => {
    const s = tenMisses();
    const history = s.history.map((e, i) => (i === 4 ? { ...e, hash: undefined, prevHash: undefined } : e));
    const result = audit({ ...s, history });
    expect(result.verdict).toBe('tampered');
    expect(result.unlinked).toEqual([4]);
    expect(result.reasons[0]).toBe('1 entry has no hash link: the history was edited.');
  });
});

describe('run check: what the history cannot show', () => {
  it('does not compare totals for older entries that never recorded their Keys, and says so', () => {
    const history = ensureChain([{ id: 'old', timestamp: 1, type: 'ROLL_SUCCESS', message: 'Key Found!' }]);
    const result = auditHistory(history, undefined, { keys: 50, specialKeys: 0, chaosKeys: 0, fatePoints: 0 });
    expect(result.verdict).toBe('intact');
    expect(result.totals).toEqual({ status: 'unchecked', reasons: ["Older entries don't record every Key, so saved Keys and unlocks weren't compared."] });
  });

  it('accounts for a retired unlock paid back on load (Rat Pits)', () => {
    const history = ensureChain([
      { id: 'w', timestamp: 1, type: 'ROLL_SUCCESS', message: 'Key Found!', rollValue: 1, threshold: 50, meta: { standardKeysAwarded: 1 } },
      { id: 'u', timestamp: 2, type: 'UNLOCK', message: 'Unlocked Rat Pits', meta: { item: 'Rat Pits', category: TableType.MINIGAMES, cost: 1, costType: 'key' } },
    ]);
    const unlocks = createFreshState().unlocks;
    // The load took Rat Pits away and gave its Key back: 3 + 1 - 1 + 1.
    expect(auditHistory(history, undefined, { keys: 4, specialKeys: 0, chaosKeys: 0, fatePoints: 0, unlocks }).totals.status).toBe('match');
    expect(auditHistory(history, undefined, { keys: 5, specialKeys: 0, chaosKeys: 0, fatePoints: 0, unlocks }).totals.status).toBe('mismatch');
  });

  it('allows the Key a merged area paid back, and no more', () => {
    const unlock = (id: string, item: string): LogEntry => ({ id, timestamp: 1, type: 'UNLOCK', message: `Unlocked ${item}`, meta: { item, category: TableType.REGIONS, cost: 1, costType: 'key' } });
    const history = ensureChain([unlock('a', 'Taverley'), unlock('b', "Heroes' Guild"), unlock('c', 'Falador')]);
    const unlocks = { ...createFreshState().unlocks, regions: ['Taverley', 'Falador'] };
    const saved = (keys: number) => auditHistory(history, undefined, { keys, specialKeys: 0, chaosKeys: 0, fatePoints: 0, unlocks }).totals.status;
    expect(saved(0)).toBe('match');
    expect(saved(1)).toBe('match');
    expect(saved(2)).toBe('mismatch');
  });
});

/** A small deterministic RNG so the honest sweep is the same on every run. */
const rngFrom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const CONTEXTS: KeyRollContext[] = [
  { kind: 'boss', bossName: 'Giant Mole', bossClass: 'mid' },
  { kind: 'boss', bossName: 'Chambers of Xeric', bossClass: 'raid' },
  { kind: 'clue', clueTier: 'Easy' },
  { kind: 'minigame', minigameName: 'Barbarian Assault' },
];

/** One honest run of mixed play through the real reducer, checked after every step. */
const playHonestly = (modeId: string, custom: GameModeRules | undefined, seed: number, steps: number) => {
  const rng = rngFrom(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)];
  const dice = (_p: string, _i = 0, max = 100) => Math.floor(rng() * max) + 1;
  let s = fresh(modeId, custom);
  const problems: string[] = [];
  let reveal = 0;
  for (let i = 0; i < steps; i++) {
    const choice = rng();
    if (s.pendingUnlock) s = step(s, { type: 'ACKNOWLEDGE_UNLOCK', payload: s.pendingUnlock.id });
    if (choice < 0.3) {
      s = step(s, prepareKeyRollAction(s, pick(['Quest (Novice)', 'Clue Scroll (Easy)', 'Boss Kill']), Math.floor(rng() * 50) + 5, pick([1, 2, 3] as const), dice));
    } else if (choice < 0.36) {
      s = step(s, prepareKeyRollAction(s, 'Boss Kill', 20, 1, dice, undefined, undefined, undefined, pick(CONTEXTS)));
    } else if (choice < 0.5) {
      const { levelAction, rewardAction } = prepareLevelUpActions(s, pick(SKILLS_LIST), rng(), dice);
      s = step(step(s, levelAction), rewardAction);
    } else if (choice < 0.63 && s.keys >= 1) {
      const tables = [TableType.SKILLS, TableType.EQUIPMENT, TableType.MOBILITY, TableType.ARCANA, TableType.GUILDS, TableType.BOSSES, TableType.MINIGAMES, modeId === 'chunked' ? TableType.CHUNKS : TableType.REGIONS];
      const pool = randomUnlockPool(s.unlocks, s.gameModeId, 'key', pick(tables), s.customMode);
      if (pool.length) s = step(s, { type: 'UNLOCK', payload: { ...pick(pool), costType: 'key', cost: 1, revealId: `r${reveal++}` } });
    } else if (choice < 0.67 && s.chaosKeys >= 1) {
      const pool = randomUnlockPool(s.unlocks, s.gameModeId, 'chaosKey', undefined, s.customMode);
      if (pool.length) s = step(s, { type: 'UNLOCK', payload: { ...pick(pool), costType: 'chaosKey', cost: 1, revealId: `r${reveal++}` } });
    } else if (choice < 0.71 && s.specialKeys >= 1) {
      const pool = randomUnlockPool(s.unlocks, s.gameModeId, 'key', TableType.SKILLS, s.customMode);
      if (pool.length) s = step(s, { type: 'UNLOCK', payload: { ...pick(pool), costType: 'specialKey', cost: 1 } });
    } else if (choice < 0.87) {
      const ritual = pick(['RITUAL_LUCK', 'RITUAL_GREED', 'RITUAL_CHAOS', 'RITUAL_TRANSMUTE', 'RITUAL_WARD', 'RITUAL_TEARS', 'RITUAL_PACT', 'RITUAL_BARROWS', 'RITUAL_INVOCATIONS', 'RITUAL_SACRIFICE', 'RITUAL_GAMBIT'] as const);
      if (ritual === 'RITUAL_BARROWS') s = step(s, { type: ritual, payload: { brother: pick(BARROWS_BROTHERS).id } });
      else if (ritual === 'RITUAL_INVOCATIONS') s = step(s, { type: ritual, payload: { ids: [pick(INVOCATIONS).id] } });
      else if (ritual === 'RITUAL_SACRIFICE') s = step(s, { type: ritual, payload: { taken: pickSacrifice(s.unlocks, () => rng()) } });
      else if (ritual === 'RITUAL_GAMBIT') {
        if (s.fatePoints > 0) s = step(s, { type: ritual, payload: { won: rng() < 0.5, stake: s.fatePoints, keysWon: 2 } });
      } else s = step(s, { type: ritual } as Parameters<typeof gameReducer>[1]);
    } else if (choice < 0.92) {
      const pet = pick(PETS);
      s = step(s, { type: 'CLAIM_PET', payload: { petId: pet.id, petName: pet.name } });
    } else {
      const payload = achievementPayouts(s).map(a => (a.freeRituals > 0 && !s.achievementsClaimed?.includes(a.id)
        ? { ...a, ritualPicks: Array.from({ length: a.freeRituals }, () => pickFreeRitual(s.gameModeId, rng())) }
        : a));
      s = step(s, { type: 'SETTLE_ACHIEVEMENTS', payload });
    }
    const result = audit(s);
    if (result.verdict !== 'intact' || result.totals.status !== 'match') {
      problems.push(`seed ${seed} step ${i} (${s.history.at(-1)?.type} ${s.history.at(-1)?.message}): ${result.verdict} ${result.reasons.join(' | ')}`);
    }
  }
  return { problems, run: s };
};

// AUDIT_SEEDS / AUDIT_STEPS widen the sweep locally (e.g. 40 seeds x 400 steps).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = Number(env.AUDIT_SEEDS ?? 1);
const STEPS = Number(env.AUDIT_STEPS ?? 200);

describe('run check: honest play never reads as a mismatch', () => {
  it.each([
    ['vanilla', undefined],
    ['xtreme', undefined],
    ['chunked', undefined],
    ['custom', { ...resolveModeRules('vanilla'), pityEnabled: false, ritualCostMultiplier: 0.5 }],
  ] as const)('%s: every step of a long mixed run stays intact with matching totals', (modeId, custom) => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const { problems: found, run } = playHonestly(modeId, custom as GameModeRules | undefined, seed * 7919 + modeId.length, STEPS);
      problems.push(...found);
      for (const e of run.history) seen.add(e.type + (typeof e.meta?.ritual === 'string' ? `:${e.meta.ritual}` : ''));
    }
    if (env.AUDIT_SEEDS) console.log(modeId, [...seen].sort().join(' '));
    expect(problems).toEqual([]);
    // The sweep reached the economy it is meant to cover.
    expect([...seen]).toEqual(expect.arrayContaining(['ROLL_FAIL', 'ROLL_SUCCESS', 'UNLOCK', 'PET', 'ACHIEVEMENT', 'ALTAR:GAMBIT']));
  });
});
