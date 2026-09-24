import { afterEach, describe, expect, it, vi } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('replaces the preview-only quest item lists with an empty stand-in', async () => {
    const boundaryPlugin = await normalBoundaryPlugin();
    const resolve = vi.fn(() => 'public-safe-module');
    const resolveId = boundaryPlugin.resolveId as (source: string, importer: string) => unknown;
    const importer = '/virtual/data/questItemRequirements.ts';

    for (const source of ['./questItemRequirements.preview', './questItemRequirements.preview.ts']) {
      expect(await resolveId.call({ resolve }, source, importer)).toBe('public-safe-module');
    }

    for (const source of ['./questItemRequirements', './questItemRequirements.preview-omitted']) {
      expect(await resolveId.call({ resolve }, source, importer)).toBeNull();
    }
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith('./questItemRequirements.preview-omitted', importer, { skipSelf: true });
  });

  it('keeps the private catalogue excluded when a preview flag is inherited', async () => {
    vi.stubEnv('VITE_RUNEPROOF_PREVIEW', '1');
    const boundaryPlugin = await normalBoundaryPlugin();
    const resolve = vi.fn(() => 'public-safe-module');
    const resolveId = boundaryPlugin.resolveId as (source: string, importer: string) => unknown;

    expect(await resolveId.call({ resolve }, './questWalkthroughs', '/virtual/data/questWalkthroughLoader.ts'))
      .toBe('public-safe-module');
    expect(resolve).toHaveBeenCalledWith(
      './questWalkthroughs.public',
      '/virtual/data/questWalkthroughLoader.ts',
      { skipSelf: true },
    );
    expect(await resolveId.call({ resolve }, './questItemRequirements.preview', '/virtual/data/questItemRequirements.ts'))
      .toBe('public-safe-module');
    expect(resolve).toHaveBeenCalledWith(
      './questItemRequirements.preview-omitted',
      '/virtual/data/questItemRequirements.ts',
      { skipSelf: true },
    );
  });
});
