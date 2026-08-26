// @vitest-environment jsdom

import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoRollPanel } from './AutoRollPanel';
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
