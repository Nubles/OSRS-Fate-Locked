import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkChunkSourceDrift,
  readPinnedChunkSource,
  verifyPinnedChunkSource,
  writeApprovedChunkSource,
} from './chunk-source.mjs';
import { transformChunkContent } from './chunk-content-transform.mjs';

describe('pinned Chunk Picker source', () => {
  it('verifies the exact reviewed commit, blob, bytes, and raw hash offline', async () => {
    const manifest = await verifyPinnedChunkSource();
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      repository: 'source-chunk/chunk-picker-v2',
      branch: 'gh-pages',
      commit: '4eb75a8454eb41cfff71b70819326e0e67bcea7c',
      blobSha: 'e6591f67609a37792361df25a10835d9e36ee45f',
      rawSha256: '370F0F51BED8938988E368C41038A05197026CD8F524C0F87C2F3E773A32B4E4',
      rawBytes: 7510818,
      policyVersion: 2,
      reviewedAt: '2026-08-02',
    });
  });

  it('loads valid JSON from the committed gzip without network access', async () => {
    const { raw, data } = await readPinnedChunkSource();
    expect(raw).toHaveLength(7510818);
    expect(data).toMatchObject({
      chunks: expect.any(Object),
      walkableChunks: expect.any(Array),
      questSections: expect.any(Object),
      taskUnlocks: expect.any(Object),
    });
  });

  it('does not replace an existing gzip when fetched bytes fail JSON or transform preflight', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const existing = Buffer.from('preserve this gzip');
    const manifestFor = (raw: Buffer) => ({
      rawBytes: raw.length,
      rawSha256: createHash('sha256').update(raw).digest('hex').toUpperCase(),
      countFloors: { contentChunks: 1 },
    });

    await writeFile(targetUrl, existing);
    try {
      const invalidJson = Buffer.from('{');
      await expect(writeApprovedChunkSource(invalidJson, manifestFor(invalidJson), targetUrl))
        .rejects.toThrow(SyntaxError);
      await expect(readFile(targetUrl)).resolves.toEqual(existing);

      const transformInvalid = Buffer.from('{}');
      await expect(writeApprovedChunkSource(transformInvalid, manifestFor(transformInvalid), targetUrl))
        .rejects.toThrow('Chunk transform floor failed for contentChunks: expected at least 1, received 0');
      await expect(readFile(targetUrl)).resolves.toEqual(existing);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it('pins reviewed transform totals and the unresolved named-location backlog', async () => {
    const { data, manifest } = await readPinnedChunkSource();
    const result = transformChunkContent(data, manifest);
    const { full, audit } = result;
    expect({
      contentChunks: Object.keys(full.chunks).length,
      connections: Object.keys(full.connect).length,
      slayerMasters: Object.keys(full.slayerMasters).length,
      shortcuts: full.shortcuts.length,
      shops: Object.keys(full.shopItems).length,
      dropTables: Object.keys(full.drops).length,
      questSections: Object.keys(full.questSections).length,
      banks: full.banks.length,
      tags: Object.keys(full.tags).length,
      auditEvents: audit.events.length,
      unresolvedTaskUnlocks: audit.events.filter(
        (event) => event.category === 'taskUnlocks'
          && event.disposition === 'unresolved',
      ).length,
    }).toEqual({
      contentChunks: 937,
      connections: 1110,
      slayerMasters: 10,
      shortcuts: 203,
      shops: 435,
      dropTables: 799,
      questSections: 134,
      banks: 101,
      tags: 27,
      auditEvents: 27035,
      unresolvedTaskUnlocks: 140,
    });
  });

  it('reports upstream movement without mutating the pin', async () => {
    const result = await checkChunkSourceDrift(async () => new Response(JSON.stringify({
      commit: { sha: 'new-upstream-sha' },
    }), { status: 200 }));
    expect(result).toEqual({
      pinnedCommit: '4eb75a8454eb41cfff71b70819326e0e67bcea7c',
      latestCommit: 'new-upstream-sha',
      moved: true,
    });
  });
});
