import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';

const PRIVATE_MARKER = 'Talk to Doric to start the quest.';
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
    expect(await bundleContains(preview, PRIVATE_MARKER)).toBe(true);
  }, 120_000);
});
