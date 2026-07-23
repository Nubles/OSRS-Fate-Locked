import { describe, expect, it } from 'vitest';
import { DiaryTask } from '../data/diaryTasks';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { UnlockState } from '../types';
import { chunkKey } from '../utils/chunkAdjacency';
import { calculateDiaryInsightStats } from './JournalInsights';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
  ...over,
});

describe('calculateDiaryInsightStats', () => {
  it('excludes completed diary tiers from the closest-tier recommendation', () => {
    const tasks: DiaryTask[] = [
      { id: 'easy-task', tierId: 'Test Easy', description: 'Easy task' },
      { id: 'medium-task', tierId: 'Test Medium', description: 'Medium task' },
    ];

    const stats = calculateDiaryInsightStats(
      tasks,
      ['Test Easy', 'Test Medium'],
      unlocks({ diaries: ['Test Easy'] }),
    );

    expect(stats.closest?.tier).toBe('Test Medium');
    expect(stats.closest?.doable).toBe(1);
  });

  it('uses chunk reachability in chunked mode', () => {
    const tasks: DiaryTask[] = [{
      id: 'ardougne-task',
      tierId: 'Test Easy',
      description: 'Reach East Ardougne',
      regions: ['East Ardougne'],
    }];
    const eastArdougneChunk = chunkKey(SUB_AREA_CHUNKS['East Ardougne'][0]);
    const regionOnly = unlocks({ regions: ['East Ardougne'], chunks: [] });

    expect(calculateDiaryInsightStats(
      tasks,
      ['Test Easy'],
      regionOnly,
      'chunked',
    ).closest?.doable).toBe(0);

    expect(calculateDiaryInsightStats(
      tasks,
      ['Test Easy'],
      { ...regionOnly, chunks: [eastArdougneChunk] },
      'chunked',
    ).closest?.doable).toBe(1);
  });
});
