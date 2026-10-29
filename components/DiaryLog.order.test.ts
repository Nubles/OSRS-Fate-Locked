import { describe, expect, it } from 'vitest';
import { DIARY_DATA, DIARY_TIER_ORDER, compareDiaryTiers, diaryTierRank } from '../data/diaryData';
import { compareDiaryJournalOrder } from './DiaryLog';

/**
 * The Diary list sorted tiers by id, so each area read Easy, Elite, Hard,
 * Medium. It now reads Easy, Medium, Hard, Elite.
 */
describe('diary tier order', () => {
  it('ranks Easy, Medium, Hard, Elite', () => {
    expect(DIARY_TIER_ORDER).toEqual(['Easy', 'Medium', 'Hard', 'Elite']);
    expect(['Elite', 'Hard', 'Medium', 'Easy'].map(tier => diaryTierRank(tier as 'Easy'))).toEqual([3, 2, 1, 0]);
  });

  it('sorts by area, then tier', () => {
    const ids = Object.values(DIARY_DATA).sort((a, b) => compareDiaryTiers(b, a)).sort(compareDiaryTiers).map(d => d.id);
    expect(ids.slice(0, 5)).toEqual(['Ardougne Easy', 'Ardougne Medium', 'Ardougne Hard', 'Ardougne Elite', 'Desert Easy']);
  });

  it('keeps that order inside each status group of the Diary list', () => {
    const rows = Object.values(DIARY_DATA)
      .filter(d => d.id.startsWith('Varrock') || d.id.startsWith('Falador'))
      .map(d => ({ ...d, status: d.id === 'Varrock Elite' ? 'AVAILABLE' : d.id === 'Falador Easy' ? 'COMPLETED' : 'LOCKED_SKILL' }))
      .reverse()
      .sort(compareDiaryJournalOrder)
      .map(d => d.id);
    expect(rows).toEqual([
      'Varrock Elite',
      'Falador Medium', 'Falador Hard', 'Falador Elite',
      'Varrock Easy', 'Varrock Medium', 'Varrock Hard',
      'Falador Easy',
    ]);
  });
});
