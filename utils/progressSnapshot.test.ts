import { describe, expect, it } from 'vitest';
import { initialState } from '../context/GameContext';
import { getGameMode } from '../config/gameModes';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import type { LogEntry, UnlockState } from '../types';
import { validProgressSnapshot } from '../workers/fate-relay/progress.js';
import { buildProgressSnapshot, encodeChunkMap, rulesTag } from './progressSnapshot';
import { ALL_CHUNKS } from './chunkAdjacency';
import { MAP_GRID, chunkMapBit, decodeChunkMap } from './chunkMapBits';

const run = (changes: Partial<UnlockState>): UnlockState => ({ ...structuredClone(initialState.unlocks), ...changes });

const entry = (id: string, type: LogEntry['type'], message: string, timestamp: number, meta?: Record<string, unknown>): LogEntry =>
  ({ id, type, message, timestamp, ...(meta ? { meta } : {}) });

describe('buildProgressSnapshot', () => {
  const firstQuest = Object.keys(QUEST_DATA)[0];
  const firstDiaryTask = ALL_DIARY_TASKS[0].id;
  const history = [
    entry('a', 'ROLL_SUCCESS', 'Rolled a key', 1000),
    ...Array.from({ length: 7 }, (_, index) =>
      entry(`u${index}`, 'UNLOCK', `Unlocked Area ${index}`, 2000 + index, { category: 'Regions' })),
    entry('b', 'UNLOCK', 'Unlocked Desert Battlefield', 3000, { category: 'Banks' }),
  ];

  const snapshot = buildProgressSnapshot({
    unlocks: run({ regions: ['Falador'], quests: [firstQuest], completedTasks: [firstDiaryTask, 'not-a-task'] }),
    history,
    gameModeId: 'vanilla',
    linkedAccount: '  Nubles ',
  });

  it('counts what the run card and journal count', () => {
    expect(snapshot).toMatchObject({
      v: 1,
      mode: 'Vanilla',
      modeId: 'vanilla',
      account: 'Nubles',
      startedAt: 1000,
      quests: { done: 1, total: Object.keys(QUEST_DATA).length },
      diaryTasks: { done: 1, total: ALL_DIARY_TASKS.length },
      ca: { points: 0, tier: null },
    });
    expect(snapshot.areas.unit).toBe('areas');
    expect(snapshot.areas.unlocked).toBeGreaterThan(0);
    expect(snapshot.rulesTag).toBeUndefined();
  });

  it('lists the five newest unlocks, newest first, with the table players see', () => {
    expect(snapshot.recent).toHaveLength(5);
    expect(snapshot.recent[0]).toEqual({ text: 'Unlocked Desert Battlefield (Banks)', at: 3000 });
    expect(snapshot.recent[1].text).toBe('Unlocked Area 6 (Areas)');
  });

  it('is what the relay accepts, unchanged', () => {
    expect(validProgressSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    const custom = buildProgressSnapshot({
      unlocks: run({}), history: [], gameModeId: 'custom',
      customMode: { ...getGameMode('vanilla').rules, pityThreshold: 10 },
    });
    expect(custom.rulesTag).toMatch(/^R-[0-9A-F]{6}$/);
    expect(validProgressSnapshot(JSON.parse(JSON.stringify(custom)))).toEqual(custom);
  });
});

describe('rulesTag', () => {
  it('is equal for equal rules, whatever their key order, and differs when a rule differs', () => {
    const vanilla = getGameMode('vanilla').rules;
    const reordered = Object.fromEntries(Object.entries(vanilla).reverse()) as typeof vanilla;
    expect(rulesTag('custom', reordered)).toBe(rulesTag('custom', vanilla));
    expect(rulesTag('custom', { ...vanilla, pityThreshold: vanilla.pityThreshold + 1 })).not.toBe(rulesTag('custom', vanilla));
  });
});

describe('the public Adventurer\'s Log fields', () => {
  const unlocks = run({ regions: ['Falador'] });

  it('stay out of a private summary', () => {
    const snapshot = buildProgressSnapshot({ unlocks, history: [], gameModeId: 'vanilla' });
    expect(snapshot).not.toHaveProperty('map');
    expect(snapshot).not.toHaveProperty('public');
  });

  it('map exactly the chunks a public summary counts, in an order the relay keeps', () => {
    const snapshot = buildProgressSnapshot({ unlocks, history: [], gameModeId: 'vanilla', publicLog: true });
    expect(snapshot.public).toBe(true);
    expect(snapshot.map).toHaveLength(272);
    expect(decodeChunkMap(snapshot.map!)!.size).toBe(snapshot.chunks.unlocked);
    // The relay stores its own field order; the stored text must equal this one so an unchanged publish writes nothing.
    expect(JSON.stringify(validProgressSnapshot(JSON.parse(JSON.stringify(snapshot))))).toBe(JSON.stringify(snapshot));
  });

  it('use a grid that holds every land chunk, bits row by row from the north-west corner', () => {
    for (const { cx, cy } of ALL_CHUNKS) expect(chunkMapBit(cx, cy)).toBeGreaterThanOrEqual(0);
    // Lumbridge's 50,50 is row 15, column 35.
    const one = Uint8Array.from(atob(encodeChunkMap((cx, cy) => cx === 50 && cy === 50)), char => char.charCodeAt(0));
    const bit = 15 * MAP_GRID.cols + 35;
    expect(one[bit >> 3]).toBe(1 << (bit & 7));
    expect(one.reduce((sum, byte) => sum + byte, 0)).toBe(1 << (bit & 7));
    expect([...decodeChunkMap(encodeChunkMap((cx, cy) => cx === 50 && cy === 50))!]).toEqual(['50,50']);
  });

  it('refuse a map that is not one', () => {
    expect(decodeChunkMap('A'.repeat(100))).toBeNull();
    expect(decodeChunkMap('!'.repeat(272))).toBeNull();
  });
});
