import { describe, expect, it } from 'vitest';
import {
  checkChunkSourceDrift,
  readPinnedChunkSource,
  verifyPinnedChunkSource,
} from './chunk-source.mjs';

describe('pinned Chunk Picker source', () => {
  it('verifies the exact reviewed commit, blob, bytes, and raw hash offline', async () => {
    const manifest = await verifyPinnedChunkSource();
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      repository: 'source-chunk/chunk-picker-v2',
      branch: 'gh-pages',
      commit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
      blobSha: '6674e5c62cd7a6ec90267def278aca5bc1f05a06',
      rawSha256: '95E4864651E2A9C7D4555C4EBBE4DD4AB5E71B881FF18BC966799CD22D48C167',
      rawBytes: 7802950,
      policyVersion: 2,
      reviewedAt: '2026-07-28',
    });
  });

  it('loads valid JSON from the committed gzip without network access', async () => {
    const { raw, data } = await readPinnedChunkSource();
    expect(raw).toHaveLength(7802950);
    expect(data).toMatchObject({
      chunks: expect.any(Object),
      walkableChunks: expect.any(Array),
      questSections: expect.any(Object),
      taskUnlocks: expect.any(Object),
    });
  });

  it('reports upstream movement without mutating the pin', async () => {
    const result = await checkChunkSourceDrift(async () => new Response(JSON.stringify({
      commit: { sha: 'new-upstream-sha' },
    }), { status: 200 }));
    expect(result).toEqual({
      pinnedCommit: 'ba2fcebf8b26c84c74f8d9ab328a0ede802be926',
      latestCommit: 'new-upstream-sha',
      moved: true,
    });
  });
});
