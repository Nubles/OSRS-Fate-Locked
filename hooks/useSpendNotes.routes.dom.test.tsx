/* @vitest-environment jsdom */
// Spend Keys' outlook is worked out with the area routes the Quest Log and the
// Farm Keys cards use, and its route-bound lines wait while those load.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AreaRoutesState } from './useAreaRoutes';

const mocks = vi.hoisted(() => ({
  game: { unlocks: { regions: [] }, gameModeId: 'vanilla', customMode: undefined, hopes: [], hasSeenOnboarding: true },
  routing: { routes: null, pending: true, routesFor: null } as AreaRoutesState,
  enabled: [] as boolean[],
  spendNotes: vi.fn((..._args: unknown[]) => new Map()),
}));
vi.mock('../context/GameContext', () => ({ useGame: () => mocks.game }));
vi.mock('./useAreaRoutes', () => ({
  useAreaRoutesState: (_u: unknown, _m: unknown, enabled: boolean) => { mocks.enabled.push(enabled); return mocks.routing; },
}));
vi.mock('../utils/viewerPrefs', () => ({ tableOutlookPref: { use: () => true } }));
vi.mock('../utils/spendNotes', () => ({ spendNotes: mocks.spendNotes }));

import { useSpendNotes } from './useSpendNotes';

afterEach(() => { cleanup(); vi.useRealTimers(); mocks.spendNotes.mockClear(); });

const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); };

describe('useSpendNotes and the area routes', () => {
  it('passes the routes on, and says when they are still loading', async () => {
    vi.useFakeTimers();
    const view = renderHook(() => useSpendNotes());
    await settle();
    expect(mocks.enabled.at(-1)).toBe(true);
    expect(mocks.spendNotes.mock.calls.at(-1)?.[5]).toMatchObject({ pending: true });

    const routes = { strandedAreas: new Set(['Zul-Andra']), strandedChunks: new Set<string>() };
    const routesFor = () => routes;
    mocks.routing = { routes, pending: false, routesFor };
    view.rerender();
    await settle();
    expect(mocks.spendNotes.mock.calls.at(-1)?.[5]).toMatchObject({ routes, routesFor, pending: false });
  });

  it('holds the route-bound lines before onboarding ends, when routes are not asked for', async () => {
    vi.useFakeTimers();
    mocks.game = { ...mocks.game, hasSeenOnboarding: false };
    mocks.routing = { routes: null, pending: false, routesFor: null };
    renderHook(() => useSpendNotes());
    await settle();
    expect(mocks.enabled.at(-1)).toBe(false);
    expect(mocks.spendNotes.mock.calls.at(-1)?.[5]).toMatchObject({ pending: true });
  });
});
