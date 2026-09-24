/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';

const game = vi.hoisted(() => ({ unlocks: undefined as UnlockState | undefined }));

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return {
    ...actual,
    useGame: () => ({
      ...actual.initialState,
      unlocks: game.unlocks ?? actual.initialState.unlocks,
      animationsEnabled: false,
      gameModeId: 'vanilla',
      customMode: undefined,
      levelUpSkill: vi.fn(),
      unlockContent: vi.fn(),
      toggleAnimations: vi.fn(),
      toggleAdvisors: vi.fn(),
      toggleRevealAll: vi.fn(),
      completeOnboarding: vi.fn(),
      saveNote: vi.fn(),
    }),
  };
});

vi.mock('../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(async () => null) },
}));

import { initialState } from '../context/GameContext';
import { Dashboard } from './Dashboard';

// A first quest earns "First Steps"; a first equipment slot earns "Geared Up".
const progress = (quests: string[], equipment: Record<string, number> = {}): UnlockState => ({
  ...initialState.unlocks,
  quests,
  equipment: { ...initialState.unlocks.equipment, ...equipment },
});

let hosts: HTMLElement[] = [];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  // The app shell owns the reveal portal hosts.
  hosts = ['reveal-top', 'reveal-bottom'].map((id) => {
    const host = document.createElement('div');
    host.id = id;
    document.body.appendChild(host);
    return host;
  });
  game.unlocks = initialState.unlocks;
});

afterEach(() => {
  cleanup();
  hosts.forEach((host) => host.remove());
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const unlockReveal = () => document.getElementById('reveal-bottom')!.textContent ?? '';
const achievementReveal = () => document.getElementById('reveal-top')!.textContent ?? '';
const panelCount = (id: string) => document.getElementById(id)!.children.length;

describe('Dashboard reveal panels', () => {
  it('gives a reveal that replaces one on screen its own full timer', () => {
    const view = render(<Dashboard />);
    const unlock = (next: UnlockState) => act(() => {
      game.unlocks = next;
      view.rerender(<Dashboard />);
    });

    unlock(progress(["Cook's Assistant"]));
    advance(20);
    expect(unlockReveal()).toContain("Cook's Assistant");
    expect(achievementReveal()).toContain('First Steps');

    advance(6_700);
    unlock(progress(["Cook's Assistant", 'Sheep Shearer'], { Head: 1 }));
    advance(20);
    expect(unlockReveal()).toContain('Sheep Shearer');
    expect(achievementReveal()).toContain('Geared Up');
    // Each replaces the panel on screen rather than stacking beside it.
    expect(panelCount('reveal-bottom')).toBe(1);
    expect(panelCount('reveal-top')).toBe(1);

    // Past the first reveals' 8 s / 9 s timers and their 280 ms slide-out.
    advance(2_600);
    expect(unlockReveal()).toContain('Sheep Shearer');
    expect(achievementReveal()).toContain('Geared Up');

    // The replacements still auto-dismiss on their own schedule.
    advance(9_000);
    expect(unlockReveal()).toBe('');
    expect(achievementReveal()).toBe('');
  }, 15_000);

  it('does not let a reveal sliding out dismiss the one replacing it', () => {
    const view = render(<Dashboard />);
    const unlock = (next: UnlockState) => act(() => {
      game.unlocks = next;
      view.rerender(<Dashboard />);
    });

    unlock(progress(["Cook's Assistant"]));
    // The achievement reveal auto-dismisses at 8 s, then slides out for 280 ms.
    advance(8_100);
    unlock(progress(["Cook's Assistant"], { Head: 1 }));
    // The unlock reveal auto-dismisses at 9 s, then slides out for 280 ms.
    advance(1_000);
    unlock(progress(["Cook's Assistant", 'Sheep Shearer'], { Head: 1 }));

    advance(1_000);
    expect(achievementReveal()).toContain('Geared Up');
    expect(unlockReveal()).toContain('Sheep Shearer');
  }, 15_000);
});
