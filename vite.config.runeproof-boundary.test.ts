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

  it('redirects every exact private module ID with or without an extension', async () => {
    const boundaryPlugin = await normalBoundaryPlugin();
    const resolve = vi.fn((source: string) => `public-safe:${source}`);
    const resolveId = boundaryPlugin.resolveId as (source: string, importer: string) => unknown;
    const importer = '/virtual/data/questWalkthroughLoader.ts';

    const redirects = new Map([
      ['questWalkthroughs', 'questWalkthroughs.public'],
      ['questWalkthroughs.preview-boundary', 'questWalkthroughs.public'],
      ['runeProofPacks.preview-boundary', 'runeProofPacks.public'],
      ['runeProofPackRelease.preview', 'runeProofPackRelease.public'],
      ['runeProofPlatformReviewHarness.preview', 'runeProofPlatformReviewHarness.public'],
    ]);
    for (const [privateId, publicId] of redirects) {
      for (const extension of ['', '.ts']) {
        expect(await resolveId.call(
          { resolve },
          `./${privateId}${extension}`,
          importer,
        )).toBe(`public-safe:./${publicId}`);
      }
    }

    for (const nearMatch of [
      './notquestWalkthroughs',
      './runeProofPacks.preview-boundary-extra',
      './runeProofPackRelease.preview.json',
      './runeProofPlatformReviewHarness.previewed',
    ]) {
      expect(await resolveId.call({ resolve }, nearMatch, importer)).toBeNull();
    }
    expect(resolve).toHaveBeenCalledTimes(10);
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
  });

  it('keeps private manifest and harness imports owned by the preview aggregator', async () => {
    const sources = import.meta.glob([
      './data/**/*.{ts,tsx}',
      './utils/**/*.{ts,tsx}',
      './hooks/**/*.{ts,tsx}',
      './components/**/*.{ts,tsx}',
    ], { eager: true, import: 'default', query: '?raw' });
    const violations: string[] = [];
    for (const [path, value] of Object.entries(sources)) {
      if (/\.test\.[jt]sx?$/.test(path) || typeof value !== 'string') continue;
      const source = value;
      if (/from\s+['"][^'"]*runeProofPackRelease\.preview(?:\.[cm]?[jt]s)?['"]|import\(['"][^'"]*runeProofPackRelease\.preview(?:\.[cm]?[jt]s)?['"]\)/.test(source)
        || /from\s+['"][^'"]*runeProofPlatformReviewHarness\.preview(?:\.[cm]?[jt]s)?['"]|import\(['"][^'"]*runeProofPlatformReviewHarness\.preview(?:\.[cm]?[jt]s)?['"]\)/.test(source)) {
        const owner = path.replace(/^\.\//, '');
        if (owner !== 'data/runeProofPacks.preview-boundary.ts') violations.push(owner);
      }
    }
    expect(violations).toEqual([]);
  });
});
