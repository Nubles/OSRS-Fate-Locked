import { describe, expect, it } from 'vitest';
import { requireRuneProofSources } from '../utils/runeproof/sourceGate';
import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import {
  buildRuneProofSourceAudit,
  runeProofSourceAudit,
} from './runeProofSourceAudit';

describe('runeProofSourceAudit', () => {
  it('keeps current unresolved quest and transform evidence conservative', () => {
    expect(questRequirementAudit.entries.filter(entry => entry.status === 'unresolved'))
      .toHaveLength(3);
    expect(chunkTransformAudit.events.filter(event => event.disposition === 'unresolved'))
      .toHaveLength(140);

    expect(runeProofSourceAudit).toMatchObject({
      questCoverage: 'PARTIAL',
      chunkCoverage: 'PARTIAL',
      acquisitionCoverage: 'PARTIAL',
    });
    expect(() => requireRuneProofSources(runeProofSourceAudit))
      .toThrow('RuneProof requires verified quest coverage');
  });

  it('certifies fully complete synthetic audit evidence', () => {
    const audit = buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1,
            imported: 1,
            normalized: 0,
            excluded: 0,
            unresolved: 0,
          },
        },
        events: [{ terminal: true, disposition: 'imported' }],
      },
    );

    expect(audit).toMatchObject({
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'PARTIAL',
    });
  });

  it('derives a distinct source version when either audit identity changes', () => {
    const quest = { schemaVersion: 1, entries: [{ status: 'verified' }] };
    const chunk = {
      schemaVersion: 1,
      sourceCommit: 'chunk-source',
      categoryTotals: {
        drops: {
          source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
        },
      },
      events: [{ terminal: true, disposition: 'imported' }],
    };

    const baseline = buildRuneProofSourceAudit(quest, chunk);
    expect(buildRuneProofSourceAudit(
      { ...quest, entries: [{ status: 'verified-with-notes' }] }, chunk,
    ).sourceVersion).not.toBe(baseline.sourceVersion);
    expect(buildRuneProofSourceAudit(
      quest, { ...chunk, sourceCommit: 'next-chunk-source' },
    ).sourceVersion).not.toBe(baseline.sourceVersion);
  });

  it('does not certify invalid transform accounting', () => {
    expect(buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 2,
            imported: 1,
            normalized: 0,
            excluded: 0,
            unresolved: 0,
          },
        },
        events: [{ terminal: true, disposition: 'imported' }],
      },
    ).chunkCoverage).toBe('UNKNOWN');
  });
});
