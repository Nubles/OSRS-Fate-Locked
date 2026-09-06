import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from './questData';
import { QUEST_INDEX, catalogQuest, completedQuestIds, createQuestIndex } from './questCatalog';

describe('immutable quest catalogue', () => {
  const quest = { ...QUEST_DATA["Cook's Assistant"], name: 'Renamed quest', prereqs: [] };
  it('preserves legacy saved IDs across display renames and rejects ambiguous references', () => {
    const index = createQuestIndex([{ id: 'quest:0001', legacyId: 'Old name' }], { 'Old name': quest });
    expect(index.resolve('Old name')).toBe('quest:0001');
    expect(index.resolve('Renamed quest')).toBe('quest:0001');
    expect(index.resolve('quest:0001')).toBe('quest:0001');
    expect(() => createQuestIndex([{ id: 'quest:0001', legacyId: 'A' }, { id: 'quest:0002', legacyId: 'B' }], { A: quest, B: quest })).toThrow('Ambiguous');
  });
  it('rejects missing and dangling identities and prerequisites', () => {
    expect(() => createQuestIndex([], { A: quest })).toThrow('Missing');
    expect(() => createQuestIndex([{ id: 'quest:0001', legacyId: 'A' }], {})).toThrow('Invalid');
    expect(() => createQuestIndex([{ id: 'quest:0001', legacyId: 'A' }], { A: { ...quest, prereqs: ['Missing'] } })).toThrow('Dangling');
  });
  it('resolves every source quest and prerequisite and deduplicates legacy saves', () => {
    expect(QUEST_INDEX.byId.size).toBe(Object.keys(QUEST_DATA).length);
    for (const row of QUEST_INDEX.byId.values()) for (const id of row.prerequisiteIds) expect(QUEST_INDEX.byId.has(id)).toBe(true);
    const id = catalogQuest("Cook's Assistant")!.id;
    expect(completedQuestIds(["Cook's Assistant", '  COOK\'S ASSISTANT ', id, 'constructor'])).toEqual(new Set([id]));
    expect(catalogQuest('constructor')).toBeUndefined();
  });
});
