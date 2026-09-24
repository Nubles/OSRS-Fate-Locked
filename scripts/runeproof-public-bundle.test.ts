import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';

const EXPANDED_PREVIEW_MARKER = 'Independent F2P test guide checked against pinned full Wiki pages';
const PRIVATE_MARKER = 'Talk to Doric to start the quest.';
const PRIVATE_RELEASE_MARKERS = [
  '2311293172d8ea0d4ddc1d69e7d5e696af92951edb7e07543b502fa46671e1a1',
  'b9441f541e61ba860e325369d560c5465573d6af6bb9a462db19be007ba68b2e',
  '19a1c036b94472c209efe0ddd47823c54c5893eb7e2de56509ea80aa463f5691',
  'f47c094bf2e5c52d96238477993ccf8988a166d78ef5987bc89ca9a8394b5194',
  '61adaed2635c9bfa09158c13dc25c906b3d5746e2cd20f849ed2a29cc552618d',
  'ac29fd792fcc21964d4ad9c274a28a6f9d5f119f45524b310231060e20cd6e16',
  '5307348d9dab40a1801d78b06660af566112223a339dfa017f4a43306149bd5f',
  '0f50a69f17989b9b244ba0f47f1461c65d720eece2b9603ad14158850ad53cdd',
] as const;
// Notes from the reviewed item lists of Daddy's Home, Doric's Quest and
// Elemental Workshop I, which only the preview build offers.
const PRIVATE_REQUIREMENT_MARKERS = [
  'Nail beast nails and Dragon nails are not valid construction nails.',
  'Clay only; not Soft clay.',
  'this is a reviewed quest alternative, not an item alias.',
] as const;
const PUBLIC_MARKER = 'Independently authored quest steps and F2P chunk locations.';
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

  it('separates the private preview payload from the normal production bundle', async () => {
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
    expect(await bundleContains(normal, EXPANDED_PREVIEW_MARKER)).toBe(false);
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
    await expect(Promise.all(PRIVATE_REQUIREMENT_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_REQUIREMENT_MARKERS.map(() => false));
    expect(await bundleContains(normal, PUBLIC_MARKER)).toBe(true);
    expect(await bundleContains(preview, PRIVATE_MARKER)).toBe(true);
    expect(await bundleContains(preview, EXPANDED_PREVIEW_MARKER)).toBe(true);
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(preview, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => true));
    await expect(Promise.all(PRIVATE_REQUIREMENT_MARKERS.map(marker => bundleContains(preview, marker))))
      .resolves.toEqual(PRIVATE_REQUIREMENT_MARKERS.map(() => true));
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
    expect(await bundleContains(normal, EXPANDED_PREVIEW_MARKER)).toBe(false);
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
    await expect(Promise.all(PRIVATE_REQUIREMENT_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_REQUIREMENT_MARKERS.map(() => false));
    expect(await bundleContains(normal, PUBLIC_MARKER)).toBe(true);
  }, 120_000);
});
