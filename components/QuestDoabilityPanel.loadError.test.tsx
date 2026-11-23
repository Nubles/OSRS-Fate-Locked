// @vitest-environment jsdom
// reach-map[1]: a failed chunk-content load is not "loaded". The Chunked quest
// list must offer Retry, not rows worked out without the data.
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({
  ready: false,
  error: 'HTTP 503' as string | null,
  init: vi.fn(async () => false),
  subscribe: vi.fn(() => () => {}),
  questSections: vi.fn(() => ({})),
  connectGraph: vi.fn(() => ({})),
  entityLocations: vi.fn(() => null),
}));
vi.mock('../services/ChunkContentService', () => ({ chunkContentService: service }));
vi.mock('../context/GameContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../context/GameContext')>();
  const fresh = actual.createFreshState();
  return { ...actual, useGame: () => ({ ...fresh, gameModeId: 'chunked' }) };
});

import { QuestDoabilityPanel, useQuestDoabilityRows } from './QuestDoabilityPanel';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Chunked quest doability after a failed chunk-content load', () => {
  it('shows Retry and no quest rows', async () => {
    await act(async () => { render(<QuestDoabilityPanel searchTerm="" />); });
    expect(screen.getByRole('alert').textContent).toContain('Could not load the chunk data.');
    expect(screen.queryByText("Cook's Assistant")).toBeNull();
    const calls = service.init.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry chunk data' })); });
    expect(service.init.mock.calls.length).toBeGreaterThan(calls);
  });

  it('gives the shared rows hook no rows and the error', async () => {
    let seen: ReturnType<typeof useQuestDoabilityRows> | null = null;
    const Probe = () => { seen = useQuestDoabilityRows(); return null; };
    await act(async () => { render(<Probe />); });
    expect(seen!.ready).toBe(false);
    expect(seen!.rows).toEqual([]);
    expect(seen!.loadError).toBe('HTTP 503');
  });
});
