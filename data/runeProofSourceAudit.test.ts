import { describe, expect, it } from 'vitest';
import { requireRuneProofSources } from '../utils/runeproof/sourceGate';
import chunkTransformAudit from './sources/chunk-content-transform-audit.json';
import questRequirementAudit from './sources/quest-requirement-audit.json';
import {
  buildRuneProofSourceAudit,
  loadRuneProofSourceAudit,
} from './runeProofSourceAudit';

describe('runeProofSourceAudit', () => {
  it('keeps current unresolved quest and transform evidence conservative', async () => {
    expect(questRequirementAudit.entries.filter(entry => entry.status === 'unresolved'))
      .toHaveLength(3);
    expect(chunkTransformAudit.events.filter(event => event.disposition === 'unresolved'))
      .toHaveLength(140);

    const audit = await loadRuneProofSourceAudit();
    expect(audit).toMatchObject({
      questCoverage: 'PARTIAL',
      chunkCoverage: 'PARTIAL',
      acquisitionCoverage: 'PARTIAL',
    });
    expect(() => requireRuneProofSources(audit))
      .toThrow('RuneProof requires verified quest coverage');
  });

  it('certifies fully complete synthetic audit evidence', async () => {
    const audit = await buildRuneProofSourceAudit(
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
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
    );

    expect(audit).toMatchObject({
      questCoverage: 'VERIFIED',
      chunkCoverage: 'VERIFIED',
      acquisitionCoverage: 'PARTIAL',
    });
  });

  it('derives a deterministic SHA-256 version that changes with either audit', async () => {
    const quest = { schemaVersion: 1, entries: [{ status: 'verified' }] };
    const chunk = {
      schemaVersion: 1,
      sourceCommit: 'chunk-source',
      categoryTotals: {
        drops: {
          source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
        },
      },
      events: [{
        terminal: true,
        category: 'drops',
        sourceKey: 'drop-source',
        targetKeys: ['target'],
        disposition: 'imported',
      }],
    };

    const baseline = await buildRuneProofSourceAudit(quest, chunk);
    expect((await buildRuneProofSourceAudit(quest, chunk)).sourceVersion)
      .toBe(baseline.sourceVersion);
    expect(baseline.sourceVersion).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect((await buildRuneProofSourceAudit(
      { ...quest, entries: [{ status: 'verified-with-notes' }] }, chunk,
    )).sourceVersion).not.toBe(baseline.sourceVersion);
    expect((await buildRuneProofSourceAudit(
      quest, { ...chunk, sourceCommit: 'next-chunk-source' },
    )).sourceVersion).not.toBe(baseline.sourceVersion);
  });

  it('does not certify invalid transform accounting', async () => {
    expect((await buildRuneProofSourceAudit(
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
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
    )).chunkCoverage).toBe('UNKNOWN');
  });

  it('does not ignore malformed non-terminal transform events', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [
          {
            terminal: true,
            category: 'drops',
            sourceKey: 'drop-source',
            targetKeys: ['target'],
            disposition: 'imported',
          },
          {
            terminal: 'true',
            category: 'drops',
            sourceKey: 'malformed-extra',
            targetKeys: ['target'],
            disposition: 'imported',
          },
        ],
      },
    );

    expect(audit.chunkCoverage).toBe('UNKNOWN');
  });
  it('does not certify a terminal disposition distribution mismatch', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'normalized',
        }],
      },
    );

    expect(audit.chunkCoverage).toBe('UNKNOWN');
  });

  it('certifies acquisition coverage only from complete generated evidence', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
      {
        schemaVersion: 1,
        acquisitionCoverage: 'VERIFIED',
        sourceFamilyCoverage: {
          SHOP: 'VERIFIED',
          DROP: 'VERIFIED',
          SPAWN: 'VERIFIED',
          PRODUCTION: 'VERIFIED',
          RESOURCE_ENGINE: 'VERIFIED',
        },
        rules: [{
          id: 'acq:item-pot:shop-store-surface-50-50',
          output: { id: 'item:pot', kind: 'ITEM', label: 'Pot' },
          outputQuantity: 1,
          sourceKind: 'SHOP',
          sourceLabel: 'Store',
          locationId: 'surface:50,50',
          requirements: { op: 'ALL', terms: [] },
          repeatability: 'REPEATABLE',
          probability: null,
          coverage: 'VERIFIED',
          provenanceIds: ['fixture:verified'],
        }],
        unresolvedSources: [],
      },
    );

    expect(audit.acquisitionCoverage).toBe('VERIFIED');
  });

  it('does not promote acquisition evidence with unresolved legacy sources', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
      {
        schemaVersion: 1,
        acquisitionCoverage: 'VERIFIED',
        sourceFamilyCoverage: {
          SHOP: 'VERIFIED',
          DROP: 'VERIFIED',
          SPAWN: 'VERIFIED',
          PRODUCTION: 'VERIFIED',
          RESOURCE_ENGINE: 'PARTIAL',
        },
        unresolvedSources: [{
          id: 'unresolved:legacy',
          coverage: 'PARTIAL',
        }],
      },
    );

    expect(audit.acquisitionCoverage).toBe('PARTIAL');
  });

  it('rejects forged VERIFIED acquisition coverage over incomplete rules', async () => {
    const audit = await buildRuneProofSourceAudit(
      { schemaVersion: 1, entries: [{ status: 'verified' }] },
      {
        schemaVersion: 1,
        sourceCommit: 'chunk-source',
        categoryTotals: {
          drops: {
            source: 1, imported: 1, normalized: 0, excluded: 0, unresolved: 0,
          },
        },
        events: [{
          terminal: true,
          category: 'drops',
          sourceKey: 'drop-source',
          targetKeys: ['target'],
          disposition: 'imported',
        }],
      },
      {
        schemaVersion: 1,
        acquisitionCoverage: 'VERIFIED',
        sourceFamilyCoverage: {
          SHOP: 'VERIFIED',
          DROP: 'VERIFIED',
          SPAWN: 'VERIFIED',
          PRODUCTION: 'VERIFIED',
          RESOURCE_ENGINE: 'VERIFIED',
        },
        rules: [{
          id: 'acq:item-pot:shop-store-surface-50-50',
          locationId: 'surface:50,50',
          coverage: 'VERIFIED',
          provenanceIds: ['fixture:partial'],
        }],
        unresolvedSources: [],
      },
    );

    expect(audit.acquisitionCoverage).toBe('UNKNOWN');
  });
});
