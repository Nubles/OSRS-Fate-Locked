import { describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { validateAndMigrateSave } from './saveSchema';
import { emptyRuneProofProgress, migrateLocalRuneProofProgress, sealRuneProofReplacement } from './runeProofProgress';

describe('canonical RuneProof save boundary', () => {
  it('round-trips guide progress with action revision and removes duplicate IDs', () => {
    const state = createFreshState();
    state.gameModeId = 'vanilla';
    state.runeProofProgress = { version: 1, items: { "Cook's Assistant": ['egg', 'egg'] },
      actions: { "Cook's Assistant": { revision: 'v1', ids: ['step', 'step'] } } };
    const result = validateAndMigrateSave(state, createFreshState());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.runeProofProgress).toEqual({ version: 1,
      items: { "Cook's Assistant": ['egg'] }, actions: { "Cook's Assistant": { revision: 'v1', ids: ['step'] } } });
  });

  it.each([
    { version: 2, items: {}, actions: {} },
    { version: 1, items: [], actions: {} },
    { version: 1, items: {}, actions: { quest: { ids: ['step'] } } },
    { version: 1, items: {}, actions: { quest: { revision: 1, ids: ['step'] } } },
    { version: 1, items: { quest: [3] }, actions: {} },
    { version: 1, items: { quest: Array(1001).fill('item') }, actions: {} },
    { version: 1, items: {}, actions: {}, extra: true },
    JSON.parse('{"version":1,"items":{"__proto__":["egg"]},"actions":{}}'),
  ])('rejects malformed guide state at the normal save boundary (%#)', runeProofProgress => {
    const result = validateAndMigrateSave({ ...createFreshState(), gameModeId: 'vanilla', runeProofProgress }, createFreshState());
    expect(result.ok).toBe(false);
  });

  it('does not invoke accessors supplied in guide data', () => {
    let accessed = false;
    const progress = { version: 1, items: {}, actions: {} };
    Object.defineProperty(progress.items, 'quest', { enumerable: true, get: () => { accessed = true; return []; } });
    const result = validateAndMigrateSave({ ...createFreshState(), runeProofProgress: progress }, createFreshState());
    expect(result.ok).toBe(false);
    expect(accessed).toBe(false);
  });

  it('only local unmarked saves read legacy checks; selected replacements never do', () => {
    const legacy = createFreshState();
    delete legacy.runeProofProgress;
    const calls: string[] = [];
    const storage = { getItem: (key: string) => { calls.push(key); return JSON.stringify({ "Cook's Assistant": ['egg'] }); } };
    const selected = sealRuneProofReplacement(legacy);
    expect(migrateLocalRuneProofProgress(selected, storage)).toBe(selected);
    expect(calls).toEqual([]);
    expect(selected.runeProofProgress).toEqual(emptyRuneProofProgress());
    expect(migrateLocalRuneProofProgress(legacy, storage).runeProofProgress?.items["Cook's Assistant"]).toEqual(['egg']);
    expect(calls).toHaveLength(2);
  });

  it('does not record migration completion when legacy storage is unreadable', () => {
    const legacy = createFreshState();
    delete legacy.runeProofProgress;
    expect(migrateLocalRuneProofProgress(legacy, { getItem: () => { throw new Error('unavailable'); } })).toBe(legacy);
  });
});
