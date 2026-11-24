import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { BANKS } from '../data/banks';
import { QUEST_DATA } from '../data/questData';
import { ChunkContentService } from '../services/ChunkContentService';
import type { UnlockState } from '../types';
import { bankDecisions } from './bankDecisions';
import { runReach } from './chunkEntry';
import type { ChunkPermissionContext } from './chunkPermissionSnapshot';
import { buildRuneliteRulesManifest } from './runeliteRulesManifest';

const service = new ChunkContentService();

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

const run = (changes: Partial<UnlockState>): UnlockState => ({ ...structuredClone(initialState.unlocks), ...changes });
const context = (unlocks: UnlockState): ChunkPermissionContext => ({
  unlocks, gameModeId: 'vanilla', contentService: service, reachableChunks: runReach(service, unlocks, 'vanilla'),
});
const numericBanks = BANKS.filter((bank) => /^\d+$/.test(bank.id));

describe('bankDecisions', () => {
  it('finds the Keldagrim bank inside Keldagrim and at the Blast Furnace, not at the entrance', () => {
    expect(bankDecisions(service, context(run({})))['11066']).toMatchObject({
      name: 'Keldagrim bank and Blast Furnace chest', at: '43,58', physical: ['30,77', '44,159'],
    });
  });

  it('finds a surface bank in its own chunk, and keeps a bank with no facility found at its chunk', () => {
    const decisions = bankDecisions(service, context(run({})));
    expect(decisions['12597'].physical).toEqual(['49,53']);
    // Lumbridge Castle's id also covers the bank in Dorgesh-Kaan, entered
    // from the castle's cellar, as its BANKS row already does.
    expect(decisions['12850'].physical).toEqual(['42,83', '50,50']);
    // Tarn's Lair's bank (chunk Abandoned Mine) is one the facility data doesn't show.
    expect(decisions['13618'].physical).toEqual(['53,50']);
    // Merged into the banks they lead to, so they are no longer decided at all.
    expect(decisions['10810']).toBeUndefined();
    expect(decisions['12085']).toBeUndefined();
    expect(decisions['11572']).toBeUndefined();
  });

  it('finds the Falador west bank deposit box over its chunk line, under West Falador', () => {
    expect(bankDecisions(service, context(run({})))['11828']).toMatchObject({
      name: 'West Falador', at: '46,52', physical: ['45,52', '46,52'],
    });
  });

  it('names the Temple of the Eye once for the Guardians of the Rift bank on a fresh run', () => {
    // The chest and pool sit in the temple, which the quest opens; the gate's "Complete Temple of
    // the Eye" repeated the quest the facilities already name.
    expect(bankDecisions(service, context(run({})))['12337']).toMatchObject({ status: 'LOCKED', reason: 'Temple of the Eye' });
  });

  it('names no quest twice in any bank reason', () => {
    const named = (reason: string, quest: string) => reason.split('; ')
      .filter(part => part === quest || part === `Complete ${quest}`).length;
    for (const unlocks of [run({}), run({ quests: ['Priest in Peril', 'The Fremennik Trials', 'Children of the Sun'] })]) {
      for (const [id, decision] of Object.entries(bankDecisions(service, context(unlocks)))) {
        for (const quest of Object.keys(QUEST_DATA)) expect(named(decision.reason ?? '', quest), `${id} ${quest}`).toBeLessThan(2);
      }
    }
  });

  it('opens a bank only once it is rolled, in a bank-locked run', () => {
    expect(bankDecisions(service, context(run({})))['12850'].status).toBe('LOCKED');
    expect(bankDecisions(service, context(run({ banks: ['12850'] })))['12850'].status).toBe('ALLOWED');
  });

  it('decides every bank as the BANKS row of its chunk does', async () => {
    const unlocks = run({
      regions: ['Falador', 'Port Sarim', 'Catherby', 'Baxtorian Falls', 'Keldagrim', 'Zanaris'],
      banks: ['13105', '10547', '12850'],
    });
    const manifest = await buildRuneliteRulesManifest({
      unlocks, run: { runId: 'bank-parity', runRevision: 1, gameModeId: 'vanilla' }, contentService: service,
      itemRuleSource: { init: async () => {}, ready: false, itemRuleExport: () => ({}) },
    });
    const decisions = bankDecisions(service, context(unlocks));
    expect(Object.keys(decisions)).toHaveLength(numericBanks.length);
    expect(numericBanks).toHaveLength(124);
    for (const bank of numericBanks) {
      const decision = decisions[bank.id];
      const row = manifest.chunks[decision.at]?.categories.BANKS?.find((one) => one.key === `bank:${bank.id}`);
      expect(row, bank.name).toBeDefined();
      expect({ status: decision.status, reason: decision.reason }, bank.name)
        .toEqual({ status: row!.status, reason: row!.detail });
    }
    const statuses = new Set(Object.values(decisions).map((decision) => decision.status));
    expect(statuses.has('ALLOWED') && statuses.has('LOCKED')).toBe(true);
  });
  it('marks the places where the bank can only be deposited into, and no other', () => {
    // Settled against the Wiki in November 2026: 'Bank Deposit Box' (revision 15378951) lists these
    // deposit boxes, the Zul-Andra chest (Chest (Zul-Andra), 14703191: options Deposit), Peer the Seer
    // (15403084: Deposit-items) and Rionasta (15310502: Send-parcel). Port Sarim has no bank.
    const decisions = bankDecisions(service, context(run({})));
    const depositOnly = Object.entries(decisions).filter(([, decision]) => decision.depositOnly).map(([id]) => id);
    expect(depositOnly.sort()).toEqual([
      '10553', '11056', '12082', '12838', '5678', '6711', '6961', '7225', '8499', '8508', '8751', '8757', '9274',
    ]);
    for (const decision of Object.values(decisions)) expect([undefined, true]).toContain(decision.depositOnly);
    // Full banks whose names or chunks also hold a deposit facility: the Ent cavern's bank chest is
    // entered from the Woodcutting Guild's east deposit box, the Bank boat has a banker.
    for (const id of ['6454', '8999', '12338']) expect(decisions[id].depositOnly, id).toBeUndefined();
    for (const name of ['Arceuus bank and deposit box', 'Guardians of the Rift bank and deposit pool',
      'Prifddinas north bank and Gauntlet deposit box']) {
      const found = Object.values(decisions).filter((decision) => decision.name === name);
      expect(found.length, name).toBe(1);
      expect(found[0].depositOnly, name).toBeUndefined();
    }
  });
});
