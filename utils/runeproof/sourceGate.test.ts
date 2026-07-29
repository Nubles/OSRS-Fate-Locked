import { describe, expect, it } from 'vitest';
import { requireRuneProofSources } from './sourceGate';

describe('requireRuneProofSources', () => {
  it('accepts a verified snapshot', () => {
    expect(requireRuneProofSources({
      sourceVersion: 'osrs-2026-07-29',
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'VERIFIED',
    }).sourceVersion).toBe('osrs-2026-07-29');
  });

  it('rejects data that could create a false impossibility claim', () => {
    expect(() => requireRuneProofSources({
      sourceVersion: 'draft',
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'PARTIAL',
    })).toThrow('RuneProof requires verified acquisition coverage');
  });

  it.each([
    ['questCoverage', 'UNKNOWN', 'quest'],
    ['questCoverage', 'PARTIAL', 'quest'],
    ['chunkCoverage', 'UNKNOWN', 'chunk'],
    ['chunkCoverage', 'PARTIAL', 'chunk'],
  ] as const)('rejects %s %s coverage', (key, coverage, label) => {
    expect(() => requireRuneProofSources({
      sourceVersion: 'draft',
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'VERIFIED',
      [key]: coverage,
    })).toThrow(`RuneProof requires verified ${label} coverage`);
  });
});
