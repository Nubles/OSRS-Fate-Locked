import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import { journalNextBestQuestAction, selectJournalNextBestActions } from './JournalNextBest';

const pryingTimesUnlocks = () => ({
  equipment: {},
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
  bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [], cas: [], completedTasks: [], collectionLog: {},
});

describe('Journal next-best diary readiness', () => {
  it('uses canonical remaining task blockers instead of stale tier aggregates', () => {
    const unlocks = {
      equipment: {},
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
      regions: [...new Set(ALL_DIARY_TASKS.flatMap(task => [
        ...(task.regions ?? []), ...(task.anyOfRegions ?? []),
      ]))],
      mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
      bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
      quests: Object.keys(QUEST_DATA).filter(quest => quest !== 'Biohazard'),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Ardougne Easy'),
      cas: ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'],
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Ardougne Easy' || task.id !== 'ard_easy_6')
        .map(task => task.id),
      collectionLog: {},
    };

    expect(selectJournalNextBestActions(unlocks)).toContainEqual(
      expect.objectContaining({
        kind: 'diary',
        id: 'Ardougne Easy',
        unmet: 1,
        firstBlocker: 'Biohazard',
      }),
    );
  });

  it('surfaces Prying Times Sailing and source requirements as confirmation blockers', () => {
    const prying = journalNextBestQuestAction(
      QUEST_DATA['Prying Times'], pryingTimesUnlocks());

    expect(prying).toEqual(expect.objectContaining({
      firstBlocker: 'Confirm: One open Sailing task slot',
    }));
    expect(prying!.unmet).toBeGreaterThan(1);
  });

  it('caps the ready-or-close feed at eight actions', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `Synthetic ready quest ${index}`);
    try {
      for (const id of ids) QUEST_DATA[id] = {
        ...QUEST_DATA['Prying Times'], id, name: id, regions: [], prereqs: [], skills: {},
        manualRequirements: [], operationalRequirements: [],
      };
      expect(selectJournalNextBestActions(pryingTimesUnlocks())).toHaveLength(8);
    } finally {
      for (const id of ids) delete QUEST_DATA[id];
    }
  });

  it('shows Varrock Hard as close while Kudos needs confirmation', () => {
    const actions = selectJournalNextBestActions({
      ...pryingTimesUnlocks(),
      regions: ['Varrock'],
      quests: Object.keys(QUEST_DATA),
      diaries: Object.keys(DIARY_DATA).filter(diary => diary !== 'Varrock Hard'),
      completedTasks: ALL_DIARY_TASKS
        .filter(task => task.tierId !== 'Varrock Hard' || task.id !== 'var_hard_2')
        .map(task => task.id),
    });

    expect(actions).toEqual([
      expect.objectContaining({
        unmet: 1,
        firstBlocker: 'Confirm: 153 Varrock Museum Kudos',
      }),
    ]);
  });
});

// This suite isolates destination/skill/manual behavior with known legal supplies.
// Acquisition availability itself is covered by itemAcquisition and source tests.
import { beforeEach as beforeSupplyTest, afterEach as afterSupplyTest, vi as supplySpy } from 'vitest';
import { chunkContentService as suppliedItemsFixture } from '../services/ChunkContentService';
let restoreSupplyFixture: (() => void)[] = [];
beforeSupplyTest(() => {
  const ready = supplySpy.spyOn(suppliedItemsFixture, 'ready', 'get').mockReturnValue(true);
  const records = supplySpy.spyOn(suppliedItemsFixture, 'itemSourceRecords').mockImplementation(itemName => [{ itemName, kind: 'spawn', hostName: 'Test prepared supplies', cx: 50, cy: 50, rawRequirements: [] }]);
  restoreSupplyFixture = [() => ready.mockRestore(), () => records.mockRestore()];
});
afterSupplyTest(() => restoreSupplyFixture.forEach(restore => restore()));
