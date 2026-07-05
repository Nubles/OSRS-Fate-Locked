import { describe, it, expect } from 'vitest';
import { isBankReachable, bankLocksActive } from './reachability';
import { isValidUnlock, getPoolAndStateKey } from './gameEngine';
import { BANKS, BANK_IDS, bankId, BANK_BY_ID } from '../data/banks';
import { TableType, UnlockState } from '../types';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [],
  arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [],
  guilds: [], farming: [], slayerUnlocks: [], banks: [], quests: [], diaries: [],
  cas: [], completedTasks: [], collectionLog: {}, ...over,
});

describe('bank data', () => {
  it('has 100 uniquely-named, uniquely-keyed banks', () => {
    expect(BANKS.length).toBe(100);
    expect(new Set(BANK_IDS).size).toBe(100);
    expect(new Set(BANKS.map(b => b.name)).size).toBe(100);
  });

  it('bankId encodes cx*256+cy and round-trips against a known entry', () => {
    expect(bankId(19, 48)).toBe(String(19 * 256 + 48));
    // Every id resolves to a def.
    for (const id of BANK_IDS) expect(BANK_BY_ID[id]).toBeTruthy();
  });
});

describe('bankLocksActive', () => {
  it('is off for built-in modes and on only when the rule is set', () => {
    expect(bankLocksActive('vanilla')).toBe(false);
    expect(bankLocksActive('chunked')).toBe(false);
    expect(bankLocksActive('custom', { pityEnabled: true, pityThreshold: 50, omniChanceBase: 2, ritualCostMultiplier: 1, regionModifiers: false, bankLocks: true })).toBe(true);
  });
});

describe('isBankReachable', () => {
  const cx = 19, cy = 48, id = bankId(cx, cy);

  it('is always reachable when the mode does not lock banks (no save impact)', () => {
    expect(isBankReachable(cx, cy, unlocks(), 'vanilla')).toBe(true);
    expect(isBankReachable(cx, cy, unlocks({ banks: [] }), 'chunked')).toBe(true);
  });

  it('gates on the unlocked set when banks are locked', () => {
    const custom = { pityEnabled: true, pityThreshold: 50, omniChanceBase: 2, ritualCostMultiplier: 1, regionModifiers: false, bankLocks: true };
    expect(isBankReachable(cx, cy, unlocks({ banks: [] }), 'custom', custom)).toBe(false);
    expect(isBankReachable(cx, cy, unlocks({ banks: [id] }), 'custom', custom)).toBe(true);
  });
});

describe('BANKS unlock table', () => {
  it('pool + stateKey resolve to the bank ids and banks array', () => {
    const { pool, stateKey } = getPoolAndStateKey(TableType.BANKS);
    expect(pool).toBe(BANK_IDS);
    expect(stateKey).toBe('banks');
  });

  it('a bank is a valid unlock until it is owned', () => {
    const id = BANK_IDS[0];
    expect(isValidUnlock(TableType.BANKS, id, unlocks())).toBe(true);
    expect(isValidUnlock(TableType.BANKS, id, unlocks({ banks: [id] }))).toBe(false);
  });
});
