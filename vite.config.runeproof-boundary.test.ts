import { describe, expect, it, vi } from 'vitest';
import type { ConfigEnv, Plugin, UserConfig } from 'vite';
import viteConfig from './vite.config';

const normalBoundaryPlugin = async (): Promise<Plugin> => {
  const config = await (viteConfig as (environment: ConfigEnv) => UserConfig | Promise<UserConfig>)({
    command: 'build',
    mode: 'production',
    isSsrBuild: false,
    isPreview: false,
  });
  const boundaryPlugin = (config.plugins as Plugin[] | undefined)
    ?.find(plugin => plugin.name === 'runeproof-preview-boundary');

  if (!boundaryPlugin || typeof boundaryPlugin.resolveId !== 'function') {
    throw new Error('RuneProof preview boundary resolver is unavailable.');
  }

  return boundaryPlugin;
};

describe('RuneProof normal-build module boundary', () => {
  it('redirects only the two private catalogue module IDs', async () => {
    const boundaryPlugin = await normalBoundaryPlugin();
    const resolve = vi.fn(() => 'public-safe-module');
    const resolveId = boundaryPlugin.resolveId as (source: string, importer: string) => unknown;
    const importer = '/virtual/data/questWalkthroughLoader.ts';

    for (const source of [
      './questWalkthroughs',
      './questWalkthroughs.ts',
      './questWalkthroughs.preview-boundary',
      './questWalkthroughs.preview-boundary.ts',
    ]) {
      expect(await resolveId.call({ resolve }, source, importer)).toBe('public-safe-module');
    }

    expect(await resolveId.call({ resolve }, './notquestWalkthroughs', importer)).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(4);
    expect(resolve).toHaveBeenCalledWith('./questWalkthroughs.public', importer, { skipSelf: true });
  });
});
