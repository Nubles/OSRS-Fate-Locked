// @vitest-environment jsdom
import React, { act } from 'react';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyWithRetry } from '../utils/lazyRetry';

const reload = vi.hoisted(() => vi.fn(async () => false));
vi.mock('../utils/chunkLoadError', async () => {
  const actual = await vi.importActual<typeof import('../utils/chunkLoadError')>('../utils/chunkLoadError');
  return { ...actual, reloadIfNewBuild: reload };
});
vi.mock('../utils/errorBeacon', () => ({ reportError: vi.fn() }));

import { StandaloneRoute } from './StandaloneRoute';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StandaloneRoute (#/log/<id> and #/overlay)', () => {
  it('shows Reload, not a blank page, when the page chunk fails to load', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Failing = lazyWithRetry(() => Promise.reject(
      new TypeError('Failed to fetch dynamically imported module: https://example.test/assets/AdventurersLog-abc.js'),
    )) as unknown as React.FC<{ id: string }>;
    await act(async () => {
      render(<React.StrictMode><StandaloneRoute name="Adventurer's Log"><Failing id="abc" /></StandaloneRoute></React.StrictMode>);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText("Couldn't load Adventurer's Log")).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reload now/ })).toBeTruthy();
    expect(reload).toHaveBeenCalled();
  });

  it('shows a message when the page itself throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom: React.FC = () => { throw new Error('bad log data'); };
    await act(async () => {
      render(<StandaloneRoute name="Adventurer's Log"><Boom /></StandaloneRoute>);
    });
    expect(screen.getByText(/Adventurer's Log hit an error/)).toBeTruthy();
    expect(screen.getByText('bad log data')).toBeTruthy();
  });

  it('wraps both lazy pages in index.tsx', () => {
    const index = readFileSync(resolve('index.tsx'), 'utf8');
    expect(index).toMatch(/<StandaloneRoute name="Stream overlay"><StreamOverlay \/><\/StandaloneRoute>/);
    expect(index).toMatch(/<StandaloneRoute name="Adventurer's Log"><AdventurersLog id=\{view\.id\} \/><\/StandaloneRoute>/);
    expect(index).not.toMatch(/<Suspense/);
  });
});
