import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
const PRIVATE_MARKERS = [
  PRIVATE_MARKER,
  EXPANDED_PREVIEW_MARKER,
  ...PRIVATE_RELEASE_MARKERS,
  ...PRIVATE_REQUIREMENT_MARKERS,
];
const PUBLIC_MARKER = 'Independently authored quest steps and F2P chunk locations.';
// Two real builds take tens of seconds, so the hook sets its own limit rather
// than relying on vitest's 10 s hook default.
const BUILDS_TIMEOUT_MS = 240_000;

const emittedFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? emittedFiles(path) : [path];
  }))).flat();
};

/** Reads every emitted file once and reports which markers any of them contains. */
const markersIn = async (directory: string): Promise<ReadonlyMap<string, boolean>> => {
  const contents = await Promise.all((await emittedFiles(directory)).map(path => readFile(path)));
  return new Map([...PRIVATE_MARKERS, PUBLIC_MARKER].map(marker => [
    marker,
    contents.some(content => content.includes(Buffer.from(marker))),
  ]));
};

const buildInto = async (mode: string, outDir: string): Promise<void> => {
  await build({
    configFile: join(process.cwd(), 'vite.config.ts'),
    mode,
    logLevel: 'error',
    build: { outDir, emptyOutDir: true, reportCompressedSize: false },
  });
};

describe('RuneProof production bundle boundary', () => {
  const outputs: string[] = [];
  let production: ReadonlyMap<string, boolean>;
  let preview: ReadonlyMap<string, boolean>;

  // One build per mode serves every check. The production build inherits the
  // preview flag from its environment, the stricter case: the boundary is keyed
  // to the build mode, so it must hold whether or not the flag is set.
  beforeAll(async () => {
    const normalDirectory = await mkdtemp(join(tmpdir(), 'runeproof-normal-'));
    const previewDirectory = await mkdtemp(join(tmpdir(), 'runeproof-preview-'));
    outputs.push(normalDirectory, previewDirectory);

    vi.stubEnv('VITE_RUNEPROOF_PREVIEW', '1');
    try {
      await buildInto('production', normalDirectory);
    } finally {
      vi.unstubAllEnvs();
    }
    await buildInto('runeproof-preview', previewDirectory);
    [production, preview] = await Promise.all([markersIn(normalDirectory), markersIn(previewDirectory)]);
  }, BUILDS_TIMEOUT_MS);

  afterAll(async () => {
    await Promise.all(outputs.splice(0).map(path => rm(path, { recursive: true, force: true })));
  });

  it('keeps the private preview payload out of production, even with an inherited preview flag', () => {
    expect(PRIVATE_MARKERS.filter(marker => production.get(marker))).toEqual([]);
    expect(production.get(PUBLIC_MARKER)).toBe(true);
  });

  it('ships the private preview payload in the preview build', () => {
    expect(PRIVATE_MARKERS.filter(marker => !preview.get(marker))).toEqual([]);
  });
});
