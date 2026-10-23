import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLiveBuild, reloadIfNewBuild } from './chunkLoadError';

const serveBuild = (build: string) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ build }), { status: 200 })));

describe('reloadIfNewBuild', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reloads when a newer build is live', async () => {
    serveBuild(`${__BUILD_ID__}-next`);
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {} });
    expect(await checkLiveBuild()).toBe('newer');
    expect(await reloadIfNewBuild()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('stays put when the live build is the one already running', async () => {
    serveBuild(__BUILD_ID__);
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    expect(await reloadIfNewBuild()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('stays put when the connection is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    expect(await checkLiveBuild()).toBe('unknown');
    expect(await reloadIfNewBuild()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
