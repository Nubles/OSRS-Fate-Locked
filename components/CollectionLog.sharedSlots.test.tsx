// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type React from 'react';

const game = vi.hoisted(() => ({
  unlocks: { collectionLog: {} as Record<number, number> },
  collectionLogIdentity: { version: 1, quarantinedIds: [] as number[] },
  logCollectionItem: vi.fn(),
  rollForKey: vi.fn(),
}));
const confirmThen = vi.hoisted(() => vi.fn((_question: string, act: () => void) => act()));
vi.mock('../context/GameContext', () => ({ useGame: () => game }));
vi.mock('../utils/spendConfirm', () => ({ confirmThen }));

import { useCollectionLogModel } from './CollectionLog';

const CHAOS_ELEMENTAL = 109002;
const KING_BLACK_DRAGON = 128003;
const click = { clientX: 0, clientY: 0 } as React.MouseEvent;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Collection Log clicks on an item that several pages list', () => {
  it('shows a page logged elsewhere as obtained and logs a second page without a roll', () => {
    game.unlocks = { collectionLog: { [CHAOS_ELEMENTAL]: 1 } };
    const { result } = renderHook(() => useCollectionLogModel(''));
    expect(result.current.unlocks.collectionLog[KING_BLACK_DRAGON]).toBe(1);
    result.current.handleItemClick(click, KING_BLACK_DRAGON, 'Dragon pickaxe');
    expect(confirmThen).not.toHaveBeenCalled();
    expect(result.current.unlocks.collectionLog[KING_BLACK_DRAGON]).toBe(1);
    expect(game.rollForKey).not.toHaveBeenCalled();
    expect(game.logCollectionItem).toHaveBeenCalledWith(KING_BLACK_DRAGON);
  });

  it('still asks and rolls for the first log of the item', () => {
    game.unlocks = { collectionLog: {} };
    const { result } = renderHook(() => useCollectionLogModel(''));
    result.current.handleItemClick(click, KING_BLACK_DRAGON, 'Dragon pickaxe');
    expect(confirmThen).toHaveBeenCalledWith('Log Dragon pickaxe and roll for a Key?', expect.any(Function));
    expect(game.rollForKey).toHaveBeenCalledTimes(1);
    expect(game.rollForKey.mock.calls[0][0]).toBe('Col. Log: Dragon pickaxe');
  });
});
