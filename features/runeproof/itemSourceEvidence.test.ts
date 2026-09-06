import { describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../../types';
import { itemReferenceSourceEvidence, itemSourceEvidence, type ItemSourceRecord } from './itemSourceEvidence';

const unlocks: UnlockState = { equipment: {}, skills: {}, levels: {}, regions: [], chunks: [], mobility: [], arcana: [], housing: [],
  merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} };
const record = (overrides: Partial<ItemSourceRecord> = {}): ItemSourceRecord => ({ itemName: 'Egg', kind: 'spawn', hostName: 'Egg', cx: 50, cy: 54, rawRequirements: [], ...overrides });
const provider = (records = [record()], ready = true) => ({ ready, itemSourceRecords: vi.fn(() => records) });

describe('item source evidence', () => {
  it('looks up a source-linked identity without inventing a quantity or interpreting it as a clause', () => {
    const source = provider([record({ itemName: 'Oil and water' })]);
    const result = itemReferenceSourceEvidence({ name: 'Oil and water', quantity: null }, unlocks, 'chunked', source);
    expect(source.itemSourceRecords).toHaveBeenCalledWith('Oil and water');
    expect(result.status).toBe('candidates');
    expect(result.quantity).toBeUndefined();
    expect(result.sources[0].unknowns.length).toBeGreaterThan(0);
    expect(itemReferenceSourceEvidence({ name: 'Egg', quantity: -1 }, unlocks, 'chunked', source).status).toBe('unknown');
  });
  it('matches one complete name and proves its accessible ground-spawn acquisition', () => {
    const source = provider();
    const result = itemSourceEvidence('2 Egg', { ...unlocks, chunks: ['50,54'] }, 'chunked', source);
    expect(source.itemSourceRecords).toHaveBeenCalledWith('Egg');
    expect(result).toMatchObject({ quantity: 2, matchedItem: 'Egg', status: 'candidates', sources: [{ geography: 'unlocked' }] });
    expect(result.sources[0].acquisition).toBe('READY');
    expect(result.sources[0].unknowns).toEqual([]);
    expect(result.summary).toContain('equipment and item-use methods are checked separately');
  });
  it.each(['Egg or milk', 'Egg and milk', 'Egg (obtained during quest)', 'Egg — optional', 'Recommended Egg', 'Either Egg', 'Bring Egg'])('does not split or guess %s', clause => {
    const source = provider();
    expect(itemSourceEvidence(clause, unlocks, 'chunked', source).status).toBe('unknown');
    expect(source.itemSourceRecords).not.toHaveBeenCalled();
  });
  it('requires an exact item name returned by the source index', () => {
    expect(itemSourceEvidence('Eggs', unlocks, 'chunked', provider()).status).toBe('unknown');
    expect(itemSourceEvidence('egg', unlocks, 'chunked', provider()).status).toBe('candidates');
  });
  it('does not confuse all known chunks locked with complete acquisition impossibility', () => {
    const result = itemSourceEvidence('Egg', unlocks, 'chunked', provider());
    expect(result.sources[0].geography).toBe('locked');
    expect(result.status).toBe('candidates');
    expect(result.sources[0].acquisition).toBe('LOCKED');
  });
  it('preserves raw requirements, reports reviewed missing merchant gates, and leaves unknown wording unresolved', () => {
    const rawRequirements: ItemSourceRecord['rawRequirements'] = [{ raw: 'Use the General Stores', origin: 'ENTITY' }, { raw: 'Unknown merchant category: obscure seller', origin: 'ENTITY' }];
    const result = itemSourceEvidence('Egg', unlocks, 'chunked', provider([record({ kind: 'shop', hostName: 'Shop', rawRequirements })]));
    expect(result.sources[0].rawRequirements).toEqual(rawRequirements);
    expect(result.sources[0].rawRequirements).not.toBe(rawRequirements);
    expect(result.sources[0].knownMissingGates).toContain('Unlock: General Stores');
    expect(result.sources[0].unknowns).toContain('Unknown merchant category: obscure seller');
  });
  it('uses actual levels for reviewed chunk entry requirements but never guesses source method semantics', () => {
    const rawRequirements: ItemSourceRecord['rawRequirements'] = [{ raw: 'Magic level 70', origin: 'CHUNK_ENTRY' }, { raw: 'Mining level 15', origin: 'ENTITY' }];
    const result = itemSourceEvidence('Egg', { ...unlocks, levels: { Magic: 70 } }, 'chunked', provider([record({ rawRequirements })]));
    expect(result.sources[0].knownMissingGates).toEqual([]);
    expect(result.sources[0].unknowns).toContain('Mining level 15');
  });
  it('does not infer possession from historical collection-log counts', () => {
    const result = itemSourceEvidence('Egg', { ...unlocks, collectionLog: { 1944: 99 } }, 'chunked', provider());
    expect(result.sources[0].geography).toBe('locked');
    expect(result).not.toHaveProperty('held');
  });
  it('handles unloaded data, absent sources and invalid coordinates without a candidate', () => {
    expect(itemSourceEvidence('Egg', unlocks, undefined, provider([], false)).status).toBe('unknown');
    expect(itemSourceEvidence('Egg', unlocks, undefined, provider([])).status).toBe('unknown');
    expect(itemSourceEvidence('Egg', unlocks, undefined, provider([record({ cy: -1 })])).status).toBe('unknown');
  });
});
