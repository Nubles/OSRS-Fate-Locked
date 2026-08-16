/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  service: {
    ready: true,
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

describe('ShortcutsPanel duplicate-name rows', () => {
  it('renders every same-named shortcut without a duplicate React key warning', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<ShortcutsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Agility Shortcuts/ }));

    expect(screen.getAllByText('Mith grapple')).toHaveLength(3);
    expect(screen.getByText('L10')).toBeTruthy();
    expect(screen.getByText('L20')).toBeTruthy();
    expect(screen.getByText('L30')).toBeTruthy();

    const duplicateKeyWarning = consoleError.mock.calls.some(([message]) =>
      typeof message === 'string' && message.includes('same key'));
    expect(duplicateKeyWarning).toBe(false);
  });
});
