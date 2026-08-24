import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';
import previewManifest from '../data/sources/runeproof-pack-releases.preview.json';
import publicManifest from '../data/sources/runeproof-pack-releases.public.json';
import {
  runeProofPlatformReviewHarnessRevision,
  runeProofPreviewQaMarker,
} from '../data/runeProofPlatformReviewHarness.preview';

const PUBLIC_RELEASE_MARKERS = publicManifest.entries.map(entry => entry.packRevision);
const publicRevisionSet = new Set(PUBLIC_RELEASE_MARKERS);
const PRIVATE_RELEASE_MARKERS = previewManifest.entries
  .map(entry => entry.packRevision)
  .filter(revision => !publicRevisionSet.has(revision));
const RAW_AUDIT_NOTE_MARKER = 'The pinned Wiki item requirements for A Kingdom Divided were reviewed; inventory possession and pre-obtained supplies are not machine-enforced.';
const RAW_AUDIT_SOURCE_MARKER = 'https://oldschool.runescape.wiki/w/index.php?title=A_Kingdom_Divided&oldid=15259353';
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
    await expect(Promise.all(PUBLIC_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PUBLIC_RELEASE_MARKERS.map(() => true));
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(preview, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => true));
    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
    expect(await bundleContains(normal, runeProofPlatformReviewHarnessRevision)).toBe(false);
    expect(await bundleContains(normal, 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1')).toBe(false);
    expect(await bundleContains(normal, runeProofPreviewQaMarker)).toBe(false);
    expect(await bundleContains(normal, RAW_AUDIT_NOTE_MARKER)).toBe(false);
    expect(await bundleContains(preview, runeProofPlatformReviewHarnessRevision)).toBe(true);
    expect(await bundleContains(preview, 'RUNEPROOF_PLATFORM_REVIEW_HARNESS_V1')).toBe(true);
    expect(await bundleContains(preview, runeProofPreviewQaMarker)).toBe(true);
    expect(await bundleContains(preview, RAW_AUDIT_NOTE_MARKER)).toBe(false);
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

    await expect(Promise.all(PRIVATE_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PRIVATE_RELEASE_MARKERS.map(() => false));
    expect(await bundleContains(normal, runeProofPlatformReviewHarnessRevision)).toBe(false);
    expect(await bundleContains(normal, runeProofPreviewQaMarker)).toBe(false);
    expect(await bundleContains(normal, RAW_AUDIT_NOTE_MARKER)).toBe(false);
  }, 120_000);

  it('keeps a reachable public pack aggregator free of raw requirement-audit data', async () => {
    const normal = await mkdtemp(join(tmpdir(), 'runeproof-public-entry-'));
    outputs.push(normal);

    await build({
      configFile: join(process.cwd(), 'vite.config.ts'),
      mode: 'production',
      build: {
        outDir: normal,
        emptyOutDir: true,
        rollupOptions: {
          input: join(process.cwd(), 'data/runeProofPacks.public.ts'),
          preserveEntrySignatures: 'strict',
        },
      },
    });

    await expect(Promise.all(PUBLIC_RELEASE_MARKERS.map(marker => bundleContains(normal, marker))))
      .resolves.toEqual(PUBLIC_RELEASE_MARKERS.map(() => true));
    expect(await bundleContains(normal, RAW_AUDIT_NOTE_MARKER)).toBe(false);
    expect(await bundleContains(normal, RAW_AUDIT_SOURCE_MARKER)).toBe(false);
  }, 120_000);
});
