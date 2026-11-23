import { describe, expect, it } from 'vitest';
import { createFreshState, gameReducerForTest as reduce, stepLevelUp } from '../context/GameContext';
import type { GameState, LogEntry } from '../types';
import { runStats } from './achievements';
import { lastSession, WELCOME_BACK_AFTER_MS } from './welcomeBack';

/**
 * A level-up's Key roll carries a copy of its LEVEL_UP entry's meta, Chaos Key
 * award included, so one Chaos Key sat on two history entries and the Chaos
 * Keys achievements and the welcome-back summary counted it twice. Only a level
 * RuneLite detected (no LEVEL_UP entry) puts the award on the roll itself, as
 * utils/runAudit.ts already counts it. Saved histories keep the copy, so the
 * counters are what read it correctly.
 */
const levelUp = (modeId: 'vanilla' | 'chunked', skill: string) => {
  let s = { ...createFreshState(), lastEvent: null } as GameState;
  s = reduce(s, { type: 'SET_GAME_MODE', payload: { modeId } });
  s = { ...s, unlocks: { ...s.unlocks, skills: { ...s.unlocks.skills, [skill]: 10 }, levels: { ...s.unlocks.levels, [skill]: 29 } } };
  const before = s;
  // 0.9 misses every Key roll and the 2% luck draw.
  stepLevelUp(() => s, skill, () => 0.9, () => 1000, action => { s = reduce(s, action); return s; });
  return { added: s.history.slice(before.history.length), earned: s.chaosKeys - before.chaosKeys, after: s };
};

const away = (history: readonly LogEntry[]) => history[history.length - 1].timestamp + WELCOME_BACK_AFTER_MS + 1;

describe('Chaos Keys counted from history', () => {
  it.each(['vanilla', 'chunked'] as const)('counts a %s level-up Chaos Key once', modeId => {
    const skill = modeId === 'chunked' ? 'Mining' : 'Attack';
    const { added, earned, after } = levelUp(modeId, skill);
    expect(earned).toBe(1);
    // The saved shape: both entries carry the award.
    expect(added.filter(e => e.meta?.chaosKeysAwarded === 1).map(e => e.type)).toEqual(
      expect.arrayContaining(['LEVEL_UP']),
    );
    expect(runStats(added).chaosKeys).toBe(1);
    expect(lastSession(after.history, away(after.history))?.chaosKeys).toBe(1);
  });

  it('counts an old-shaped history with the copied award once', () => {
    const t = 1_000_000;
    const history: LogEntry[] = [
      { id: 'a', timestamp: t, type: 'LEVEL_UP', message: 'Attack level 30', meta: { skill: 'Attack', level: 30, totalLevel: 50, chaosKeysAwarded: 1, chaosKeyAwarded: true } },
      { id: 'b', timestamp: t + 1, type: 'ROLL_FAIL', message: 'No Key.', meta: { skill: 'Attack', level: 30, totalLevel: 50, chaosKeysAwarded: 1, chaosKeyAwarded: true } },
    ];
    expect(runStats(history).chaosKeys).toBe(1);
    expect(lastSession(history, away(history))?.chaosKeys).toBe(1);
  });

  it('still counts a RuneLite-detected level, Fate site, ritual and achievement award', () => {
    const t = 1_000_000;
    const history: LogEntry[] = [
      { id: 'a', timestamp: t, type: 'ROLL_FAIL', message: 'No Key.', meta: { detectorId: 'skill-level-v1', chaosKeysAwarded: 2 } },
      { id: 'b', timestamp: t + 1, type: 'FATE', message: 'Hoard', meta: { chaosKeysAwarded: 1 } },
      { id: 'c', timestamp: t + 2, type: 'ALTAR', message: 'Ritual of Chaos', meta: { ritual: 'CHAOS', chaosKeysAwarded: 1 } },
      { id: 'd', timestamp: t + 3, type: 'ACHIEVEMENT', message: 'Claimed', meta: { chaosKeysAwarded: 1 } },
    ];
    expect(runStats(history).chaosKeys).toBe(5);
    expect(lastSession(history, away(history))?.chaosKeys).toBe(5);
  });
});
