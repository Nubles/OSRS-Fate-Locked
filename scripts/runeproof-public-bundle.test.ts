import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';

const PRIVATE_MARKER = 'Talk to Doric to start the quest.';
const PRIVATE_RELEASE_MARKERS = [
  '2311293172d8ea0d4ddc1d69e7d5e696af92951edb7e07543b502fa46671e1a1',
  'b9441f541e61ba860e325369d560c5465573d6af6bb9a462db19be007ba68b2e',
  '19a1c036b94472c209efe0ddd47823c54c5893eb7e2de56509ea80aa463f5691',
  'f47c094bf2e5c52d96238477993ccf8988a166d78ef5987bc89ca9a8394b5194',
  '2aa93838959a1fd0c26ab45642b9bb39e5bad0321487129cdf2fb39f2bf971e2',
  '10713567065dfb8118da8fa8bcd91413bad41070d9f42d3bed46666e756b1c7a',
  '5307348d9dab40a1801d78b06660af566112223a339dfa017f4a43306149bd5f',
  '0f50a69f17989b9b244ba0f47f1461c65d720eece2b9603ad14158850ad53cdd',
] as const;
const WORKSPACE_MARKER = 'Close RuneProof';
const LEGACY_MARKER = 'Independently authored quest steps and F2P chunk locations.';
const outputs: string[] = [];

const emittedFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? emittedFiles(path) : [path];
  }))).flat();
};

const bundleContains = async (directory: string, marker: string): Promise<boolean> => {
  const contents = await Promise.all((await emittedFiles(directory)).map(path => readFile(path)));
  return contents.some(content => content.includes(Buffer.from(marker)));
};

describe('RuneProof production bundle boundary', () => {
  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(outputs.splice(0).map(path => rm(path, { recursive: true, force: true })));
  });

  it('ships the workspace and its assets only in the explicit private preview', async () => {
    const normal = await mkdtemp(join(tmpdir(), 'runeproof-normal-'));
    const preview = await mkdtemp(join(tmpdir(), 'runeproof-preview-'));
    outputs.push(normal, preview);

    await build({
      configFile: join(process.cwd(), 'vite.config.ts'),
      mode: 'production',
      build: { outDir: normal, emptyOutDir: true },
    });
    await build({
      configFile: join(process.cwd(), 'vite.config.ts'),
      mode: 'runeproof-preview',
      build: { outDir: preview, emptyOutDir: true },
    });

    expect(normal).not.toBe(preview);
    expect(await bundleContains(normal, PRIVATE_MARKER)).toBe(false);
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
    expect(await bundleContains(normal, WORKSPACE_MARKER)).toBe(false);
    expect((await emittedFiles(normal)).some(path => /[\\/]runeproof[\\/]/.test(path))).toBe(false);
    expect((await emittedFiles(normal)).some(path => /RuneProofWorkspace/.test(path))).toBe(false);
    expect(await bundleContains(preview, PRIVATE_MARKER)).toBe(false);
    expect(await bundleContains(preview, WORKSPACE_MARKER)).toBe(true);
    expect((await emittedFiles(preview)).some(path => /[\\/]runeproof[\\/]chunk-instructions[\\/]/.test(path))).toBe(true);
    expect(await bundleContains(normal, LEGACY_MARKER)).toBe(false);
    expect(await bundleContains(preview, LEGACY_MARKER)).toBe(false);
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(preview, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
  }, 120_000);

  it('keeps the private preview payload out of production with an inherited preview flag', async () => {
    const normal = await mkdtemp(join(tmpdir(), 'runeproof-normal-inherited-'));
    outputs.push(normal);
    vi.stubEnv('VITE_RUNEPROOF_PREVIEW', '1');

    await build({
      configFile: join(process.cwd(), 'vite.config.ts'),
      mode: 'production',
      build: { outDir: normal, emptyOutDir: true },
    });

    expect(await bundleContains(normal, PRIVATE_MARKER)).toBe(false);
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
    expect(await bundleContains(normal, WORKSPACE_MARKER)).toBe(false);
    expect((await emittedFiles(normal)).some(path => /[\\/]runeproof[\\/]/.test(path))).toBe(false);
    expect((await emittedFiles(normal)).some(path => /RuneProofWorkspace/.test(path))).toBe(false);
  }, 120_000);
});
