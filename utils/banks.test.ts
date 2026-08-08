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
  it('has 126 uniquely-named, uniquely-keyed banks', () => {
    expect(BANKS.length).toBe(126);
    expect(new Set(BANK_IDS).size).toBe(126);
    expect(new Set(BANKS.map(b => b.name)).size).toBe(126);
  });

  it('contains every reviewed fixed-location addition with facility-first labels', () => {
    const additions = [
      '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
      '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
      '11056', '11062', '11572', '11578', '12082', '12337', '12838',
      '12849', '14132',
    ];
    expect(BANK_IDS).toEqual(expect.arrayContaining(additions));
    expect(BANK_BY_ID['10275'].name).toBe('Wyrmscraig bank chest');
    expect(BANK_BY_ID['11830'].name).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(BANK_BY_ID['14132'].name).toBe('Sangvesti and Castle Drakan banking');
    expect(BANKS.some(bank => /Woodcutting Leprechaun/i.test(bank.name))).toBe(false);
  });

  it('bankId encodes cx*256+cy and round-trips against a known entry', () => {
    expect(bankId(19, 48)).toBe(String(19 * 256 + 48));
    // Every id resolves to a def.
    for (const id of BANK_IDS) expect(BANK_BY_ID[id]).toBeTruthy();
  });
});

describe('bankLocksActive', () => {
  it('is on in every built-in mode and follows the Custom rule when set', () => {
    expect(bankLocksActive('vanilla')).toBe(true);
    expect(bankLocksActive('chunked')).toBe(true);
    expect(bankLocksActive('hardcore')).toBe(true);
    // Custom carries its own rules — off when the toggle is off.
    const off = { pityEnabled: true, pityThreshold: 50, omniChanceBase: 2, ritualCostMultiplier: 1, regionModifiers: false, bankLocks: false };
    expect(bankLocksActive('custom', off)).toBe(false);
  });
});

describe('isBankReachable', () => {
  const cx = 19, cy = 48, id = bankId(cx, cy);

  it('is always reachable only when a Custom run turns bank-locking off', () => {
    const off = { pityEnabled: true, pityThreshold: 50, omniChanceBase: 2, ritualCostMultiplier: 1, regionModifiers: false, bankLocks: false };
    expect(isBankReachable(cx, cy, unlocks({ banks: [] }), 'custom', off)).toBe(true);
  });

  it('every built-in mode locks banks: unreachable until the specific bank is rolled', () => {
    for (const mode of ['vanilla', 'casual', 'hardcore', 'xtreme', 'region-rush', 'chunked']) {
      expect(isBankReachable(cx, cy, unlocks({ banks: [] }), mode)).toBe(false);
      expect(isBankReachable(cx, cy, unlocks({ banks: [id] }), mode)).toBe(true);
    }
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
