// The Diaries, Quests and Combat panels print useSourceKeyChance(), the
// chance the roll really uses with the run's achievement boosts and ritual
// odds included. They used to call that number the "base chance", which it
// is not once a boost is claimed. They now read as the Journal screen's own
// detail views do (OsrsJournalDetail.tsx).
import { describe, expect, it } from 'vitest';
import diaries from './OsrsJournalDiaries.tsx?raw';
import quests from './OsrsJournalQuests.tsx?raw';
import combat from './OsrsJournalCombat.tsx?raw';
import detail from './OsrsJournalDetail.tsx?raw';

describe('OSRS Journal panels name the Key chance as the Journal detail does', () => {
  it('never calls the boosted chance the base chance', () => {
    for (const source of [diaries, quests, combat]) expect(source).not.toContain('base chance');
  });

  it('uses the same words as the detail views', () => {
    expect(diaries).toContain('Each task rolls once for a Key at {rate}%.</div>');
    expect(combat).toContain('Each task rolls once for a Key at {rate}%.</div>');
    expect(quests).toContain('Completing it rolls once for a Key at {rate}%.</div>');
    expect(detail).toContain('Each task rolls once for a Key at {rate}%.</div>');
    expect(detail).toContain('Completing it rolls once for a Key at {rate}%.</div>');
  });
});
