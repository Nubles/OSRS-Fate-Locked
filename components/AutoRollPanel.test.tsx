// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoRollPanel, fetchPlayer } from './AutoRollPanel';
import type { BackupWriteResult } from '../utils/gamePersistence';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(nextResolve => { resolve = nextResolve; });
  return { promise, resolve };
};

const game = vi.hoisted(() => ({
  unlocks: { levels: { Attack: 1 }, skills: { Attack: 1 } },
  createBackup: vi.fn(),
  levelUpSkill: vi.fn(),
  keys: 0,
  specialKeys: 0,
  chaosKeys: 0,
  linkedAccount: null,
  setLinkedAccount: vi.fn(),
}));

vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('./RollInbox', () => ({ RollInbox: () => null }));
vi.mock('./RuneLiteOnboarding', () => ({ RuneLiteOnboarding: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AutoRollPanel backup coordination', () => {
  it('locks Auto-Roll before waiting for its asynchronous backup', async () => {
    const backup = deferred<BackupWriteResult>();
    game.createBackup.mockReturnValueOnce(backup.promise);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        displayName: 'Alex',
        type: 'ironman',
        latestSnapshot: {
          data: {
            skills: {
              overall: { level: 25 },
              attack: { level: 2 },
            },
          },
        },
      }),
    })));

    render(<AutoRollPanel />);
    fireEvent.change(screen.getByPlaceholderText('OSRS username…'), {
      target: { value: 'Alex' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const autoRoll = screen.getByRole('button', { name: /Auto-roll 1 skill/ });
    fireEvent.click(autoRoll);
    expect(screen.queryByRole('button', { name: /Auto-roll 1 skill/ })).toBeNull();
    fireEvent.click(autoRoll);
    expect(game.createBackup).toHaveBeenCalledTimes(1);

    await act(async () => {
      backup.resolve({ stored: true });
      await backup.promise;
      await Promise.resolve();
    });
  });
});

describe('AutoRollPanel unmount', () => {
  it('stops a running skill sync when the panel unmounts', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
    try {
      game.levelUpSkill.mockClear();
      game.createBackup.mockResolvedValueOnce({ stored: true });
      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({
          displayName: 'Alex',
          type: 'ironman',
          latestSnapshot: { data: { skills: { attack: { level: 60 } } } },
        }),
      })));

      const { unmount } = render(<AutoRollPanel />);
      fireEvent.change(screen.getByPlaceholderText('OSRS username…'), { target: { value: 'Alex' } });
      fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Auto-roll 1 skill/ }));
        await Promise.resolve();
      });
      act(() => { vi.advanceTimersByTime(70); });
      const levelsBeforeUnmount = game.levelUpSkill.mock.calls.length;
      expect(levelsBeforeUnmount).toBeGreaterThan(0);
      expect(levelsBeforeUnmount).toBeLessThan(59);

      unmount();
      vi.advanceTimersByTime(10_000);

      expect(game.levelUpSkill).toHaveBeenCalledTimes(levelsBeforeUnmount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Auto-Roll current hiscores', () => {
  it('refreshes tracked users with POST and includes Sailing', async () => {
    const request = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => ({ displayName: 'Alex', latestSnapshot: { data: { skills: { attack: { level: init?.method === 'POST' ? 99 : 50 }, sailing: { level: 80 } } } } }) }));
    vi.stubGlobal('fetch', request);
    for (let i = 0; i < 2; i++) {
      const player = await fetchPlayer('Alex');
      expect(player.skills).toContainEqual({ skill: 'Sailing', level: 80 });
      expect(player.skills).toContainEqual({ skill: 'Attack', level: 99 });
    }
    expect(request.mock.calls.every(([, init]) => init?.method === 'POST')).toBe(true);
  });
  it('reports a failed refresh instead of silently returning a stale snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
    await expect(fetchPlayer('Alex')).rejects.toThrow('Rate-limited');
  });
});

describe('Auto-Roll account titles', () => {
  const hiscores = (type: string) => vi.fn(async () => ({
    ok: true,
    json: async () => ({
      displayName: 'Group Example',
      type,
      latestSnapshot: { data: { skills: { overall: { level: 664 }, attack: { level: 1 } } } },
    }),
  }));

  const fetchAs = async (type: string) => {
    vi.stubGlobal('fetch', hiscores(type));
    render(<AutoRollPanel />);
    fireEvent.change(screen.getByPlaceholderText('OSRS username…'), { target: { value: 'Group Example' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  const titleShown = () => document.querySelector('[data-account-title]')?.getAttribute('data-account-title');

  // An in-memory store: Node's own localStorage isn't usable in every environment the tests run in.
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    });
  });

  it("lets a group iron pick the title Wise Old Man can't see, and keeps it", async () => {
    await fetchAs('regular');
    expect(titleShown()).toBe('Regular');
    expect(screen.getByText(/Wise Old Man lists group irons as regular accounts/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hardcore Group Ironman' }));
    expect(titleShown()).toBe('Hardcore Group Ironman');
    expect(document.querySelector('[data-account-title] img')?.getAttribute('src'))
      .toContain('Hardcore_group_ironman_chat_badge.png');
    expect(screen.queryByText(/Wise Old Man lists group irons as regular accounts/)).toBeNull();

    // The next look at the same character keeps the title.
    cleanup();
    await fetchAs('regular');
    expect(titleShown()).toBe('Hardcore Group Ironman');

    // And the player can take it back.
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(titleShown()).toBe('Regular');
    expect(screen.getByRole('button', { name: 'Group Ironman' })).toBeTruthy();
  });

  it('shows a solo iron its title and badge from the hiscores, with no group choice', async () => {
    await fetchAs('ironman');
    expect(titleShown()).toBe('Ironman');
    expect(document.querySelector('[data-account-title] img')?.getAttribute('src')).toContain('Ironman_chat_badge.png');
    expect(screen.queryByRole('group', { name: 'Group ironman title' })).toBeNull();
  });
});
