import { describe, expect, it } from 'vitest';
import { QuestData, QUEST_DATA } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import { QuestChunkStatus } from '../utils/questDoability';
import { evaluateQuestDoability } from './QuestDoabilityPanel';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: { Slayer: 10 },
  levels: { Slayer: 99 },
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

const reachableChunk: QuestChunkStatus = {
  chunkCount: 1,
  reachable: 1,
  access: 'REACHABLE',
  startReachable: true,
  blockers: [],
};

describe('evaluateQuestDoability', () => {
  it('locks Enter the Abyss behind its alternative provider requirement', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Enter the Abyss'],
      unlocks({ quests: ['Rune Mysteries'] }),
      reachableChunk,
    );

    expect(row.bucket).toBe('LOCKED');
    expect(row.reqsMet).toBe(false);
    expect(row.lockedAreas).toEqual([
      "One of: East Ardougne or Tree Gnome Stronghold or Wizards' Guild",
    ]);
  });

  it('allows Enter the Abyss when one provider is available', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Enter the Abyss'],
      unlocks({
        quests: ['Rune Mysteries'],
        regions: ['East Ardougne'],
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('DOABLE');
    expect(row.reqsMet).toBe(true);
    expect(row.lockedAreas).toEqual([]);
  });

  it('keeps a level requirement blocked when the skill-method cap is too low', () => {
    const quest: QuestData = {
      id: 'Method cap quest',
      name: 'Method cap quest',
      regions: ['Misthalin'],
      skills: { Woodcutting: 15 },
      prereqs: [],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };

    const row = evaluateQuestDoability(
      quest,
      unlocks({
        skills: { Woodcutting: 1 },
        levels: { Woodcutting: 15 },
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('REQS');
    expect(row.reqsMet).toBe(false);
    expect(row.missingSkills).toEqual([
      { skill: 'Woodcutting', lvl: 15, have: 15 },
    ]);
  });
});
