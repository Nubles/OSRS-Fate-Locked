/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';
import type { AreaRoutesState } from './useAreaRoutes';

/**
 * The first screen's "ready to complete" and "doable now" counts read the
 * routes. Until the map's transport data arrived they counted every owned
 * area, so a run that owns a place no route reaches saw them drop a moment
 * after each page load (8 quests ready, then 5; 29 diary tasks, then 10).
 * The hook now says when the routes are still on their way, so the screen
 * can hold those counts instead of showing a number that is about to change.
 */

const unlocks = { regions: ['Lumbridge'] } as unknown as UnlockState;
const STRANDED = { strandedAreas: new Set(['Fossil Island']), strandedChunks: new Set<string>() };

// A stand-in for the content service: not ready until the test says so.
const service = {
  ready: false,
  listeners: new Set<() => void>(),
  finish: null as null | ((ok: boolean) => void),
  subscribe(listener: () => void) { service.listeners.add(listener); return () => { service.listeners.delete(listener); }; },
  init: vi.fn(() => new Promise<boolean>((resolve) => {
    service.finish = (ok) => { service.ready = ok; for (const l of service.listeners) l(); resolve(ok); };
  })),
  connectGraph: () => ({}),
};
const compute = vi.fn(() => STRANDED);
let failImport = false;

vi.mock('../services/ChunkContentService', () => ({ chunkContentService: service }));
vi.mock('../utils/areaRoutes', () => ({ computeAreaRoutes: (...args: unknown[]) => compute(...(args as [])) }));
vi.mock('../utils/lazyRetry', () => ({
  importWithRetry: <T,>(load: () => Promise<T>) => (failImport ? Promise.reject(new Error('offline')) : load()),
}));

const seen: AreaRoutesState[] = [];
const mount = async (enabled = true) => {
  const { useAreaRoutesState } = await import('./useAreaRoutes');
  const Probe: React.FC<{ enabled: boolean }> = ({ enabled: on }) => { seen.push(useAreaRoutesState(unlocks, 'vanilla', on)); return null; };
  return render(<Probe enabled={enabled} />);
};
const last = () => seen[seen.length - 1];
const settle = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

beforeEach(() => {
  vi.resetModules();
  seen.length = 0;
  service.ready = false; service.listeners.clear(); service.finish = null; service.init.mockClear();
  compute.mockClear(); failImport = false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('useAreaRoutesState', () => {
  it('is pending until the routes load, then gives them', async () => {
    await mount();
    expect(last()).toEqual({ routes: null, pending: true });
    await settle();
    expect(last()).toEqual({ routes: null, pending: true });

    await act(async () => { service.finish!(true); });
    expect(last()).toEqual({ routes: STRANDED, pending: false });
    // Never a moment that is neither waiting nor answered.
    expect(seen.some(state => state.routes === null && !state.pending)).toBe(false);
  });

  it('does not wait during the first-visit onboarding, which loads nothing', async () => {
    await mount(false);
    await settle();
    expect(last()).toEqual({ routes: null, pending: false });
    expect(service.init).not.toHaveBeenCalled();
  });

  it('stops waiting when the map data fails to load, and counts as before', async () => {
    await mount();
    await settle();
    await act(async () => { service.finish!(false); });
    expect(last()).toEqual({ routes: null, pending: false });
  });

  it('stops waiting when the code for it cannot be fetched', async () => {
    failImport = true;
    await mount();
    await settle();
    expect(last()).toEqual({ routes: null, pending: false });
  });

  it('stops waiting if the load hangs past the wait, and still takes the routes when they come', async () => {
    vi.useFakeTimers();
    const { AREA_ROUTES_WAIT_MS } = await import('./useAreaRoutes');
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(AREA_ROUTES_WAIT_MS - 1); });
    expect(last()).toEqual({ routes: null, pending: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(2); });
    expect(last()).toEqual({ routes: null, pending: false });

    await act(async () => { service.finish!(true); });
    expect(last()).toEqual({ routes: STRANDED, pending: false });
  });

  it('gives a panel opened later its routes on the first draw', async () => {
    const first = await mount();
    await settle();
    await act(async () => { service.finish!(true); });
    first.unmount();

    seen.length = 0;
    await mount();
    expect(seen[0]).toEqual({ routes: STRANDED, pending: false });
  });
});
