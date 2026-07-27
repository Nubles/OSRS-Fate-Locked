import { describe, expect, it } from 'vitest';
import { QuestData, QUEST_DATA } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import { QuestChunkStatus } from '../utils/questDoability';
import {
  evaluateQuestDoability,
  questDoabilityRequirementLabels,
  questDoabilitySkillBlockerLabel,
} from './QuestDoabilityPanel';

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

const questIdsWorthAtLeast = (points: number): string[] => {
  const completed: string[] = [];
  let total = 0;
  for (const quest of Object.values(QUEST_DATA)) {
    if (quest.points <= 0) continue;
    completed.push(quest.id);
    total += quest.points;
    if (total >= points) return completed;
  }
  throw new Error(`Not enough Quest Points to reach ${points}`);
};

describe('evaluateQuestDoability', () => {
  it('does not report an evidence-free quest as doable', () => {
    const quest: QuestData = {
      id: 'Unknown location quest',
      name: 'Unknown location quest',
      regions: [],
      skills: {},
      prereqs: [],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };
    expect(evaluateQuestDoability(quest, unlocks(), null).bucket).toBe('NO_DATA');
  });

  it('keeps explicit canonical access authoritative without chunk data', () => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    expect(evaluateQuestDoability(
      quest,
      unlocks({ regions: ['Draynor Village'] }),
      null,
    ).bucket).toBe('LOCKED');
  });
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
      { skill: 'Woodcutting', lvl: 15, have: 15, methodCap: 10 },
    ]);
    expect(questDoabilitySkillBlockerLabel(row.missingSkills[0])).toBe(
      'Woodcutting 15 (method cap 10)',
    );
  });

  it('shows Quest Points requirements as a skill blocker instead of a prerequisite', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Black Knights\' Fortress'],
      unlocks({ regions: ['Asgarnia'] }),
      reachableChunk,
    );

    expect(row.missingSkills).toContainEqual({
      skill: 'Quest Points', lvl: 12, have: 0,
    });
    expect(questDoabilitySkillBlockerLabel(row.missingSkills[0])).toBe(
      'Quest Points 12',
    );
    expect(row.missingPrereqs).not.toContain('Quest Points 12');
  });

  it('does not confuse a missing prerequisite with satisfied Quest Points', () => {
    const quest: QuestData = {
      id: 'Quest Points collision',
      name: 'Quest Points collision',
      regions: ['Asgarnia'],
      skills: { 'Quest Points': 12 },
      prereqs: ['Quest Points 12'],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };

    const row = evaluateQuestDoability(
      quest,
      unlocks({
        regions: ['Asgarnia'],
        quests: questIdsWorthAtLeast(12),
      }),
      reachableChunk,
    );

    expect(row.missingSkills).toEqual([]);
    expect(row.missingPrereqs).toEqual(['Quest Points 12']);
  });

  it('hides unmet requirements for completed quests', () => {
    const quest: QuestData = {
      id: 'Completed Quest Points collision',
      name: 'Completed Quest Points collision',
      regions: ['Asgarnia'],
      skills: { 'Quest Points': 12 },
      prereqs: ['Unmet prerequisite'],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };

    const row = evaluateQuestDoability(
      quest,
      unlocks({
        regions: ['Asgarnia'],
        quests: [quest.id],
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('DONE');
    expect(row.missingSkills).toEqual([]);
    expect(row.missingPrereqs).toEqual([]);
  });

  it('keeps Prying Times in REQS until its manual Sailing check is confirmed', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Prying Times'],
      unlocks({
        regions: ['The Open Seas'],
        quests: ['Pandemonium', "The Knight's Sword"],
        skills: { Smithing: 3, Sailing: 2 },
        levels: { Smithing: 30, Sailing: 12 },
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('REQS');
    expect(row.reqsMet).toBe(false);
    expect(row.manualChecks).toEqual(['One open Sailing task slot']);
    expect(row.missingSkills).toEqual([]);
    expect(row.missingPrereqs).toEqual([]);
    expect(questDoabilityRequirementLabels(row)).toEqual([
      'Confirm: One open Sailing task slot',
    ]);
  });
});
