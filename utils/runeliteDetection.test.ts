import { describe, expect, it } from 'vitest';
import { BOSS_KILL_COUNTS } from '../data/bossKillCounts';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import { rulesDetection } from './runeliteDetection';

describe('rulesDetection', () => {
  it('names every boss by its kill-count names, and marks the raids', () => {
    const { bosses } = rulesDetection();
    expect(bosses.map((boss) => boss.key)).toEqual(Object.keys(BOSS_KILL_COUNTS).sort((a, b) => a.localeCompare(b)));
    expect(bosses.find((boss) => boss.key === 'Dagannoth Kings'))
      .toEqual({ key: 'Dagannoth Kings', raid: false, killCounts: ['Dagannoth Rex', 'Dagannoth Prime', 'Dagannoth Supreme'] });
    expect(bosses.filter((boss) => boss.raid).map((boss) => boss.key))
      .toEqual(['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut']);
  });

  it('lists every quest by the app id, with its name', () => {
    const { quests } = rulesDetection();
    expect(quests).toHaveLength(Object.keys(QUEST_DATA).length);
    expect(quests).toContainEqual({ id: 'RFD: The Cook', name: 'RFD: Start (The Cook)' });
    expect(quests.map((quest) => quest.id)).toEqual([...quests.map((quest) => quest.id)].sort((a, b) => a.localeCompare(b)));
  });

  it('lists the 48 diary tiers by the app id', () => {
    const { diaryTiers } = rulesDetection();
    expect(diaryTiers).toHaveLength(48);
    expect(diaryTiers).toEqual(Object.keys(DIARY_DATA).sort((a, b) => a.localeCompare(b)));
    expect(diaryTiers).toContain('Lumbridge Easy');
  });

  it('comes out the same every time, so bundles only change when the lists do', () => {
    expect(JSON.stringify(rulesDetection())).toBe(JSON.stringify(rulesDetection()));
  });
});
