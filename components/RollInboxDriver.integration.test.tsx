// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RollInboxRow } from '../services/rollInboxStore';

const harness = vi.hoisted(() => ({
  store: {
    list: vi.fn((): RollInboxRow[] => []),
    transition: vi.fn(),
  },
}));

vi.mock('../context/GameContext', () => ({
  useGame: () => ({
    runId: 'run-1',
    runRevision: 1,
    linkedAccount: 'Nubles',
  }),
}));
vi.mock('../services/rollInboxRuntime', () => ({
  getRollInboxStore: () => harness.store,
}));

import RollInboxDriver from './RollInboxDriver';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  harness.store.list.mockReset();
  harness.store.list.mockReturnValue([]);
  harness.store.transition.mockReset();
});

describe('RollInboxDriver current relay boundary', () => {
  it('never asks the relay while RuneLite isn’t paired', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<RollInboxDriver />);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
