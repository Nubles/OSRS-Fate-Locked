// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GameProvider,
  gameReducerForTest,
  prepareDetectedEventAcceptanceAction,
  migrateSaveForTest,
  newRunIdForTest,
  useGame,
} from './GameContext';


type Game = ReturnType<typeof useGame>;

const GameCapture = ({ onGame }: { onGame: (game: Game) => void }) => {
  onGame(useGame());
  return null;
};

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('run identity and revision', () => {
  it('assigns a stable run id to an old save', () => {
    const first = migrateSaveForTest({ history: [] });
    const second = migrateSaveForTest(first);

    expect(first.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(first.runRevision).toBe(0);
    expect(second.runId).toBe(first.runId);
  });

  it('increments revision for a persistent mutation but not a no-op', () => {
    const start = {
      ...migrateSaveForTest({ history: [] }),
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

describe('quest completion integration', () => {
  const keyRollHistory = (game: Game) => game.history.filter(entry =>
    ['ROLL_SUCCESS', 'ROLL_FAIL', 'ROLL_OMNI', 'PITY'].includes(entry.type),
  );

  const completionSnapshot = (game: Game) => ({
    quests: [...game.unlocks.quests],
    keys: game.keys,
    specialKeys: game.specialKeys,
    chaosKeys: game.chaosKeys,
    fatePoints: game.fatePoints,
    activeBuff: game.activeBuff,
    equipment: { ...game.unlocks.equipment },
    collectionLog: { ...game.unlocks.collectionLog },
    keyRollHistory: structuredClone(keyRollHistory(game)),
    hasInventory: Object.prototype.hasOwnProperty.call(game.unlocks, 'inventory'),
    hasItems: Object.prototype.hasOwnProperty.call(game.unlocks, 'items'),
  });

  const renderStoredGame = (storageKey: string, save: unknown) => {
    localStorage.setItem(storageKey, JSON.stringify(save));
    let current: Game | undefined;
    render(
      <GameProvider storageKey={storageKey}>
        <GameCapture onGame={next => { current = next; }} />
      </GameProvider>,
    );
    return () => {
      if (!current) throw new Error('Game provider did not initialize');
      return current;
    };
  };

  it("does not complete or roll for Witch's Potion with only Asgarnia", () => {
    const current = renderStoredGame('blocked-witch-completion', {
      unlocks: { regions: ['Asgarnia'] },
    });
    const before = completionSnapshot(current());
    let result: ReturnType<Game['completeQuest']> | undefined;

    act(() => {
      result = current().completeQuest(
        "Witch's Potion",
        undefined,
        undefined,
        { manualConfirmed: true },
      );
    });

    expect(result).toEqual({ ok: false, reason: 'Requires: Rimmington' });
    expect(completionSnapshot(current())).toEqual(before);
    expect(current().unlocks.quests).not.toContain("Witch's Potion");
    expect(keyRollHistory(current())).toEqual([]);
  });

  it('completes a valid quest with exactly one roll and makes its repeat a no-op', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const current = renderStoredGame('valid-quest-completion', {
      unlocks: { regions: ['Asgarnia', 'Rimmington'] },
    });
    const before = completionSnapshot(current());
    let first: ReturnType<Game['completeQuest']> | undefined;

    act(() => { first = current().completeQuest("Witch's Potion"); });

    const afterFirst = completionSnapshot(current());
    expect(first).toEqual({ ok: true });
    expect(afterFirst.quests.filter(id => id === "Witch's Potion")).toEqual([
      "Witch's Potion",
    ]);
    expect(afterFirst).toMatchObject({
      keys: before.keys,
      specialKeys: before.specialKeys,
      chaosKeys: before.chaosKeys,
      fatePoints: before.fatePoints + 1,
      activeBuff: before.activeBuff,
      equipment: before.equipment,
      collectionLog: before.collectionLog,
      hasInventory: false,
      hasItems: false,
    });
    expect(afterFirst.keyRollHistory).toHaveLength(before.keyRollHistory.length + 1);
    expect(afterFirst.keyRollHistory.at(-1)).toMatchObject({
      type: 'ROLL_FAIL',
      source: 'Quest (Novice)',
      result: 'FAIL',
      rollValue: 100,
    });

    let repeated: ReturnType<Game['completeQuest']> | undefined;
    act(() => { repeated = current().completeQuest("Witch's Potion"); });

    expect(repeated).toEqual({ ok: false, reason: 'Already completed' });
    expect(completionSnapshot(current())).toEqual(afterFirst);
  });

  it('completes a valid miniquest with exactly one roll and makes its repeat a no-op', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const current = renderStoredGame('valid-miniquest-completion', {
      unlocks: { regions: ['Kourend & Kebos'] },
    });
    const before = completionSnapshot(current());
    let first: ReturnType<Game['completeQuest']> | undefined;

    act(() => { first = current().completeQuest('In Search of Knowledge'); });

    const afterFirst = completionSnapshot(current());
    expect(first).toEqual({ ok: true });
    expect(afterFirst.quests.filter(id => id === 'In Search of Knowledge')).toEqual([
      'In Search of Knowledge',
    ]);
    expect(afterFirst).toMatchObject({
      keys: before.keys,
      specialKeys: before.specialKeys,
      chaosKeys: before.chaosKeys,
      fatePoints: before.fatePoints + 1,
      activeBuff: before.activeBuff,
      equipment: before.equipment,
      collectionLog: before.collectionLog,
      hasInventory: false,
      hasItems: false,
    });
    expect(afterFirst.keyRollHistory).toHaveLength(before.keyRollHistory.length + 1);
    expect(afterFirst.keyRollHistory.at(-1)).toMatchObject({
      type: 'ROLL_FAIL',
      source: 'Quest (Experienced)',
      result: 'FAIL',
      rollValue: 100,
    });

    let repeated: ReturnType<Game['completeQuest']> | undefined;
    act(() => { repeated = current().completeQuest('In Search of Knowledge'); });

    expect(repeated).toEqual({ ok: false, reason: 'Already completed' });
    expect(completionSnapshot(current())).toEqual(afterFirst);
  });
});

describe('detected progress reconciliation', () => {
  const start = () => ({
    ...migrateSaveForTest({ history: [] }),
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
        baseThreshold: 75,
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

  it('accepts detected progress and its prepared roll in one revision', () => {
    const initial = { ...start(), runId: 'run-1', runRevision: 11, linkedAccount: 'Nubles' };
    const action = prepareDetectedEventAcceptanceAction(
      initial,
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      { source: 'Quest (Experienced)', threshold: 75, target: 'Dragon Slayer I' },
      () => 999,
      { fateEventId: 'evt-atomic', detectorId: 'quest-widget-v1', detectorVersion: 1 },
      { runId: 'run-1', account: 'Nubles', runRevision: 11 },
    );
    const next = gameReducerForTest(initial, action);

    expect(next.runRevision).toBe(12);
    expect(next.unlocks.quests).toContain('Dragon Slayer I');
    expect(next.history).toHaveLength(1);
    expect(next.history[0].meta?.fateEventId).toBe('evt-atomic');
  });

  it('cannot partially reconcile when roll preparation fails', () => {
    const initial = start();

    expect(() => prepareDetectedEventAcceptanceAction(
      initial,
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      { source: 'Quest (Experienced)', threshold: 75, target: 'Dragon Slayer I' },
      () => { throw new Error('rng unavailable'); },
      { fateEventId: 'evt-failed' },
      { runId: initial.runId, account: 'Nubles', runRevision: 0 },
    )).toThrow('rng unavailable');
    expect(initial.runRevision).toBe(0);
    expect(initial.unlocks.quests).not.toContain('Dragon Slayer I');
    expect(initial.history).toHaveLength(0);
  });

  it.each([
    ['run id', { runId: 'run-2' }],
    ['account', { linkedAccount: 'Other' }],
    ['revision', { runRevision: 12 }],
  ] as const)('authoritatively rejects acceptance after the live %s changes', (_field, override) => {
    const original = {
      ...start(),
      runId: 'run-1',
      runRevision: 11,
      linkedAccount: 'Nubles',
    };
    const action = prepareDetectedEventAcceptanceAction(
      original,
      { kind: 'QUEST', questId: 'Dragon Slayer I' },
      { source: 'Quest (Experienced)', threshold: 75, target: 'Dragon Slayer I' },
      () => 999,
      { fateEventId: 'evt-stale' },
      { runId: 'run-1', account: 'Nubles', runRevision: 11 },
    );
    const current = { ...original, ...override };

    const next = gameReducerForTest(current, action);

    expect(next).toBe(current);
    expect(next.unlocks.quests).not.toContain('Dragon Slayer I');
    expect(next.history).toHaveLength(0);
  });

  it('reconciles diary task IDs as completed tasks, not completed tiers', () => {
    const next = gameReducerForTest(start(), {
      type: 'SYNC_DETECTED_PROGRESS',
      payload: { kind: 'DIARY_TASK', taskId: 'Ardougne Easy:0' },
    });

    expect(next.unlocks.completedTasks).toContain('Ardougne Easy:0');
    expect(next.unlocks.diaries).not.toContain('Ardougne Easy:0');
  });
});
