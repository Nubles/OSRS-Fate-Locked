import { describe, expect, it } from 'vitest';
import { splitJournalEntriesByKind } from './QuestLog';

describe('Quest Log journal-entry classification', () => {
  it('groups a zero-point quest as a quest based on kind', () => {
    const zeroPointQuest = {
      id: 'Synthetic zero-point quest',
      kind: 'quest' as const,
      points: 0,
    };

    expect(splitJournalEntriesByKind([zeroPointQuest])).toEqual({
      quests: [zeroPointQuest],
      miniquests: [],
    });
  });
});
