/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../types';

const game = vi.hoisted(() => ({
  history: [] as LogEntry[],
  stateReplacements: 0,
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => game,
}));

vi.mock('../context/ProfileContext', () => ({
  useProfiles: () => ({ storageKeyForActiveProfile: 'profile-key' }),
}));

import { DiscordSyncDriver } from './DiscordSyncDriver';
import { writeDiscordConfig } from '../utils/discordWebhook';

const WEBHOOK = 'https://discord.com/api/webhooks/123/token';
const fetchMock = vi.fn(async () => ({ ok: true, status: 204 }));

const unlock = (id: string, timestamp: number): LogEntry => ({
  id,
  timestamp,
  type: 'UNLOCK',
  message: `Unlocked ${id}`,
  meta: { item: id, category: 'Bosses', cost: 1, costType: 'key' },
});

const postedTitles = (): string[] => fetchMock.mock.calls.flatMap((call) => {
  const init = (call as unknown as [string, RequestInit])[1];
  return (JSON.parse(String(init.body)).embeds as { title: string }[]).map((embed) => embed.title);
});

/** Re-render with new game state and let the webhook POSTs settle. */
const update = async (
  rerender: (ui: React.ReactElement) => void,
  history: LogEntry[],
  stateReplacements = game.stateReplacements,
) => {
  game.history = history;
  game.stateReplacements = stateReplacements;
  await act(async () => {
    rerender(<DiscordSyncDriver />);
  });
};

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  game.history = [];
  game.stateReplacements = 0;
  writeDiscordConfig('profile-key', { url: WEBHOOK, enabled: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DiscordSyncDriver', () => {
  it('does not re-announce unlocks that arrive with an imported save', async () => {
    const T = Date.UTC(2026, 8, 1);
    const played = [unlock('here-1', T), unlock('here-2', T + 1_000)];
    game.history = played;
    const { rerender } = render(<DiscordSyncDriver />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();

    // The same run, played further on another device that already announced
    // these 25 unlocks, then imported here.
    const imported = [
      ...played,
      ...Array.from({ length: 25 }, (_, i) => unlock(`elsewhere-${i}`, T + 10_000 + i)),
    ];
    await update(rerender, imported, game.stateReplacements + 1);
    expect(fetchMock).not.toHaveBeenCalled();

    await update(rerender, [...imported, unlock('after-import', T + 60_000)]);
    expect(postedTitles()).toEqual(['🔓 Unlocked after-import']);
  });

  it('keeps announcing after an entry stamped by a fast clock', async () => {
    const now = Date.UTC(2026, 8, 24);
    const fromFastClock = unlock('fast-clock', now + 365 * 24 * 60 * 60 * 1000);
    game.history = [fromFastClock];
    const { rerender } = render(<DiscordSyncDriver />);
    await act(async () => {});

    await update(rerender, [fromFastClock, unlock('on-time', now)]);
    expect(postedTitles()).toEqual(['🔓 Unlocked on-time']);
  });

  it('announces each new unlock exactly once', async () => {
    const T = Date.UTC(2026, 8, 2);
    const first = [unlock('seeded', T)];
    game.history = first;
    const { rerender } = render(<DiscordSyncDriver />);
    await act(async () => {});

    const second = [...first, unlock('new-1', T + 1), { ...unlock('roll', T + 2), type: 'ROLL_SUCCESS' as const }];
    await update(rerender, second);
    await update(rerender, [...second]);
    await update(rerender, [...second, unlock('new-2', T + 3)]);

    expect(postedTitles()).toEqual(['🔓 Unlocked new-1', '🔓 Unlocked new-2']);
  });
});
