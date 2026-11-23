/* @vitest-environment jsdom */
// Turning Animations off and back on replays nothing: each event's effects play
// once (hooks/useOncePerEvent.ts, used here and by App.tsx's ritual scene).
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const game = vi.hoisted(() => ({
  lastEvent: null as null | { id: string; type: string; x?: number; y?: number; meta?: Record<string, unknown> },
  animationsEnabled: true,
}));

vi.mock('../context/GameContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../context/GameContext')>()),
  useGame: () => ({ lastEvent: game.lastEvent, animationsEnabled: game.animationsEnabled }),
}));

import { EffectsLayer } from './EffectsLayer';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); game.lastEvent = null; game.animationsEnabled = true; });

describe('the last roll\'s feedback', () => {
  it('plays once, and not again when Animations is switched off and back on', () => {
    // One successful roll, clicked at (300, 200).
    game.lastEvent = { id: 'evt-1', type: 'ROLL_SUCCESS', x: 300, y: 200, meta: { roll: 4.2, threshold: 9.2 } };
    const view = render(<EffectsLayer />);
    expect(screen.queryAllByText('SUCCESS!')).toHaveLength(1);

    // The floater removes itself after 2 seconds.
    act(() => { vi.advanceTimersByTime(2100); });
    expect(screen.queryAllByText('SUCCESS!')).toHaveLength(0);

    // Settings: Animations off ... (same lastEvent object, as the reducer keeps it)
    game.animationsEnabled = false;
    view.rerender(<EffectsLayer />);
    expect(screen.queryAllByText('SUCCESS!')).toHaveLength(0);

    // ... and on again. No new roll happened, so nothing should pop up.
    game.animationsEnabled = true;
    view.rerender(<EffectsLayer />);
    expect(screen.queryAllByText('SUCCESS!')).toHaveLength(0);
  });
});


describe('useOncePerEvent', () => {
  it('plays each event once, and never an event that came while Animations was off', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { useOncePerEvent } = await import('../hooks/useOncePerEvent');
    const play = vi.fn();
    const ritual = { id: 'evt-2', type: 'RITUAL' };
    const view = renderHook(({ event, on }) => useOncePerEvent(event, on, play), { initialProps: { event: ritual, on: false } });
    view.rerender({ event: ritual, on: true });
    expect(play).not.toHaveBeenCalled();
    const next = { id: 'evt-3', type: 'RITUAL' };
    view.rerender({ event: next, on: true });
    view.rerender({ event: next, on: false });
    view.rerender({ event: next, on: true });
    expect(play.mock.calls).toEqual([[next]]);
  });
});
