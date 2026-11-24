/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  service: {
    ready: true,
    error: null as string | null,
    subscribe: vi.fn(() => () => {}),
    init: vi.fn(async () => true),
    shortcuts: vi.fn(() => [
      { name: 'Mith grapple', skill: 'Agility', level: 10, objects: ['Mith grapple'], chunks: [] },
      { name: 'Mith grapple', skill: 'Ranged', level: 20, objects: ['Mith grapple'], chunks: [] },
      { name: 'Mith grapple', skill: 'Strength', level: 30, objects: ['Mith grapple'], chunks: [] },
    ]),
    entityLocations: vi.fn((name: string) => ({
      name,
      kind: 'object',
      locations: [{ cx: 1, cy: 1 }],
    })),
    interiorEntranceChunks: vi.fn(() => []),
  },
  game: {
    unlocks: {
      equipment: {},
      skills: {},
      levels: {},
      regions: [],
      mobility: [],
      arcana: [],
      housing: [],
      merchants: [],
      minigames: [],
      bosses: [],
      storage: [],
      guilds: [],
      farming: [],
      slayerUnlocks: [],
      quests: [],
      diaries: [],
      cas: [],
      completedTasks: [],
      collectionLog: {},
    },
    gameModeId: 'standard',
  },
}));

vi.mock('../services/ChunkContentService', () => ({ chunkContentService: mocks.service }));
vi.mock('../context/GameContext', () => ({ useGame: () => mocks.game }));

import { ShortcutsPanel } from './ShortcutsPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShortcutsPanel after a failed chunk-content load', () => {
  it('offers Retry instead of disappearing', () => {
    mocks.service.ready = false;
    mocks.service.error = 'HTTP 503';
    try {
      render(<ShortcutsPanel />);
      expect(screen.getByRole('alert').textContent).toContain('Could not load the Agility shortcuts.');
      const calls = mocks.service.init.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Retry shortcuts' }));
      expect(mocks.service.init.mock.calls.length).toBe(calls + 1);
      expect(mocks.service.shortcuts).not.toHaveBeenCalled();
    } finally {
      mocks.service.ready = true;
      mocks.service.error = null;
    }
  });
});

describe('ShortcutsPanel multi-skill shortcuts', () => {
  // Was: three rows for the one grapple (L10, L20, L30), each judged on one skill.
  // Now the grapple is one row on its Agility level, judged on all three skills.
  it('renders a same-named shortcut once without a duplicate React key warning', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<ShortcutsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Agility Shortcuts/ }));

    expect(screen.getAllByText('Mith grapple')).toHaveLength(1);
    expect(screen.getByText('L10')).toBeTruthy();
    expect(screen.queryByText('L20')).toBeNull();
    expect(screen.getByText('0')).toBeTruthy(); // 0 / 1 usable now
    expect(screen.getByText(/\/ 1 usable now/)).toBeTruthy();

    const duplicateKeyWarning = consoleError.mock.calls.some(([message]) =>
      typeof message === 'string' && message.includes('same key'));
    expect(duplicateKeyWarning).toBe(false);
  });

  it('names the skill each shortcut is gated on, not always Agility', () => {
    mocks.game.unlocks.skills = { Agility: 10, Ranged: 10, Strength: 10 } as never;
    try {
      render(<ShortcutsPanel />);
      fireEvent.click(screen.getByRole('button', { name: /Agility Shortcuts/ }));

      expect(screen.getByText('Ranged 20')).toBeTruthy();
      expect(screen.getByText('Strength 30')).toBeTruthy();
      expect(screen.queryByText('Agility 20')).toBeNull();
    } finally {
      mocks.game.unlocks.skills = {} as never;
    }
  });
});
