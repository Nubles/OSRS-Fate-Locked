import { describe, expect, it } from 'vitest';
import { gameReducerForTest, migrateSaveForTest, prepareDetectedEventAcceptanceAction } from './GameContext';
import { DROP_RATES } from '../config/rules';
import { CHUNKED_MILESTONE_INTERVAL, failureFateForSkillLevel, failureFateForSource, XTREME_MILESTONE_INTERVAL } from '../config/economy';
import { resolveModeRules } from '../config/gameModes';
import { ALL_CA_TASKS } from '../data/caTasks';
import { CA_DATA } from '../data/caData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { completedCAPoints } from '../utils/caProgress';
import { auditHistory } from '../utils/integrity';
import { DropSource, TableType, type DetectedProgress, type GameState, type RollIntent } from '../types';

// Accepting a detected RuneLite event applies the same rules as completing
// the same thing by hand in the Journal, Farm and skill panels.
type Run = Parameters<typeof gameReducerForTest>[0];
const run = (
  overrides: Omit<Partial<GameState>, 'unlocks'> & { unlocks?: Partial<GameState['unlocks']> } = {},
): Run => {
  const fresh = migrateSaveForTest({ history: [] });
  return {
    ...fresh,
    runId: 'run-1',
    runRevision: 5,
    linkedAccount: 'Nubles',
    gameModeId: 'vanilla',
    lastEvent: null,
    ...overrides,
    unlocks: { ...fresh.unlocks, ...overrides.unlocks },
  };
};
type Dice = (purpose: string, index?: number, max?: number) => number;

// Every roll succeeds without turning into an Omni-key.
const succeed: Dice = (_purpose, index = 0, max = 100) => (index === 2 ? max : 1);
// Every roll and every Chaos Key chance fails.
const fail: Dice = (_purpose, _index = 0, max = 100) => max;

const DETECTORS: Record<DetectedProgress['kind'], string> = {
  SKILL_LEVEL: 'skill-level-v1', QUEST: 'quest-widget-v1', CA_TASK: 'combat-achievement-chat-v1',
  DIARY_TASK: 'diary-task-v1', COLLECTION_ITEM: 'collection-log-chat-v1', NONE: 'boss-loot-v1',
};

const accept = (state: Run, progress: DetectedProgress, intent: RollIntent, dice: Dice, eventId = 'evt') =>
  gameReducerForTest(state, prepareDetectedEventAcceptanceAction(
    state, progress, intent, dice,
    { fateEventId: eventId, detectorId: DETECTORS[progress.kind], detectorVersion: 1 },
    { runId: state.runId, account: 'Nubles', runRevision: state.runRevision },
  ));

describe('detected event acceptance follows manual completion', () => {
  it('does not roll progress the run has already recorded', () => {
    const state = run({ unlocks: { quests: ["Cook's Assistant"] } });

    const next = accept(state, { kind: 'QUEST', questId: "Cook's Assistant" }, {
      source: DropSource.QUEST_NOVICE, threshold: DROP_RATES[DropSource.QUEST_NOVICE], failureFate: 1,
      target: "Cook's Assistant",
    }, succeed);

    expect(next).toBe(state);
  });

  it("draws a Vanilla boss's detected kills from its finite key reserve", () => {
    let state = run({ unlocks: { bosses: ['Vorkath'] } });
    const intent: RollIntent = {
      source: DropSource.BOSS_MID, threshold: 30, failureFate: 2, target: 'Vorkath',
      context: { kind: 'boss', bossName: 'Vorkath', bossClass: 'mid' },
    };
    const keys = state.keys;

    state = accept(state, { kind: 'NONE' }, intent, succeed, 'kill-1');
    state = accept(state, { kind: 'NONE' }, intent, succeed, 'kill-2');

    expect(state.keys).toBe(keys + 2);
    expect(state.bossStandardKeysAwarded).toEqual({ Vorkath: 2 });
    // The reserve is 2/2, so a third kill has nothing left to award.
    expect(() => accept(state, { kind: 'NONE' }, intent, succeed, 'kill-3')).toThrow('no Standard Keys left');
  });

  it('records the Combat Achievement tier a detected task completes', () => {
    const easy = ALL_CA_TASKS.filter(task => task.tierId === 'Easy').map(task => task.id);
    expect(completedCAPoints(easy)).toBe(CA_DATA.Easy.pointsRequired);
    const state = run({ unlocks: { completedTasks: easy.slice(0, -1) } });

    const next = accept(state, { kind: 'CA_TASK', taskId: easy.at(-1)! }, {
      source: DropSource.CA_EASY, threshold: DROP_RATES[DropSource.CA_EASY],
      failureFate: failureFateForSource(DropSource.CA_EASY), target: 'The last Easy task',
    }, fail);

    expect(next.unlocks.cas).toEqual(['Easy']);
  });

  it('records the diary tier a detected last task completes', () => {
    const tasks = ALL_DIARY_TASKS.filter(task => task.tierId === 'Karamja Elite').map(task => task.id);
    const state = run({ unlocks: { completedTasks: tasks.slice(0, -1) } });

    const next = accept(state, { kind: 'DIARY_TASK', taskId: tasks.at(-1)! }, {
      source: DropSource.DIARY_ELITE, threshold: DROP_RATES[DropSource.DIARY_ELITE],
      failureFate: failureFateForSource(DropSource.DIARY_ELITE), target: 'The last Karamja Elite task',
    }, fail);

    expect(next.unlocks.diaries).toContain('Karamja Elite');
  });

  it("keeps a detected level's Chaos Key through replay when its roll becomes a Pity Key", () => {
    // One Fate short of pity: the failed level-30 roll becomes a Pity Key and
    // carries level 30's guaranteed Chaos Key, which is then spent.
    const pityThreshold = resolveModeRules('vanilla').pityThreshold;
    const fresh = run();
    const state = run({
      fatePoints: pityThreshold - 1,
      unlocks: {
        skills: { ...fresh.unlocks.skills, Attack: 3 },
        levels: { ...fresh.unlocks.levels, Attack: 29 },
      },
    });

    const leveled = accept(state, { kind: 'SKILL_LEVEL', skill: 'Attack', level: 30 }, {
      source: 'Attack Level 30', threshold: 6, failureFate: failureFateForSkillLevel(30), target: 'Attack Level 30',
    }, fail);
    expect(leveled.history.at(-1)?.type).toBe('PITY');
    expect(leveled.chaosKeys).toBe(state.chaosKeys + 1);
    const spent = gameReducerForTest(leveled, {
      type: 'UNLOCK', payload: { table: TableType.SKILLS, item: 'Attack', costType: 'chaosKey', cost: 1 },
    });

    const audit = auditHistory(spent.history, resolveModeRules('vanilla'));
    expect(audit.violations.map(violation => violation.kind)).not.toContain('CHAOS_NEGATIVE');
    expect(audit.final.chaosKeys).toBe(0);
  });
});

describe('detected level-ups and the start-area milestone Keys', () => {
  it.each([
    ['xtreme', XTREME_MILESTONE_INTERVAL, 'xtremeMilestoneClaimed', 'Xtreme milestone'],
    ['chunked', CHUNKED_MILESTONE_INTERVAL, 'chunkedMilestoneClaimed', 'Chunked milestone'],
  ] as const)('pays a %s run the milestone Key a manual level-up pays', (gameModeId, interval, claimedKey, message) => {
    const fresh = run({ gameModeId });
    const others = Object.entries(fresh.unlocks.levels)
      .filter(([skill]) => skill !== 'Attack')
      .reduce((total, [, level]) => total + level, 0);
    // Attack sits one level below the next unclaimed milestone.
    const milestone = Math.ceil((others + 3) / interval) * interval;
    const attack = milestone - 1 - others;
    const state = run({
      gameModeId,
      [claimedKey]: milestone / interval - 1,
      unlocks: {
        skills: { ...fresh.unlocks.skills, Attack: 10 },
        levels: { ...fresh.unlocks.levels, Attack: attack },
      },
    });

    const detected = accept(state, { kind: 'SKILL_LEVEL', skill: 'Attack', level: attack + 1 }, {
      source: `Attack Level ${attack + 1}`, threshold: 1, failureFate: failureFateForSkillLevel(attack + 1),
      target: `Attack Level ${attack + 1}`,
    }, fail);
    const manual = gameReducerForTest(state, { type: 'LEVEL_UP', payload: { skill: 'Attack', chaosRoll: 1 } });

    expect(manual.keys).toBe(state.keys + 1);
    expect(detected.keys).toBe(manual.keys);
    expect(detected[claimedKey]).toBe(milestone / interval);
    expect(detected.history.at(-1)).toMatchObject({ type: 'XTREME_MILESTONE', meta: { gained: 1 } });
    expect(detected.history.at(-1)?.message).toContain(message);
    expect(auditHistory(detected.history, resolveModeRules(gameModeId)).final.keys)
      .toBe(auditHistory(state.history, resolveModeRules(gameModeId)).final.keys + 1);
  });

  it('pays nothing once the run has left its start', () => {
    const fresh = run({ gameModeId: 'xtreme' });
    const others = Object.entries(fresh.unlocks.levels)
      .filter(([skill]) => skill !== 'Attack')
      .reduce((total, [, level]) => total + level, 0);
    const milestone = Math.ceil((others + 3) / XTREME_MILESTONE_INTERVAL) * XTREME_MILESTONE_INTERVAL;
    const attack = milestone - 1 - others;
    const state = run({
      gameModeId: 'xtreme',
      xtremeMilestoneClaimed: milestone / XTREME_MILESTONE_INTERVAL - 1,
      unlocks: {
        regions: ['Asgarnia'],
        skills: { ...fresh.unlocks.skills, Attack: 10 },
        levels: { ...fresh.unlocks.levels, Attack: attack },
      },
    });

    const detected = accept(state, { kind: 'SKILL_LEVEL', skill: 'Attack', level: attack + 1 }, {
      source: `Attack Level ${attack + 1}`, threshold: 1, failureFate: failureFateForSkillLevel(attack + 1),
      target: `Attack Level ${attack + 1}`,
    }, fail);

    expect(detected.keys).toBe(state.keys);
    expect(detected.history.some(entry => entry.type === 'XTREME_MILESTONE')).toBe(false);
  });
});
