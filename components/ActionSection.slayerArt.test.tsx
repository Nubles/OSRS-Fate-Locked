// @vitest-environment jsdom
// After Monkey Madness II the Farm Keys card is Steve the Slayer master, so it
// uses the Wiki's Slayer master picture, not Steve the Slayer guardian's
// (OSRS Wiki "Steve": image1 = Steve (Slayer master).png, image2 = Steve.png).
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const game = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  return { ...actual, useGame: () => game.current };
});

import { initialState } from '../context/GameContext';
import { useFarmModel } from './ActionSection';

describe('Farm Keys Slayer master pictures', () => {
  it('shows Steve as the Slayer master once Monkey Madness II is done', () => {
    game.current = { ...initialState, gameModeId: 'classic', unlocks: { ...initialState.unlocks, quests: ['Monkey Madness II'] }, rollForKey: vi.fn() };
    const { result } = renderHook(() => useFarmModel());
    const steve = result.current.slayers.find(m => m.name === 'Steve');
    expect(steve?.image).toBe('https://oldschool.runescape.wiki/images/Steve_(Slayer_master).png');
  });

  it('shows Nieve before it', () => {
    game.current = { ...initialState, gameModeId: 'classic', rollForKey: vi.fn() };
    const { result } = renderHook(() => useFarmModel());
    expect(result.current.slayers.find(m => m.name === 'Nieve')?.image).toBe('https://oldschool.runescape.wiki/images/Nieve.png');
  });
});
