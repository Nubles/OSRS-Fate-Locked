import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeRuneProofSourceVersion,
  generatedOutputMatches,
  renderRuneProofSourceDocument,
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

  it('keeps sourceVersion stable for equivalent inputs and changes with evidence', () => {
    const first = { chunks: { b: 2, a: 1 }, reviewed: ['source'] };
    const reordered = { reviewed: ['source'], chunks: { a: 1, b: 2 } };
    expect(computeRuneProofSourceVersion(first)).toBe(computeRuneProofSourceVersion(reordered));
    expect(computeRuneProofSourceVersion(first)).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(computeRuneProofSourceVersion({ ...first, reviewed: ['changed'] }))
      .not.toBe(computeRuneProofSourceVersion(first));
  });
});