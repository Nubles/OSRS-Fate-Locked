import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import {
  checkChunkSourceDrift,
  readPinnedChunkSource,
  verifyPinnedChunkSource,
  writeApprovedChunkSource,
} from './chunk-source.mjs';
import { transformChunkContent } from './chunk-content-transform.mjs';
import { readNamedTaskUnlockRegistry } from './named-task-unlock-locations.mjs';
import { readBankLocationRegistry } from './bank-locations.mjs';


const unzip = promisify(gunzip);
const gitBlobSha = (raw: Buffer) => createHash('sha1')
  .update(`blob ${raw.length}\0`).update(raw).digest('hex');

describe('pinned Chunk Picker source', () => {
  it('verifies the exact reviewed commit, blob, bytes, and raw hash offline', async () => {
    const manifest = await verifyPinnedChunkSource();
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      repository: 'source-chunk/chunk-picker-v2',
      branch: 'gh-pages',
      commit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
      blobSha: 'ffdcc10139dde0e11be29047c6c730fd762a33c8',
      rawSha256: '2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59',
      rawBytes: 7518778,
      policyVersion: 2,
      reviewedAt: '2026-08-16',
    });
  });

  it('loads valid JSON from the committed gzip without network access', async () => {
    const { raw, data } = await readPinnedChunkSource();
    expect(raw).toHaveLength(7518778);
    expect(data).toMatchObject({
      chunks: expect.any(Object),
      walkableChunks: expect.any(Array),
      questSections: expect.any(Object),
      taskUnlocks: expect.any(Object),
    });
  });

  it('pins the reviewed Mad Angel medium-clue record in the raw source', async () => {
    const { data } = await readPinnedChunkSource();

    expect(data.drops['Mad Angel']['Clue scroll (medium)']).toEqual({ '1': '1/25' });
    expect(data.drops['Mad Angel']['Clue scroll (hard)']).toBeUndefined();
  });

  it('does not replace an existing gzip when fetched bytes fail JSON or transform preflight', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const existing = Buffer.from('preserve this gzip');
    const manifestFor = (raw: Buffer) => ({
      rawBytes: raw.length,
      rawSha256: createHash('sha256').update(raw).digest('hex').toUpperCase(),
      countFloors: { contentChunks: 1 },
      blobSha: gitBlobSha(raw),
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

  it('validates a malformed bank registry before the final transform consumes it', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const existing = Buffer.from('preserve malformed-bank-registry target');
    const raw = Buffer.from(JSON.stringify({ walkableChunks: [], chunks: {}, slayerMonsters: {} }));
    const manifest = {
      rawBytes: raw.length,
      rawSha256: createHash('sha256').update(raw).digest('hex').toUpperCase(),
      blobSha: gitBlobSha(raw),
      countFloors: {},
    };

    await writeFile(targetUrl, existing);
    try {
      await expect(writeApprovedChunkSource(raw, manifest, targetUrl, undefined, {
        bankLocationRegistry: { schemaVersion: 1, locations: {} },
      })).rejects.toThrow('Bank-location registry arrays are missing');
      await expect(readFile(targetUrl)).resolves.toEqual(existing);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it('rejects a stale Git blob hash before replacing an existing gzip', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const existing = Buffer.from('preserve stale-manifest target');
    const { raw, manifest } = await readPinnedChunkSource();
    await writeFile(targetUrl, existing);

    try {
      await expect(writeApprovedChunkSource(raw, {
        ...manifest,
        blobSha: '0000000000000000000000000000000000000000',
      }, targetUrl)).rejects.toThrow('Git blob SHA-1 mismatch');
      await expect(readFile(targetUrl)).resolves.toEqual(existing);
      expect((await readdir(tempDir)).filter(name => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it('preserves the target and cleans its sibling temp file when writing fails', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const existing = Buffer.from('preserve write-failure target');
    const { raw, manifest } = await readPinnedChunkSource();
    await writeFile(targetUrl, existing);

    const failingWrite = {
      readFile,
      rename,
      rm,
      writeFile: async (url: URL, data: Uint8Array) => {
        await writeFile(url, Buffer.from(data).subarray(0, 16));
        throw new Error('simulated temp write failure');
      },
    };
    try {
      await expect(writeApprovedChunkSource(raw, manifest, targetUrl, failingWrite))
        .rejects.toThrow('simulated temp write failure');
      await expect(readFile(targetUrl)).resolves.toEqual(existing);
      expect((await readdir(tempDir)).filter(name => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it('preserves the target and cleans its sibling temp file when renaming fails', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const existing = Buffer.from('preserve rename-failure target');
    const { raw, manifest } = await readPinnedChunkSource();
    await writeFile(targetUrl, existing);

    const failingRename = {
      readFile,
      writeFile,
      rm,
      rename: async () => { throw new Error('simulated atomic rename failure'); },
    };
    try {
      await expect(writeApprovedChunkSource(raw, manifest, targetUrl, failingRename))
        .rejects.toThrow('simulated atomic rename failure');
      await expect(readFile(targetUrl)).resolves.toEqual(existing);
      expect((await readdir(tempDir)).filter(name => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it('writes a fully validated canonical gzip artifact with OS header byte 10', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'fate-chunk-source-'));
    const targetUrl = pathToFileURL(join(tempDir, 'chunk-source.json.gz'));
    const { raw, manifest } = await readPinnedChunkSource();

    try {
      await writeApprovedChunkSource(raw, manifest, targetUrl);
      const compressed = await readFile(targetUrl);
      expect([...compressed.subarray(0, 10)]).toEqual([31, 139, 8, 0, 0, 0, 0, 0, 2, 10]);
      await expect(unzip(compressed)).resolves.toEqual(raw);
      expect((await readdir(tempDir)).filter(name => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }, 60_000);

  it('pins reviewed transform totals and the zero-unresolved named-location baseline', async () => {
    const { data, manifest } = await readPinnedChunkSource();
    const result = transformChunkContent(
      data,
      manifest,
      readNamedTaskUnlockRegistry(),
      readBankLocationRegistry(),
    );
    const { full, audit } = result;
    const taskUnlockTotals = audit.categoryTotals.taskUnlocks;
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
      contentChunks: 938,
      connections: 1110,
      slayerMasters: 10,
      shortcuts: 219,
      shops: 435,
      dropTables: 800,
      questSections: 134,
      banks: 126,
      tags: 27,
      auditEvents: 27110,
      unresolvedTaskUnlocks: 0,
    });
    expect(taskUnlockTotals.source).toBe(1675);
    expect(taskUnlockTotals.unresolved).toBe(0);
    expect(taskUnlockTotals.imported + taskUnlockTotals.normalized + taskUnlockTotals.excluded)
      .toBe(1675);
    expect(taskUnlockTotals).toEqual({
      source: 1675,
      imported: 1014,
      normalized: 657,
      excluded: 4,
      unresolved: 0,
    });
    expect(full.version).toBe(9);
    expect(full.sourceMeta).toMatchObject({
      namedLocationPolicyVersion: 1,
      namedLocationReviewedAt: '2026-08-03',
    });
    expect(Object.keys(full.entrances)).toHaveLength(44);
    expect(Object.values(full.entrances).flat()).toHaveLength(54);
  });

  it('attaches reviewed named-location requirements to every unique entrance chunk', async () => {
    const { data, manifest } = await readPinnedChunkSource();
    const { full, audit } = transformChunkContent(data, manifest, readNamedTaskUnlockRegistry());
    const taskUnlocks = full.taskUnlocks as Record<string, Record<string, Record<string, string[]>>>;
    const chunksWithRequirement = (
      requirementsByChunk: Record<string, string[]> | undefined,
      requirement: string,
    ) => Object.entries(requirementsByChunk ?? {})
      .filter(([, requirements]) => requirements.includes(requirement))
      .map(([chunkId]) => chunkId)
      .sort((left, right) => Number(left) - Number(right));

    const representatives = [
      ['Monsters', 'Abyssal demon', 'Abyssal demon wilderness task', ['12857', '13114']],
      ['Shops', 'Crossbow Shop (Dwarven Mine)', 'F2P Only', ['12084', '12085']],
      ['Objects', 'Barrel (beer)', 'Temple of Ikov', ['10549', '10550']],
      ['Spawns', "Red spiders' eggs", 'F2P Only', ['12341', '12342']],
      ['NPCs', 'Movario', 'Temple of Ikov', ['12848', '12850']],
    ] as const;
    for (const [category, entity, requirement, expectedChunks] of representatives) {
      const actualChunks = chunksWithRequirement(taskUnlocks[category]?.[entity], requirement);
      expect(actualChunks, `${category}/${entity}`).toEqual(expectedChunks);
      expect(new Set(actualChunks).size, `${category}/${entity}`).toBe(actualChunks.length);
    }

    const exclusions = audit.events
      .filter(event => event.category === 'taskUnlocks' && event.disposition === 'excluded')
      .map(({ sourceKey, terminal, disposition, reason, targetKeys }) => ({
        sourceKey,
        terminal,
        disposition,
        reason,
        targetKeys,
      }))
      .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
    expect(exclusions).toEqual([
      {
        sourceKey: 'Monsters/Abyssal Sire/Abyssal Nexus',
        terminal: true,
        disposition: 'excluded',
        reason: 'named-location-non-purchasable',
        targetKeys: [],
      },
      {
        sourceKey: 'Monsters/River troll/Enchanted Valley',
        terminal: true,
        disposition: 'excluded',
        reason: 'named-location-non-purchasable',
        targetKeys: [],
      },
      {
        sourceKey: 'Monsters/Rock golem (monster)/Enchanted Valley',
        terminal: true,
        disposition: 'excluded',
        reason: 'named-location-non-purchasable',
        targetKeys: [],
      },
      {
        sourceKey: 'Monsters/Tree spirit/Enchanted Valley',
        terminal: true,
        disposition: 'excluded',
        reason: 'named-location-non-purchasable',
        targetKeys: [],
      },
    ]);
  });

  it('reports upstream movement without mutating the pin', async () => {
    const result = await checkChunkSourceDrift(async () => new Response(JSON.stringify({
      commit: { sha: 'new-upstream-sha' },
    }), { status: 200 }));
    expect(result).toEqual({
      pinnedCommit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
      latestCommit: 'new-upstream-sha',
      moved: true,
    });
  });
});
