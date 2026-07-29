import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeRuneProofDocumentVersion,
  computeTrustedAcquisitionCatalogVersion,
  generatedOutputMatches,
  renderRuneProofSourceDocument,
  renderTrustedAcquisitionSourceCatalog,
  writeGeneratedOutput,
} from './runeproof-source-generator.mjs';

const temporaryDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path =>
    rm(path, { recursive: true, force: true })));
});

describe('RuneProof source generator contract', () => {
  it('renders byte-identical output for the same document', () => {
    const document = { schemaVersion: 1, rules: [{ id: 'rule' }] };
    expect(renderRuneProofSourceDocument(document))
      .toBe(renderRuneProofSourceDocument(structuredClone(document)));
  });

  it('independently hashes and renders the trusted acquisition catalog', () => {
    const trustedCatalog = {
      schemaVersion: 1,
      sourceVersion: 'ignored',
      entries: [{
        id: 'resource-map:item:0000',
        kind: 'RESOURCE_MAP',
        coverage: 'PARTIAL',
        provenanceIds: [`resource-map:sha256-${'a'.repeat(64)}`],
      }],
    };
    expect(computeTrustedAcquisitionCatalogVersion(trustedCatalog))
      .toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(renderTrustedAcquisitionSourceCatalog(trustedCatalog))
      .toBe(`${JSON.stringify(trustedCatalog, null, 2)}\n`);
  });

  it('reports missing and stale output and accepts exact output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'runeproof-generator-'));
    temporaryDirectories.push(directory);
    const output = join(directory, 'runeproof.json');
    const bytes = renderRuneProofSourceDocument({ schemaVersion: 1 });

    await expect(generatedOutputMatches(output, bytes)).resolves.toBe(false);
    await writeFile(output, 'stale\n', 'utf8');
    await expect(generatedOutputMatches(output, bytes)).resolves.toBe(false);
    await writeGeneratedOutput(output, bytes);
    await expect(generatedOutputMatches(output, bytes)).resolves.toBe(true);
  });

  it('hashes exact canonical document contents while excluding sourceVersion', () => {
    const first = {
      sourceVersion: 'ignored', rules: [{ id: 'rule' }], accounting: { b: 2, a: 1 },
    };
    const reordered = {
      accounting: { a: 1, b: 2 }, rules: [{ id: 'rule' }], sourceVersion: 'also-ignored',
    };
    expect(computeRuneProofDocumentVersion(first))
      .toBe(computeRuneProofDocumentVersion(reordered));
    expect(computeRuneProofDocumentVersion(first)).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(computeRuneProofDocumentVersion({ ...first, rules: [{ id: 'changed' }] }))
      .not.toBe(computeRuneProofDocumentVersion(first));
  });
});