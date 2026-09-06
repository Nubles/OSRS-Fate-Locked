import { itemReferenceSourceEvidence } from '../features/runeproof/itemSourceEvidence';
import { describe, expect, it } from 'vitest';
import { evaluatePredicate } from './requirementPredicates';
import type { ItemSourceRecord } from '../features/runeproof/itemSourceEvidence';
import type { UnlockState } from '../types';
const unlocks: UnlockState = { equipment: {}, skills: {}, levels: {}, regions: [], chunks: ['50,53'], mobility: [], arcana: [], housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {} };
const record = (extra: Partial<ItemSourceRecord> = {}): ItemSourceRecord => ({ itemName: 'Steel dagger', kind: 'shop', hostName: 'Shop', cx: 50, cy: 53, rawRequirements: [{ raw: 'Use the General Stores', origin: 'ENTITY' }], ...extra });
const predicate = { kind: 'itemSource' as const, name: 'Steel dagger', label: 'Steel dagger' };
const context = (rows: ItemSourceRecord[], u = unlocks) => ({ unlocks: u, gameModeId: 'chunked', itemSources: { ready: true, itemSourceRecords: () => rows } });
describe('item acquisition and use stay separate', () => {
  it('requires both the shop location and its unlock', () => {
    expect(evaluatePredicate(predicate, context([record()])).status).toBe('UNKNOWN');
    expect(itemReferenceSourceEvidence({ name: predicate.name, quantity: null }, unlocks, 'chunked', context([record()]).itemSources).sources[0].acquisition).toBe('LOCKED');
    const open = { ...unlocks, merchants: ['General Stores'] };
    expect(evaluatePredicate(predicate, context([record()], open)).status).toBe('READY');
    expect(evaluatePredicate(predicate, context([record()], { ...open, chunks: [] })).status).toBe('UNKNOWN');
    expect(evaluatePredicate({ kind: 'equipment', slot: 'Weapon', tier: 2 }, context([record()], open)).status).toBe('LOCKED');
  });
  it('allows one valid alternative and does not invent shop or monster permissions', () => {
    expect(evaluatePredicate(predicate, context([record({ rawRequirements: [] })])).status).toBe('UNKNOWN');
    expect(evaluatePredicate(predicate, context([record({ kind: 'monster', rawRequirements: [] })])).status).toBe('UNKNOWN');
    expect(evaluatePredicate(predicate, context([record(), record({ kind: 'spawn', rawRequirements: [] })])).status).toBe('READY');
    expect(evaluatePredicate(predicate, context([])).status).toBe('UNKNOWN');
  });
  it('requires a method only when the chosen action requires it', () => {
    const ctx = context([], { ...unlocks, levels: { Woodcutting: 30 }, skills: { Woodcutting: 1 } });
    expect(evaluatePredicate({ kind: 'skill', skill: 'Woodcutting', level: 30 }, ctx).status).toBe('READY');
    expect(evaluatePredicate({ kind: 'method', skill: 'Woodcutting', tier: 3 }, ctx).status).toBe('LOCKED');
  });
});
