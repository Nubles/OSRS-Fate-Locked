import { beforeAll, describe, expect, it, vi } from 'vitest';
import content from '../public/chunk-content.json';
import { ChunkContentService } from '../services/ChunkContentService';
import { initialState } from '../context/GameContext';
import { evaluateBankRequirements } from './entityAccess';

const service = new ChunkContentService();
beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => content })));
  await service.init();
  vi.unstubAllGlobals();
});

describe('registry-only bank requirements', () => {
  it('requires Peer\'s diary service or explicit during-quest confirmation', () => {
    const coord = { cx: 41, cy: 57 };
    const state = structuredClone(initialState.unlocks);
    const bank = service.contentFor(coord.cx, coord.cy)!;
    const fresh = evaluateBankRequirements(bank, coord, state, service);
    expect(fresh.status).toBe('UNKNOWN');
    expect(fresh.reasons.join(' ')).toContain('Fremennik Easy');
    state.quests.push('The Fremennik Trials');
    expect(evaluateBankRequirements(bank, coord, state, service).status).toBe('UNKNOWN');
    state.diaries.push('Fremennik Easy');
    expect(evaluateBankRequirements(bank, coord, state, service).status).toBe('ALLOWED');
  });

  it('requires The Frozen Door and keeps untracked safe-room entry explicit', () => {
    const coord = { cx: 45, cy: 58 };
    const state = structuredClone(initialState.unlocks);
    const bank = service.contentFor(coord.cx, coord.cy)!;
    expect(evaluateBankRequirements(bank, coord, state, service)).toMatchObject({ status: 'NOT_READY', reasons: expect.arrayContaining(['Complete The Frozen Door']) });
    state.quests.push('The Frozen Door');
    expect(evaluateBankRequirements(bank, coord, state, service)).toMatchObject({ status: 'UNKNOWN', reasons: expect.arrayContaining([expect.stringContaining('safe room')]) });
  });

  it('does not infer permission from a missing facility', () => {
    const coord = { cx: 1, cy: 1 };
    const empty = { ...service.contentFor(41, 57)!, objects: [], npcs: [] };
    const source = { taskRequirements: () => [], chunkEntryRequirements: () => [] };
    expect(evaluateBankRequirements(empty, coord, initialState.unlocks, source).status).toBe('UNKNOWN');
  });

  it('preserves a real accessible generic bank as a sufficient route', () => {
    const bank = { ...service.contentFor(41, 57)!, objects: [['Bank booth', 1] as [string, number]], npcs: [] };
    const source = { taskRequirements: () => [], chunkEntryRequirements: () => [] };
    expect(evaluateBankRequirements(bank, { cx: 41, cy: 57 }, initialState.unlocks, source).status).toBe('ALLOWED');
  });
});
