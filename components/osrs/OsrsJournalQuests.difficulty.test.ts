import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../../data/questData';
import { difficultyRowLabel } from './OsrsJournalQuests';

// The game rates Recipe for Disaster and all ten of its parts "Special" (Wiki, Nov 2026).
// The per-part tiers are the mode's own, so the journal must not call them official.
describe('journal difficulty row label', () => {
  it('drops "Official" for the ten Recipe for Disaster parts', () => {
    const rfd = Object.values(QUEST_DATA).filter(quest => quest.id.startsWith('RFD: '));
    expect(rfd).toHaveLength(10);
    for (const quest of rfd) expect(difficultyRowLabel(quest), quest.id).toBe('Difficulty');
  });

  it('keeps "Official difficulty" for quests the game rates itself', () => {
    for (const id of ["Cook's Assistant", 'Dragon Slayer I', 'Desert Treasure II']) {
      expect(difficultyRowLabel(QUEST_DATA[id]), id).toBe('Official difficulty');
    }
  });
});
