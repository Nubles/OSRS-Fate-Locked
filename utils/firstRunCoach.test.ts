import { describe, it, expect } from 'vitest';
import { coachStep, type CoachInput } from './firstRunCoach';
import type { GameState } from '../types';

type Entry = GameState['history'][number];
const entry = (type: Entry['type']): Entry => ({ type } as Entry);

const input = (types: Entry['type'][], revealAll = false): CoachInput => ({
  history: types.map(entry),
  revealAllFeatures: revealAll,
});

describe('coachStep', () => {
  it('fresh run → roll', () => {
    expect(coachStep(input([]), false)).toBe('roll');
  });

  it('one failed roll → spend', () => {
    expect(coachStep(input(['ROLL_FAIL']), false)).toBe('spend');
  });

  it('one successful roll → spend', () => {
    expect(coachStep(input(['ROLL_SUCCESS']), false)).toBe('spend');
  });

  it('first unlock → done', () => {
    expect(coachStep(input(['ROLL_FAIL', 'UNLOCK']), false)).toBe('done');
  });

  it('unlock with a trailing LEVEL_UP still → done', () => {
    expect(coachStep(input(['ROLL_SUCCESS', 'UNLOCK', 'LEVEL_UP']), false)).toBe('done');
  });

  it('mature run without unlock (history ≥ 3) → null', () => {
    expect(coachStep(input(['ROLL_FAIL', 'ROLL_FAIL', 'ROLL_SUCCESS']), false)).toBe(null);
  });

  it('imported mature run with unlocks (history > 4) → null', () => {
    expect(coachStep(input(['ROLL_SUCCESS', 'UNLOCK', 'ROLL_FAIL', 'UNLOCK', 'PITY']), false)).toBe(null);
  });

  it('done flag → null even on a fresh run', () => {
    expect(coachStep(input([]), true)).toBe(null);
  });

  it('revealAllFeatures → null', () => {
    expect(coachStep(input([], true), false)).toBe(null);
  });
});
