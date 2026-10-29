// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdventurersLog, { mapView } from './AdventurersLog';
import { MAP_GRID } from '../utils/chunkMapBits';

const RUN = 'AAAAAAAAAAAAAAAAAAAAAA';
// Lumbridge's 50,50 and its neighbour 51,50: row 15, columns 35 and 36.
const bits = new Uint8Array(204);
for (const bit of [15 * 48 + 35, 15 * 48 + 36]) bits[bit >> 3] |= 1 << (bit & 7);
const map = btoa(String.fromCharCode(...bits));

const snapshot = {
  v: 1, mode: 'Vanilla', modeId: 'vanilla', account: 'Whim', startedAt: Date.UTC(2026, 9, 1),
  areas: { unit: 'areas', unlocked: 34, total: 125 }, chunks: { unlocked: 2, total: 624 },
  quests: { done: 21, total: 212 }, diaryTasks: { done: 40, total: 492 }, ca: { points: 12, tier: 'Easy' },
  recent: [{ text: 'Unlocked Varrock (Areas)', at: Date.now() - 3 * 3_600_000 }],
  map, public: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the Adventurer\'s Log page', () => {
  it('shows a public run\'s counts, recent unlocks and lit chunks', async () => {
    const updatedAt = Date.now() - 150_000;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ snapshot, updatedAt })));
    render(<AdventurersLog id={RUN} />);
    expect(await screen.findByText('Whim')).toBeTruthy();
    expect(screen.getByText('Vanilla')).toBeTruthy();
    expect(screen.getByText('21 / 212')).toBeTruthy();
    expect(screen.getByText('Varrock (Areas)')).toBeTruthy();
    expect(screen.getByText('3 hours ago')).toBeTruthy();
    expect(screen.getByRole('img', { name: /2 owned chunks lit/ })).toBeTruthy();
    expect(screen.getByText(/Updated 2 minutes ago/)).toBeTruthy();
    // The page names itself in an effect after the run loads, which can land a tick later.
    await waitFor(() => expect(document.title).toBe('Whim\'s Adventurer\'s Log · Fate Locked'));
  });

  it('says so when the run is private or gone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    render(<AdventurersLog id={RUN} />);
    expect(await screen.findByText(/private, or no longer shared/)).toBeTruthy();
  });

  it('frames the owned chunks with a margin, inside the map', () => {
    const view = mapView(new Set(['50,50', '51,50']));
    expect(view.w).toBeGreaterThanOrEqual(14);
    expect(view.h).toBeGreaterThanOrEqual(9);
    expect(view.x).toBeLessThanOrEqual(35 - 2);
    expect(view.x + view.w).toBeGreaterThanOrEqual(37 + 2);
    const corner = mapView(new Set([`${MAP_GRID.minCx},${MAP_GRID.maxCy}`]));
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
    expect(mapView(new Set())).toEqual({ x: 0, y: 0, w: MAP_GRID.cols, h: MAP_GRID.rows });
  });
});
