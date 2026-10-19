import { beforeAll, describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import {
  ARCANA_LIST, BOSSES_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST, SKILLS_LIST,
} from '../data/items';
import type { UnlockState } from '../types';
import { computeAreaRoutes, type AreaRoutes } from '../utils/areaRoutes';
import { isQuestReady, readyQuests } from '../utils/journalStatus';
import { loadWalkSections } from '../utils/walkSections';
import { analyzeJournalQuestRecommendations } from './JournalSummaryCard';
import { questFilterStatus, questLogEligibility } from './QuestLog';
import { journalNextBestFeed, journalNextBestHeader, selectJournalNextBestActions } from './JournalNextBest';
import { evaluateQuestDoability } from './QuestDoabilityPanel';

// Routes walk the Chunk Picker sections, which load with the chunk content.
beforeAll(() => loadWalkSections());

/**
 * Players saw the Journal disagree on how many quests were ready: the home
 * summary said 7, the Quest Log's Available filter 7, Next best actions 8 and
 * the Doable tab 10. Next best and Doable didn't read the routes, so a quest
 * in an owned area no route reaches counted there, and Next best's header
 * counted only the eight items it shows. Every count now reads isQuestReady.
 */
const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [], mobility: [...MOBILITY_LIST], arcana: [...ARCANA_LIST], housing: [],
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST],
  storage: [], guilds: [], farming: [], slayerUnlocks: [], quests: [],
  diaries: [], cas: [], completedTasks: [], collectionLog: {}, ...overrides,
});

const allQuests = Object.values(QUEST_DATA);

const counts = (unlocks: UnlockState, routes: AreaRoutes | null) => ({
  summary: analyzeJournalQuestRecommendations(allQuests, Object.values(DIARY_DATA), unlocks, 'vanilla', routes).available,
  questLog: allQuests.filter(quest => {
    const eligibility = questLogEligibility(quest, unlocks, 'vanilla', routes);
    return questFilterStatus({ status: eligibility.status, eligibility }) === 'AVAILABLE';
  }).length,
  nextBest: journalNextBestFeed(unlocks, 'vanilla', routes).readyQuests,
  doable: allQuests.filter(quest => (
    evaluateQuestDoability(quest, unlocks, null, [], 'vanilla', routes).bucket === 'DOABLE'
  )).length,
});

describe('one ready-quest count across the Journal', () => {
  // The Ruins of Uzer owned, with nothing joining it to Misthalin: The Golem
  // is ready by its requirements but no route reaches it.
  const unlocks = account({ regions: ['Ruins of Uzer'] });
  const routes = computeAreaRoutes({}, unlocks, 'vanilla');

  it('builds a run with an owned area no route reaches', () => {
    expect(routes?.strandedAreas.has('Ruins of Uzer')).toBe(true);
    const golem = QUEST_DATA['The Golem'];
    expect(isQuestReady(golem, unlocks, 'vanilla')).toBe(true);
    expect(isQuestReady(golem, unlocks, 'vanilla', routes)).toBe(false);
  });

  it('gives the summary, Quest Log, Next best and Doable tab the same number', () => {
    const ready = readyQuests(unlocks, 'vanilla', routes).length;
    expect(ready).toBeGreaterThan(8); // more than Next best shows, so the cap can't hide a difference
    expect(counts(unlocks, routes)).toEqual({ summary: ready, questLog: ready, nextBest: ready, doable: ready });
    expect(readyQuests(unlocks, 'vanilla').length).toBe(ready + 1);
  });

  it('puts the quest no route reaches in the Doable tab\'s Stranded group', () => {
    const golem = evaluateQuestDoability(QUEST_DATA['The Golem'], unlocks, null, [], 'vanilla', routes);
    expect(golem.bucket).toBe('STRANDED');
    expect(golem.otherRequirements.some(label => label.startsWith('No route to'))).toBe(true);
  });

  it('counts every ready quest in the Next best header, not only the eight shown', () => {
    const feed = journalNextBestFeed(unlocks, 'vanilla', routes);
    expect(feed.actions).toHaveLength(8);
    expect(feed.actions).toEqual(selectJournalNextBestActions(unlocks, 'vanilla', routes));
    const ready = readyQuests(unlocks, 'vanilla', routes).length;
    expect(journalNextBestHeader(feed)).toBe(
      `${ready} quests ready` + (feed.readyDiaries ? `, ${feed.readyDiaries} ${feed.readyDiaries === 1 ? 'diary' : 'diaries'}` : ''),
    );
  });

  it('words the header plainly', () => {
    const actions = selectJournalNextBestActions(unlocks, 'vanilla', routes);
    expect(journalNextBestHeader({ actions, readyQuests: 7, readyDiaries: 0 })).toBe('7 quests ready');
    expect(journalNextBestHeader({ actions, readyQuests: 7, readyDiaries: 2 })).toBe('7 quests ready, 2 diaries');
    expect(journalNextBestHeader({ actions, readyQuests: 1, readyDiaries: 1 })).toBe('1 quest ready, 1 diary');
    expect(journalNextBestHeader({ actions, readyQuests: 0, readyDiaries: 2 })).toBe('2 diaries ready');
    expect(journalNextBestHeader({ actions: actions.slice(0, 5), readyQuests: 0, readyDiaries: 0 })).toBe('5 close');
  });
});
