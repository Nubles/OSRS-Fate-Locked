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
  linkedAccount: null as string | null,
  syncBaseline: undefined as { account: string; levels?: Record<string, number | null> } | undefined,
  setLinkedAccount: vi.fn(),
  renameLinkedAccount: vi.fn(),
  recordSyncBaseline: vi.fn(),
  catchUpSyncLevel: vi.fn((_skill: string, _level: number) => true),
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

describe('Auto-Roll name change', () => {
  afterEach(() => { game.linkedAccount = null; });

  it('lets the player change the name a linked run uses, and pulls the new hiscores', async () => {
    game.linkedAccount = 'Old Name';
    game.renameLinkedAccount.mockClear();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ code: 'HISCORES_USERNAME_NOT_FOUND' }) })));

    render(<AutoRollPanel />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // The old name is gone from the hiscores: the error points at the fix.
    expect(screen.getByText(/If you changed your OSRS name/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change name' }));
    fireEvent.change(screen.getByLabelText('New OSRS name'), { target: { value: ' New  Name ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(game.renameLinkedAccount).toHaveBeenCalledWith('Old Name', 'New Name');
    expect(screen.getByRole('status').textContent).toContain('This run now uses New Name');
  });

  it("turns away a name that can't exist in game", () => {
    game.linkedAccount = 'Old Name';
    game.renameLinkedAccount.mockClear();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));

    render(<AutoRollPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Change name' }));
    fireEvent.change(screen.getByLabelText('New OSRS name'), { target: { value: 'bad!name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(game.renameLinkedAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('as it shows in game');
  });
});

// Critique GP-1 (October 2026): levels the account had when the run linked it
// never roll, and nothing rolls past a skill's tier band.
describe('Auto-Roll baseline', () => {
  const hiscores = (skills: Record<string, unknown>) => vi.fn(async () => ({
    ok: true,
    json: async () => ({ displayName: 'Levelled', type: 'ironman', latestSnapshot: { data: { skills } } }),
  }));
  const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
  beforeEach(() => { game.recordSyncBaseline.mockClear(); });
  afterEach(() => {
    game.linkedAccount = null;
    game.syncBaseline = undefined;
    game.unlocks = { levels: { Attack: 1 }, skills: { Attack: 1 } };
    game.recordSyncBaseline.mockClear();
    game.catchUpSyncLevel.mockClear();
    game.levelUpSkill.mockClear();
  });

  it('takes the first fetch as the baseline and says so once', async () => {
    vi.stubGlobal('fetch', hiscores({ attack: { rank: 10, level: 99, experience: 13_034_431 }, hunter: { rank: -1, level: 1, experience: -1 } }));
    render(<AutoRollPanel />);
    fireEvent.change(screen.getByPlaceholderText('OSRS username…'), { target: { value: 'Levelled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch' }));
    await settle();

    expect(game.setLinkedAccount).toHaveBeenLastCalledWith('Levelled');
    expect(game.recordSyncBaseline).toHaveBeenCalledTimes(1);
    const [account, levels] = game.recordSyncBaseline.mock.calls[0];
    expect(account).toBe('Levelled');
    expect(levels.Attack).toBe(99);
    // Unranked with no overall rank (a new account): its minimum. Missing: unknown.
    expect(levels.Hunter).toBe(1);
    expect(levels.Sailing).toBeNull();
    expect(screen.getByTestId('sync-baseline-note').textContent).toContain("Levels this account already has don't roll");
  });

  it('rolls nothing the account had when linked', async () => {
    game.linkedAccount = 'Levelled';
    game.syncBaseline = { account: 'Levelled', levels: { Attack: 99 } };
    game.unlocks = { levels: { Attack: 1 }, skills: { Attack: 10 } };
    vi.stubGlobal('fetch', hiscores({ attack: { rank: 10, level: 99, experience: 13_034_431 } }));
    render(<AutoRollPanel />);
    await settle();

    expect(screen.queryByRole('button', { name: /Auto-roll/ })).toBeNull();
    expect(screen.getByText(/Levels your account had when this run was linked don't roll/)).toBeTruthy();
    expect(screen.queryByTestId('sync-baseline-note')).toBeNull();
    expect(document.querySelector('[data-sync-hold="linked"]')?.getAttribute('title')).toContain('already had this level');
  });

  it('records the baseline without a roll, then rolls only the new levels', async () => {
    vi.useFakeTimers();
    try {
      game.linkedAccount = 'Levelled';
      game.syncBaseline = { account: 'Levelled', levels: { Attack: 40 } };
      game.unlocks = { levels: { Attack: 1 }, skills: { Attack: 5 } };
      game.createBackup.mockResolvedValue({ stored: true });
      vi.stubGlobal('fetch', hiscores({ attack: { rank: 10, level: 60, experience: 300_000 } }));
      render(<AutoRollPanel />);
      await settle();

      // 41 to 60 roll, past the tier band as the manual button allows.
      fireEvent.click(screen.getByRole('button', { name: 'Auto-roll 1 skill (+20)' }));
      await act(async () => { await Promise.resolve(); });
      act(() => { vi.advanceTimersByTime(5_000); });

      expect(game.catchUpSyncLevel).toHaveBeenCalledWith('Attack', 40);
      expect(game.levelUpSkill).toHaveBeenCalledTimes(20);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rolls nothing for a skill whose baseline the run refuses to record", async () => {
    vi.useFakeTimers();
    try {
      game.linkedAccount = 'Levelled';
      game.syncBaseline = { account: 'Levelled', levels: { Attack: 40 } };
      game.unlocks = { levels: { Attack: 1 }, skills: { Attack: 5 } };
      game.createBackup.mockResolvedValue({ stored: true });
      game.catchUpSyncLevel.mockReturnValueOnce(false);
      vi.stubGlobal('fetch', hiscores({ attack: { rank: 10, level: 45, experience: 61_512 } }));
      render(<AutoRollPanel />);
      await settle();

      fireEvent.click(screen.getByRole('button', { name: 'Auto-roll 1 skill (+5)' }));
      await act(async () => { await Promise.resolve(); });
      act(() => { vi.advanceTimersByTime(1_000); });

      expect(game.catchUpSyncLevel).toHaveBeenCalledTimes(1);
      expect(game.levelUpSkill).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
