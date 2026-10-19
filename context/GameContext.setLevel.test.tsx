// @vitest-environment jsdom
/**
 * Set level (critique UX-14): typing a skill's new level logs every level in
 * between, each rolled exactly as a click on the skill rolls it. These tests
 * play the same run twice, once with N clicks and once with one Set level,
 * and require the same run at the end: same levels, Keys, Fate, buffs and the
 * same log, entry for entry. Only ids and timestamps may differ.
 */
import React from 'react';
import 'fake-indexeddb/auto';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider, createFreshState, useGame } from './GameContext';
import type { GameState } from '../types';
import { resetPendingSavesForTest } from '../utils/pendingSaves';
import { WRITER_LEASE_ARBITRATION_MS } from '../utils/profileWriterLease';
import { serializeCurrent } from '../utils/gamePersistence';
import type { LevelBatchSummary } from '../utils/setLevel';
import { formatLevelBatchSummary } from '../utils/setLevelText';

let current: ReturnType<typeof useGame>;
let renders = 0;
const Capture = () => { current = useGame(); renders += 1; return null; };
const settle = async () => {
  await act(async () => { await vi.advanceTimersByTimeAsync(WRITER_LEASE_ARBITRATION_MS + 1); });
  await act(async () => { await vi.advanceTimersByTimeAsync(550); });
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  resetPendingSavesForTest();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); resetPendingSavesForTest(); });

// Ids, timestamps and the tamper-evident hashes are made fresh on every play;
// everything else in the save must match.
const INCIDENTAL = new Set(['id', 'timestamp', 'hash', 'prevHash']);
const semantic = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(semantic);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !INCIDENTAL.has(k)).map(([k, v]) => [k, semantic(v)]));
  }
  return value;
};

/** A small fixed Math.random stream, for unseeded runs: same draws, same order, both plays. */
const fixedRandom = () => {
  let s = 12345;
  return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
};

// Both plays of a test are the same run, so its seeded draws match.
const RUN_ID = '6f1c2a4e-8b3d-4c5e-9a7f-1b2c3d4e5f60';

type Play = { save: unknown; summary: LevelBatchSummary | null; rendersForAction: number; lastEventType: string | null };

async function play(storageKey: string, start: Partial<GameState>, skill: string, target: number, how: 'clicks' | 'set'): Promise<Play> {
  vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
  vi.spyOn(Math, 'random').mockImplementation(fixedRandom());
  localStorage.setItem(storageKey, serializeCurrent({ ...createFreshState(), runId: RUN_ID, ...start }));
  render(<GameProvider storageKey={storageKey} leaseOptions={{ ownerId: storageKey }}><Capture /></GameProvider>);
  await settle();
  const from = current.unlocks.levels[skill] || 1;
  const rendersBefore = renders;
  let summary: LevelBatchSummary | null = null;
  if (how === 'clicks') {
    for (let level = from; level < target; level++) act(() => current.levelUpSkill(skill));
  } else {
    act(() => { summary = current.setSkillLevel(skill, target); });
  }
  const rendersForAction = renders - rendersBefore;
  const result: Play = {
    save: semantic(JSON.parse(current.getExportData())),
    summary,
    rendersForAction,
    lastEventType: current.lastEvent?.type ?? null,
  };
  cleanup();
  vi.mocked(Math.random).mockRestore();
  return result;
}

const vanilla = (extra: Partial<GameState> = {}): Partial<GameState> => {
  const fresh = createFreshState();
  return {
    rngSeed: 'FATE-2026-W42',
    rngVersion: 2,
    ...extra,
    unlocks: {
      ...fresh.unlocks,
      skills: { ...fresh.unlocks.skills, Attack: 3, Fishing: 10 },
      levels: { ...fresh.unlocks.levels, Attack: 18, Fishing: 1 },
      ...extra.unlocks,
    },
  };
};

describe('Set level rolls every level as the clicks would', () => {
  it('gives a seeded run the same run and log as 12 single clicks', async () => {
    const clicks = await play('set-level-clicks', vanilla(), 'Attack', 30, 'clicks');
    const set = await play('set-level-set', vanilla(), 'Attack', 30, 'set');

    expect(set.save).toEqual(clicks.save);
    const save = set.save as GameState;
    expect(save.unlocks.levels.Attack).toBe(30);
    // Every level was logged and rolled: a Key roll for each of the 12 (level 30's guaranteed Chaos Key too).
    expect(save.history.map(e => e.source).filter(Boolean))
      .toEqual(Array.from({ length: 12 }, (_, i) => `Attack Level ${19 + i}`));
    expect(save.chaosKeys).toBeGreaterThanOrEqual(1);
    // One summary, matching what the levels brought.
    const before = vanilla();
    const fresh = createFreshState();
    expect(set.summary).toMatchObject({
      skill: 'Attack', from: 18, to: 30, levels: 12,
      keys: save.keys - fresh.keys,
      chaosKeys: save.chaosKeys - fresh.chaosKeys,
      fate: save.history.reduce((sum, e) => sum + Number(e.meta?.fatePointsEarned ?? 0), 0),
      noRoll: 0,
    });
    expect(before.unlocks?.levels?.Attack).toBe(18);
    expect(formatLevelBatchSummary(set.summary!)).toMatch(/^12 levels logged: /);
    // One commit instead of one per level, and no per-level popup or animation event.
    expect(set.rendersForAction).toBeLessThan(clicks.rendersForAction / 4);
    expect(set.lastEventType).toBeNull();
  });

  it('matches 98 clicks from level 1 to 99, every Chaos milestone included', async () => {
    const clicks = await play('set-level-99-clicks', vanilla(), 'Fishing', 99, 'clicks');
    const set = await play('set-level-99-set', vanilla(), 'Fishing', 99, 'set');
    expect(set.save).toEqual(clicks.save);
    expect((set.save as GameState).unlocks.levels.Fishing).toBe(99);
    expect(set.summary?.levels).toBe(98);
  });

  it('matches the clicks with a buff waiting, which only the first roll spends', async () => {
    const start = vanilla({ activeBuff: 'GREED' } as Partial<GameState>);
    const clicks = await play('set-level-greed-clicks', start, 'Attack', 25, 'clicks');
    const set = await play('set-level-greed-set', start, 'Attack', 25, 'set');
    expect(set.save).toEqual(clicks.save);
  });

  it('matches the clicks on an unseeded run drawing the same random numbers', async () => {
    const start = { ...vanilla(), rngSeed: undefined, rngVersion: undefined };
    const clicks = await play('set-level-unseeded-clicks', start, 'Attack', 30, 'clicks');
    const set = await play('set-level-unseeded-set', start, 'Attack', 30, 'set');
    expect(set.save).toEqual(clicks.save);
  });

  it('logs Chunked levels past the tier cap with no roll, as the clicks do', async () => {
    const fresh = createFreshState();
    const start: Partial<GameState> = {
      gameModeId: 'chunked',
      rngSeed: 'FATE-2026-W42',
      rngVersion: 2,
      unlocks: {
        ...fresh.unlocks,
        skills: { ...fresh.unlocks.skills, Woodcutting: 2 },
        levels: { ...fresh.unlocks.levels, Woodcutting: 15 },
      },
    };
    const clicks = await play('set-level-chunked-clicks', start, 'Woodcutting', 27, 'clicks');
    const set = await play('set-level-chunked-set', start, 'Woodcutting', 27, 'set');
    expect(set.save).toEqual(clicks.save);
    // Levels 21-27 are past tier 2's cap of 20.
    expect(set.summary).toMatchObject({ levels: 12, noRoll: 7 });
    expect(formatLevelBatchSummary(set.summary!)).toContain('7 past the tier cap with no roll');
  });

  it('pays the Xtreme start insurance on the same levels as the clicks', async () => {
    const fresh = createFreshState();
    const start: Partial<GameState> = {
      gameModeId: 'xtreme',
      rngSeed: 'FATE-2026-W42',
      rngVersion: 2,
      unlocks: { ...fresh.unlocks, regions: [], skills: { ...fresh.unlocks.skills, Mining: 10 }, levels: { ...fresh.unlocks.levels, Mining: 1 } },
    };
    const clicks = await play('set-level-xtreme-clicks', start, 'Mining', 80, 'clicks');
    const set = await play('set-level-xtreme-set', start, 'Mining', 80, 'set');
    expect(set.save).toEqual(clicks.save);
  });
});

describe('Set level keeps the click rules', () => {
  it('refuses a lower, equal, above-99 or locked-skill level and changes nothing', async () => {
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    localStorage.setItem('set-level-refuse', serializeCurrent({ ...createFreshState(), runId: RUN_ID, ...vanilla() }));
    render(<GameProvider storageKey="set-level-refuse" leaseOptions={{ ownerId: 'set-level-refuse' }}><Capture /></GameProvider>);
    await settle();
    const before = current.getExportData();
    for (const [skill, level] of [['Attack', 10], ['Attack', 18], ['Attack', 100], ['Attack', 25.5], ['Magic', 20]] as const) {
      let summary: LevelBatchSummary | null | undefined;
      act(() => { summary = current.setSkillLevel(skill, level); });
      expect(summary).toBeNull();
    }
    expect(current.getExportData()).toBe(before);
  });
});
