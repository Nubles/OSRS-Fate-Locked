import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { caMonsterWikiUrl, questIdWikiUrl, questWikiUrl } from '../utils/questWikiUrl';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { ALL_CA_TASKS } from '../data/caTasks';
import { wikiUrl as nextBestWikiUrl } from './JournalNextBest';

describe('Quest Journal Wiki links', () => {
  it('opens the miniquest pages, not the minigame or raid that share their names', () => {
    expect(QUEST_DATA['Vale Totems'].kind).toBe('miniquest');
    expect(QUEST_DATA['The Fractured Archive'].kind).toBe('miniquest');
    expect(questWikiUrl('Vale Totems')).toBe('https://oldschool.runescape.wiki/w/Vale_Totems_(miniquest)');
    expect(questWikiUrl('The Fractured Archive')).toBe('https://oldschool.runescape.wiki/w/The_Fractured_Archive_(miniquest)');
  });

  it('keeps the plain page for other quests and the Recipe for Disaster page for its steps', () => {
    expect(questWikiUrl('Cook\'s Assistant')).toBe("https://oldschool.runescape.wiki/w/Cook's_Assistant");
    expect(questWikiUrl('RFD: Dwarf')).toBe('https://oldschool.runescape.wiki/w/Recipe_for_Disaster');
  });

  it('gives the next-best feed the same quest and miniquest pages', () => {
    const action = (name: string) => ({ kind: 'quest' as const, sub: 'QUESTS' as const, id: name, name, unmet: 0, diffRank: 1 });
    expect(nextBestWikiUrl(action('Vale Totems'))).toBe('https://oldschool.runescape.wiki/w/Vale_Totems_(miniquest)');
    expect(nextBestWikiUrl(action('The Fractured Archive'))).toBe('https://oldschool.runescape.wiki/w/The_Fractured_Archive_(miniquest)');
    expect(nextBestWikiUrl(action('Cook\'s Assistant'))).toBe("https://oldschool.runescape.wiki/w/Cook's_Assistant");
    expect(nextBestWikiUrl({ kind: 'diary', sub: 'DIARIES', id: 'Varrock Easy', name: 'Varrock Easy', unmet: 0, diffRank: 1 }))
      .toBe('https://oldschool.runescape.wiki/w/Varrock_Diary');
  });
});

describe('Diary and Combat Achievement Wiki links', () => {
  const page = (url: string) => decodeURIComponent(url.replace('https://oldschool.runescape.wiki/w/', ''));

  it('sends the Recipe for Disaster steps a diary asks for to the Recipe for Disaster page', () => {
    expect(questIdWikiUrl('RFD: Finale')).toBe('https://oldschool.runescape.wiki/w/Recipe_for_Disaster');
    expect(questIdWikiUrl('RFD: King Awowogei')).toBe('https://oldschool.runescape.wiki/w/Recipe_for_Disaster');
    // No page of the Wiki is called "RFD: ..." (checked 22 Nov 2026).
    const quests = [...new Set(ALL_DIARY_TASKS.flatMap(task => task.quests ?? []))];
    expect(quests.map(questIdWikiUrl).map(page).filter(title => title.startsWith('RFD:'))).toEqual([]);
  });

  it('opens the Combat Achievements page for a task with no monster', () => {
    expect(ALL_CA_TASKS.find(task => task.id === 'ca_399')?.monster).toBe('N/A');
    expect(caMonsterWikiUrl('N/A')).toBe('https://oldschool.runescape.wiki/w/Combat_Achievements');
    expect(caMonsterWikiUrl('Zulrah')).toBe('https://oldschool.runescape.wiki/w/Zulrah');
    expect(ALL_CA_TASKS.map(task => page(caMonsterWikiUrl(task.monster))).filter(title => title === 'N/A')).toEqual([]);
  });
});
