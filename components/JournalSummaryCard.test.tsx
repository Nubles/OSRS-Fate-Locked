import { describe, expect, it } from 'vitest';
import { QUEST_DATA, type QuestData } from '../data/questData';
import type { UnlockState } from '../types';
import { analyzeJournalQuestRecommendations, computeJournalSummary, doableCATasks, doableDiaryTasks, questsReadyLabel, recommendNextAction } from './JournalSummaryCard';
import { countDoableDiaryTasks } from '../utils/journalStatus';
import { ALL_CA_TASKS } from '../data/caTasks';
import { caTaskLockedBoss } from '../utils/caProgress';
import { canonicalBossId } from '../utils/contentIdentity';
import type { AreaRoutes } from '../utils/areaRoutes';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

describe('analyzeJournalQuestRecommendations', () => {
  it('excludes Prying Times from both the available count and quest recommendation', () => {
    const analysis = analyzeJournalQuestRecommendations(
      [QUEST_DATA['Prying Times']],
      [],
      pryingTimesUnlocks(),
    );

    expect(analysis.available).toBe(0);
    expect(analysis.candidates).toEqual([]);
    expect(analysis.best).toBeNull();
  });

  it('keeps an automatically eligible quest in the count and recommendation pool', () => {
    const automatic: QuestData = {
      ...QUEST_DATA['Prying Times'],
      id: 'Automatic test quest',
      name: 'Automatic test quest',
      manualRequirements: [],
    };
    const analysis = analyzeJournalQuestRecommendations(
      [automatic],
      [],
      pryingTimesUnlocks(),
    );

    expect(analysis.available).toBe(1);
    expect(analysis.candidates.map(quest => quest.id)).toEqual([automatic.id]);
    expect(analysis.best).toEqual(expect.objectContaining({ name: automatic.name }));
  });
});

/**
 * A player reported on 7 October 2026 that the Journal summary said 9 quests
 * were ready to complete while the Quest Log listed 6: the summary didn't
 * read the routes the Quest Log reads, so it counted quests in owned areas
 * no route reaches.
 */
describe('the Journal summary counts what the Quest Log lists', () => {
  const barcrawl = QUEST_DATA["Alfred Grimhand's Barcrawl"];
  const bars: UnlockState = {
    ...pryingTimesUnlocks(),
    skills: {}, levels: {}, quests: [], merchants: ['Bars & Inns'],
    regions: [...new Set(barcrawl.locations!.flatMap(location => location.standardAreas))],
  };
  const strandedAt = (...areas: string[]): AreaRoutes => ({ strandedAreas: new Set(areas), strandedChunks: new Set() });

  it('leaves out a quest no route reaches', () => {
    expect(analyzeJournalQuestRecommendations([barcrawl], [], bars, 'vanilla').available).toBe(1);
    const stranded = analyzeJournalQuestRecommendations([barcrawl], [], bars, 'vanilla', strandedAt('Brimhaven'));
    expect(stranded.available).toBe(0);
    expect(stranded.best).toBeNull();
  });

  it('names miniquests apart, as the Quest Log lists them', () => {
    expect(barcrawl.kind).toBe('miniquest');
    expect(analyzeJournalQuestRecommendations([barcrawl], [], bars, 'vanilla').availableMiniquests).toBe(1);
    expect(questsReadyLabel(9, 0)).toBe('9');
    expect(questsReadyLabel(9, 3)).toBe('6 quests and 3 miniquests');
    expect(questsReadyLabel(2, 1)).toBe('1 quest and 1 miniquest');
    expect(questsReadyLabel(2, 2)).toBe('2 miniquests');
  });
});

describe('journal completion recommendations in Vanilla', () => {
  const completedAccount = (): UnlockState => ({
    ...pryingTimesUnlocks(),
    quests: Object.keys(QUEST_DATA),
    diaries: Object.keys(DIARY_DATA),
    completedTasks: ALL_DIARY_TASKS.map(task => task.id),
  });

  it('does not celebrate completion while a quest still needs manual preparation', () => {
    const unlocks = completedAccount();
    unlocks.quests = unlocks.quests.filter(id => id !== 'Sheep Shearer');
    const recommendation = recommendNextAction(unlocks, 0, 0, 'vanilla');
    expect(recommendation.tab).toBe('QUESTS');
    expect(recommendation.headline).not.toBe("Everything's done!");
    expect(recommendation.detail).toMatch(/requirement|confirmation|unlock/i);
  });

  it('points to unfinished diaries when no tasks are currently doable', () => {
    const unlocks = { ...completedAccount(), diaries: [] };
    const recommendation = recommendNextAction(unlocks, 0, 0, 'vanilla');
    expect(recommendation.tab).toBe('DIARIES');
    expect(recommendation.headline).not.toBe("Everything's done!");
  });

  it('celebrates only when all journal content is completed', () => {
    expect(recommendNextAction(completedAccount(), 0, 0, 'vanilla'))
      .toMatchObject({ tab: null, headline: "Everything's done!" });
  });
});

describe('the Journal window\'s doable lists', () => {
  it('lists exactly the diary tasks the doable count counts', () => {
    const unlocks: UnlockState = {
      ...pryingTimesUnlocks(),
      regions: ['Misthalin', 'Asgarnia', 'Varrock', 'Lumbridge'],
      completedTasks: [ALL_DIARY_TASKS[0].id],
    };
    const listed = doableDiaryTasks(ALL_DIARY_TASKS, unlocks);
    expect(listed.length).toBe(countDoableDiaryTasks(ALL_DIARY_TASKS, unlocks));
    expect(listed.some(task => task.id === ALL_DIARY_TASKS[0].id)).toBe(false);
  });

  it('counts a Combat Achievement task as doable only at an unlocked boss, and never once done', () => {
    const task = ALL_CA_TASKS.find(t => canonicalBossId(t.monster))!;
    const boss = canonicalBossId(task.monster)!;
    const locked = { completedTasks: [] as string[], bosses: [] as string[] };
    expect(doableCATasks([task], locked)).toEqual([]);
    expect(caTaskLockedBoss(task, locked.bosses)).toBe(boss);
    expect(doableCATasks([task], { completedTasks: [], bosses: [boss] })).toEqual([task]);
    expect(doableCATasks([task], { completedTasks: [task.id], bosses: [boss] })).toEqual([]);
  });
});

/**
 * Every level-up froze the page while the summary picked the best next quest
 * (it re-checks every quest and diary tier for each available quest), twice
 * per change, even with advisors off, when nothing shows the pick
 * (critique PERF-1). The summary now analyzes once, and picks only for the
 * advisor.
 */
describe('computeJournalSummary', () => {
  const midGame = (): UnlockState => ({
    ...pryingTimesUnlocks(),
    skills: { Attack: 5, Strength: 5, Defence: 5, Hitpoints: 5, Smithing: 5, Mining: 5, Crafting: 5, Cooking: 5 },
    levels: { Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40, Smithing: 35, Mining: 35, Crafting: 30, Cooking: 30 },
    regions: ['Misthalin', 'Asgarnia', 'Varrock', 'Lumbridge', 'Draynor', 'Falador', 'Port Sarim', 'Rimmington', 'Kandarin'],
    quests: ["Cook's Assistant", 'Rune Mysteries'],
  });

  it('gives the same recommendation as working it out from scratch', () => {
    const unlocks = midGame();
    const { stats, recommendation } = computeJournalSummary(unlocks, 'vanilla', undefined, true);
    expect(recommendation).toEqual(recommendNextAction(unlocks, stats.diaries.doable, stats.ca.left, 'vanilla'));
  }, 30_000);

  it('gives the same counts with the advisor off, without picking a best quest', () => {
    const unlocks = midGame();
    const ranked = computeJournalSummary(unlocks, 'vanilla', undefined, true);
    const counted = computeJournalSummary(unlocks, 'vanilla', undefined, false);
    expect(counted.stats).toEqual(ranked.stats);
    expect(counted.stats.quests.available).toBeGreaterThan(0);
    const analysis = analyzeJournalQuestRecommendations(
      Object.values(QUEST_DATA), Object.values(DIARY_DATA), unlocks, 'vanilla', undefined, false);
    expect(analysis.best).toBeNull();
    expect(analysis.available).toBe(ranked.stats.quests.available);
  }, 30_000);
});
