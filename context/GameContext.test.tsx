import { describe, expect, it } from 'vitest';
import {
  gameReducerForTest,
  migrateSaveForTest,
  newRunIdForTest,
} from './GameContext';

describe('run identity and revision', () => {
  it('assigns a stable run id to an old save', () => {
    const first = migrateSaveForTest({ version: 1, history: [] });
    const second = migrateSaveForTest(first);

    expect(first.runId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.runRevision).toBe(0);
    expect(second.runId).toBe(first.runId);
  });

  it('increments revision for a persistent mutation but not a no-op', () => {
    const start = {
      ...migrateSaveForTest({ version: 1, history: [] }),
      runRevision: 7,
      lastEvent: null,
    };
    const changed = gameReducerForTest(start, {
      type: 'SET_LINKED_ACCOUNT',
      payload: 'Nubles',
    });
    expect(changed.runRevision).toBe(8);

    const noOp = gameReducerForTest(changed, {
      type: 'SET_LINKED_ACCOUNT',
      payload: 'Other',
    });
    expect(noOp).toBe(changed);
    expect(noOp.runRevision).toBe(8);
  });

  it('creates an RFC 4122 id through the random-byte fallback', () => {
    const id = newRunIdForTest({
      getRandomValues(bytes: Uint8Array) {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });

    expect(id).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
  });
});
describe('detected progress reconciliation', () => {
  const start = () => ({
    ...migrateSaveForTest({ version: 1, history: [] }),
    runRevision: 0,
    lastEvent: null,
  });

  it('reconciles a quest without producing a roll history entry', () => {
    const next = gameReducerForTest(start(), {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'QUEST', questId: 'Dragon Slayer I' },
    });

    expect(next.unlocks.quests).toContain('Dragon Slayer I');
    expect(next.history).toHaveLength(0);
  });

  it('uses max/set semantics and makes replay a no-op', () => {
    const skill = gameReducerForTest(start(), {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'SKILL_LEVEL', skill: 'Attack', level: 73 },
    });
    expect(skill.unlocks.levels.Attack).toBe(73);

    const replay = gameReducerForTest(skill, {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'SKILL_LEVEL', skill: 'Attack', level: 72 },
    });
    expect(replay).toBe(skill);

    const task = gameReducerForTest(replay, {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'CA_TASK', taskId: 'ca_0' },
    });
    expect(task.unlocks.completedTasks).toContain('ca_0');

    const item = gameReducerForTest(task, {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'COLLECTION_ITEM', itemId: 101001 },
    });
    expect(item.unlocks.collectionLog[101001]).toBe(1);
    expect(item.history).toHaveLength(0);
  });

  it('records detector metadata only on the invoked roll', () => {
    const next = gameReducerForTest(start(), {
      type: 'ROLL_RESULT',
      payload: {
        success: false,
        omni: false,
        pity: false,
        roll: 99,
        threshold: 75,
        source: 'Quest (Experienced)',
        meta: {
          fateEventId: 'evt-1',
          detectorId: 'quest-widget-v1',
          detectorVersion: 1,
        },
      },
    });

    expect(next.history.at(-1)?.meta).toMatchObject({
      fateEventId: 'evt-1',
      detectorId: 'quest-widget-v1',
      detectorVersion: 1,
    });
  });
});