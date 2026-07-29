import { describe, expect, it } from 'vitest';
import { requireRuneProofSources } from '../utils/runeproof/sourceGate';
import { runeProofSourceAudit } from './runeProofSourceAudit';

describe('runeProofSourceAudit', () => {
  it('adapts the checked-in quest and chunk audits without overstating acquisition coverage', () => {
    expect(runeProofSourceAudit).toEqual({
      sourceVersion: 'osrs-2026-07-29',
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'PARTIAL',
    });
  });

  it('keeps RuneProof initialization gated until acquisition sources are audited', () => {
    expect(() => requireRuneProofSources(runeProofSourceAudit))
      .toThrow('RuneProof requires verified acquisition coverage');
  });
});
