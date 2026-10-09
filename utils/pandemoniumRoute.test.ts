import content from '../public/chunk-content.json';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';

// Every place Pandemonium takes you, in order (Wiki quick guide, 9 October 2026).
const STEPS: [string, number, number][] = [
  ['Port Sarim south docks', 47, 49],
  ['Port Sarim ledger table', 47, 50],
  ['Bay of Sarim and Mudskipper Sound', 47, 48],
  ['Salty Grouper wreck', 47, 47],
  ['The Pandemonium', 47, 46],
  ['water off the Pandemonium docks', 48, 46],
  ['water north-east of the Pandemonium', 48, 47],
  ['the Shipyard, by Junior Jim\'s raft', 32, 42],
];

type Modules = {
  service: typeof import('../services/ChunkContentService').chunkContentService;
  entry: typeof import('./chunkEntry');
  eligibility: typeof import('./journalStatus').evaluateQuestEligibility;
  quest: (typeof import('../data/questData').QUEST_DATA)[string];
  fresh: () => UnlockState;
};
let m: Modules;

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  const { chunkContentService } = await import('../services/ChunkContentService');
  await chunkContentService.init();
  const { initialState } = await import('../context/GameContext');
  m = {
    service: chunkContentService,
    entry: await import('./chunkEntry'),
    eligibility: (await import('./journalStatus')).evaluateQuestEligibility,
    quest: (await import('../data/questData')).QUEST_DATA.Pandemonium,
    fresh: () => structuredClone(initialState.unlocks),
  };
});

const entries = (unlocks: UnlockState, mode: string) => {
  const reach = m.entry.runReach(m.service, unlocks, mode);
  return Object.fromEntries(STEPS.map(([name, cx, cy]) => [name, m.entry.chunkEntry({ cx, cy }, unlocks, mode, reach)]));
};
const allowed = Object.fromEntries(STEPS.map(([name]) => [name, 'ALLOWED']));

// A player reported on 9 October 2026 that RuneLite locked the quest's own sea and Shipyard.
describe('Pandemonium can be completed', () => {
  it('in Vanilla with Port Sarim, as the quest list says, Sailing or not', () => {
    const run = { ...m.fresh(), regions: [...m.fresh().regions, 'Port Sarim'] };
    expect(m.eligibility(m.quest, run, 'vanilla').eligible).toBe(true);
    expect(entries(run, 'vanilla')).toEqual(allowed);
    const noSailing = { ...run, skills: { ...run.skills, Sailing: 0 } };
    expect(entries(noSailing, 'vanilla')).toEqual(allowed);
  });

  it('in Chunked once the run walks from Lumbridge to Port Sarim', () => {
    const run = { ...m.fresh(), regions: [], chunks: ['49,50', '48,50', '47,50', '47,49'] };
    expect(m.eligibility(m.quest, run, 'chunked').eligible).toBe(true);
    expect(entries(run, 'chunked')).toEqual(allowed);
  });

  it('not without Port Sarim, in the quest list or in RuneLite', () => {
    expect(m.eligibility(m.quest, m.fresh(), 'vanilla').eligible).toBe(false);
    expect(Object.values(entries(m.fresh(), 'vanilla')).every((entry) => entry === 'LOCKED')).toBe(true);
  });

  it('and afterwards Sailing keeps the sea and the Shipyard open, but not the island', () => {
    const runs: [string, UnlockState][] = [
      ['vanilla', { ...m.fresh(), regions: [...m.fresh().regions, 'Port Sarim'] }],
      ['chunked', { ...m.fresh(), regions: [], chunks: ['49,50', '48,50', '47,50', '47,49'] }],
    ];
    for (const [mode, base] of runs) {
      const done = { ...base, quests: ['Pandemonium'], skills: { ...base.skills, Sailing: 1 } };
      const after = entries(done, mode);
      expect([after['Salty Grouper wreck'], after["the Shipyard, by Junior Jim's raft"], after['The Pandemonium']], mode)
        .toEqual(['ALLOWED', 'ALLOWED', 'LOCKED']);
    }
  });
});
