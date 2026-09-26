import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { initialState } from '../context/GameContext';
import { BANKS } from '../data/banks';
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
    // Rellekka Peninsula is one of the banks the facility data doesn't show.
    expect(decisions['10810'].physical).toEqual(['42,58']);
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
    expect(numericBanks).toHaveLength(127);
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
});
