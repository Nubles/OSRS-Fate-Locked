// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../types';

const game = vi.hoisted(() => ({
  current: { keys: 0, fatePoints: 0, history: [] as LogEntry[], runId: 'run', gameModeId: 'vanilla' },
}));

vi.mock('../context/GameContext', () => ({ useGame: () => game.current }));
vi.mock('../services/relaySync', () => ({ relaySync: { subscribe: () => () => undefined } }));
vi.mock('../services/rollInboxRuntime', () => ({
  getRollInboxStore: () => ({ list: () => [], subscribe: () => () => undefined }),
}));

const rolled: LogEntry = {
  id: 'roll', timestamp: 1, type: 'ROLL_FAIL', message: 'No Key.', source: 'Attack Level 2', result: 'FAIL',
};

const hint = async (state: Partial<typeof game.current>): Promise<string> => {
  game.current = { ...game.current, ...state };
  const { CoachStrip } = await import('./CoachStrip');
  render(<CoachStrip />);
  return screen.getByRole('button', { name: 'Dismiss hint' }).parentElement?.textContent ?? '';
};

beforeEach(() => {
  game.current = { keys: 0, fatePoints: 0, history: [], runId: 'run', gameModeId: 'vanilla' };
  try { window.localStorage.clear(); } catch { /* storage may be unavailable */ }
});
afterEach(() => cleanup());

describe('CoachStrip hints', () => {
  it('offers the tour without promising how long it takes', async () => {
    const text = await hint({});
    expect(text).toContain('New here? Take the short tour to see where everything is.');
    expect(text).not.toMatch(/\d+-second/);
  });

  it('counts Keys in the tracker’s own words', async () => {
    expect(await hint({ keys: 3, history: [rolled] })).toContain('You have 3 Keys. Spend them to unlock something at random.');
  });

  it('names Fate Points and the Pity Key as the Rules page does', async () => {
    expect(await hint({ fatePoints: 45, history: [rolled] })).toContain('5 Fate Points from a guaranteed Pity Key.');
  });
});
